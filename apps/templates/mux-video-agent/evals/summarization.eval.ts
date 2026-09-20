import { defineEval } from "eve/evals";
import { matches, satisfies } from "eve/evals/expect";
import { z } from "zod";

import { pollSummaryJob, readRequiredAssetIds } from "./helpers/mux-summary";

const RUN_WORKFLOW_TOOL = "mux_video__run_workflow";
const REQUESTED_TAG_COUNT = 10;

const summaryJobSchema = z
  .object({
    id: z.string().min(1),
    status: z.literal("completed"),
    units_consumed: z.number().int().nonnegative(),
    parameters: z
      .object({
        asset_id: z.string().min(1),
        tag_count: z.number().int().positive().max(REQUESTED_TAG_COUNT).optional(),
      })
      .passthrough(),
    outputs: z
      .object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        tags: z.array(z.string().trim().min(1)).min(1).max(REQUESTED_TAG_COUNT),
        transcript_text: z.string().trim().min(1).optional(),
      })
      .passthrough(),
  })
  .passthrough();

type SummaryJob = z.infer<typeof summaryJobSchema>;
type AssetEnvName = "MUX_TEST_ASSET_ID" | "MUX_TEST_MOVIE_TRAILER_ASSET_ID";

const cases: readonly { envName: AssetEnvName; fixture: string }[] = [
  { envName: "MUX_TEST_ASSET_ID", fixture: "primary" },
  { envName: "MUX_TEST_MOVIE_TRAILER_ASSET_ID", fixture: "movie trailer" },
];

export default cases.map(({ envName, fixture }) =>
  defineEval({
    description: `Starts and validates a completed Mux summarization for the ${fixture} asset fixture.`,
    tags: ["summarization", "live", "three-e"],
    metadata: {
      assetEnvName: envName,
      fixture,
      model: process.env.MUX_VIDEO_AGENT_MODEL ?? "openai/gpt-5.6-luna",
      requestedTagCount: REQUESTED_TAG_COUNT,
    },
    async test(t) {
      const assetId = readRequiredAssetIds()[envName];
      const agentStartedAt = performance.now();

      await t.send(
        `Start the Mux Robots summarize workflow for asset ${assetId}. ` +
          `Return at most ${REQUESTED_TAG_COUNT} content tags. Use the default tone and do not ` +
          "change the asset metadata. Do not ask follow-up questions. After approval, report the job ID.",
      );

      const pendingRequests = collectInputRequests(t.events);
      if (
        !pendingRequests.some(
          (request) =>
            request.toolName === RUN_WORKFLOW_TOOL && isValidSummaryRequest(request.input, assetId),
        )
      ) {
        t.log(formatApprovalRoutingFailure({ assetId, fixture, pendingRequests }));
      }
      t.requireInputRequest({
        toolName: RUN_WORKFLOW_TOOL,
        input: (input) => isValidSummaryRequest(input, assetId),
      });
      const approvalRequestedAt = performance.now();
      await t.respondAll("approve");
      const agentCompletedAt = performance.now();

      t.succeeded();
      t.noFailedActions();
      t.calledTool(RUN_WORKFLOW_TOOL, {
        input: (input) => isValidSummaryRequest(input, assetId),
        status: "completed",
        count: 1,
      }).label("efficacy: one summarization job");
      const summarizeOutputs = completedToolOutputs(t.events, RUN_WORKFLOW_TOOL);
      await t.require(
        summarizeOutputs,
        satisfies(
          (outputs: readonly unknown[]) => outputs.length === 1,
          "summarization tool returned exactly one completed output",
        ),
      );
      const jobId = extractJobId(summarizeOutputs[0]);
      await t.require(
        jobId,
        satisfies(
          (value: string | undefined) => typeof value === "string" && value.length > 0,
          "summarization tool returned a job ID",
        ),
      );

      const workflowStartedAt = performance.now();
      const rawJob = await pollSummaryJob({
        jobId: jobId!,
        signal: t.signal,
        sleep: (ms) => t.sleep(ms),
      });
      const workflowCompletedAt = performance.now();
      const job = (await t.require(rawJob, matches(summaryJobSchema))) as SummaryJob;

      t.check(
        job.parameters.asset_id,
        satisfies((value: string) => value === assetId, "summary job preserves the asset ID"),
      ).label("efficacy: asset identity");
      t.check(
        job.parameters.tag_count,
        satisfies(isValidTagLimit, "summary job preserves a tag limit no greater than requested"),
      ).label("efficacy: tag limit");
      t.check(
        job.outputs.tags,
        satisfies(hasUniqueCaseInsensitiveValues, "summary tags are unique"),
      ).label("efficacy: tag uniqueness");

      const usage = collectModelUsage(t.events);
      t.log(
        formatEvalOutput({
          fixture,
          model: process.env.MUX_VIDEO_AGENT_MODEL ?? "openai/gpt-5.6-luna",
          assetId,
          jobId: jobId!,
          job,
          approvalRequestLatencyMs: approvalRequestedAt - agentStartedAt,
          agentLatencyMs: agentCompletedAt - agentStartedAt,
          workflowPollingLatencyMs: workflowCompletedAt - workflowStartedAt,
          usage,
        }),
      );
    },
  }),
);

function extractJobId(output: unknown): string | undefined {
  if (!isRecord(output) || !isRecord(output.job)) return undefined;
  return typeof output.job.id === "string" ? output.job.id : undefined;
}

function completedToolOutputs(
  events: readonly { type: string; data?: unknown }[],
  toolName: string,
): readonly unknown[] {
  return events.flatMap((event) => {
    if (event.type !== "action.result" || !isRecord(event.data)) return [];
    const result = event.data.result;
    if (event.data.status !== "completed" || !isRecord(result) || result.toolName !== toolName) {
      return [];
    }
    return [result.output];
  });
}

function hasUniqueCaseInsensitiveValues(tags: readonly string[]): boolean {
  const normalized = tags.map((tag) => tag.trim().toLocaleLowerCase());
  return normalized.length === new Set(normalized).size;
}

function isValidSummaryRequest(input: unknown, assetId: string): boolean {
  if (!isRecord(input)) return false;
  return (
    input.assetId === assetId &&
    input.workflow === "summarize" &&
    isValidTagLimit(input.tagCount) &&
    input.updateAssetMeta !== true
  );
}

function isValidTagLimit(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value > 0 &&
      value <= REQUESTED_TAG_COUNT)
  );
}

function collectInputRequests(
  events: readonly { type: string; data?: unknown }[],
): readonly { input: unknown; kind: string; toolName: string; prompt: string }[] {
  return events.flatMap((event) => {
    if (event.type !== "input.requested" || !isRecord(event.data)) return [];
    const requests = event.data.requests;
    if (!Array.isArray(requests)) return [];

    return requests.flatMap((request) => {
      if (!isRecord(request)) return [];
      const action = request.action;
      return [
        {
          input: isRecord(action) ? action.input : undefined,
          kind: typeof request.kind === "string" ? request.kind : "unknown",
          toolName:
            isRecord(action) && typeof action.toolName === "string" ? action.toolName : "unknown",
          prompt: typeof request.prompt === "string" ? request.prompt : "",
        },
      ];
    });
  });
}

function formatApprovalRoutingFailure({
  assetId,
  fixture,
  pendingRequests,
}: {
  assetId: string;
  fixture: string;
  pendingRequests: readonly { input: unknown; kind: string; toolName: string; prompt: string }[];
}): string {
  const observed =
    pendingRequests.length === 0
      ? "none"
      : pendingRequests
          .map(
            ({ input, kind, toolName }) => `${kind} via ${toolName} with ${JSON.stringify(input)}`,
          )
          .join(", ");
  const prompt = pendingRequests.find(({ prompt }) => prompt.length > 0)?.prompt;

  return [
    `APPROVAL ROUTING · ${fixture}`,
    `Expected           tool-approval via ${RUN_WORKFLOW_TOOL}`,
    `Required input     asset ${assetId} · summarize · 1-${REQUESTED_TAG_COUNT} tags or API default · no metadata update`,
    `Observed           ${observed}`,
    ...(prompt ? [`Prompt             ${prompt}`] : []),
  ].join("\n");
}

function collectModelUsage(events: readonly { type: string; data?: unknown }[]) {
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let costUsd = 0;
  let hasInputTokens = false;
  let hasOutputTokens = false;
  let hasCacheReadTokens = false;
  let hasCacheWriteTokens = false;
  let hasCostUsd = false;

  for (const event of events) {
    if (event.type !== "step.completed" || !isRecord(event.data)) continue;
    steps += 1;
    const usage = event.data.usage;
    if (!isRecord(usage)) continue;
    const input = readFiniteNumber(usage.inputTokens);
    const output = readFiniteNumber(usage.outputTokens);
    const cacheRead = readFiniteNumber(usage.cacheReadTokens);
    const cacheWrite = readFiniteNumber(usage.cacheWriteTokens);
    const cost = readFiniteNumber(usage.costUsd);
    if (input !== undefined) {
      hasInputTokens = true;
      inputTokens += input;
    }
    if (output !== undefined) {
      hasOutputTokens = true;
      outputTokens += output;
    }
    if (cacheRead !== undefined) {
      hasCacheReadTokens = true;
      cacheReadTokens += cacheRead;
    }
    if (cacheWrite !== undefined) {
      hasCacheWriteTokens = true;
      cacheWriteTokens += cacheWrite;
    }
    if (cost !== undefined) {
      hasCostUsd = true;
      costUsd += cost;
    }
  }

  return {
    steps,
    inputTokens: hasInputTokens ? inputTokens : null,
    outputTokens: hasOutputTokens ? outputTokens : null,
    cacheReadTokens: hasCacheReadTokens ? cacheReadTokens : null,
    cacheWriteTokens: hasCacheWriteTokens ? cacheWriteTokens : null,
    costUsd: hasCostUsd ? Number(costUsd.toFixed(8)) : null,
  };
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatEvalOutput({
  fixture,
  model,
  assetId,
  jobId,
  job,
  approvalRequestLatencyMs,
  agentLatencyMs,
  workflowPollingLatencyMs,
  usage,
}: {
  fixture: string;
  model: string;
  assetId: string;
  jobId: string;
  job: SummaryJob;
  approvalRequestLatencyMs: number;
  agentLatencyMs: number;
  workflowPollingLatencyMs: number;
  usage: ReturnType<typeof collectModelUsage>;
}): string {
  return [
    `SUMMARY · ${fixture}`,
    row("Model", model),
    row("Title", job.outputs.title),
    row("Description", job.outputs.description),
    row(`Tags ${job.outputs.tags.length}/${REQUESTED_TAG_COUNT}`, job.outputs.tags.join(", ")),
    "",
    "EFFICACY",
    row("Status", job.status),
    row("Tags", `${job.outputs.tags.length} non-empty, unique tags`),
    "",
    "EFFICIENCY",
    row("Approval request", formatDuration(approvalRequestLatencyMs)),
    row("Agent total", formatDuration(agentLatencyMs)),
    row("Workflow polling", formatDuration(workflowPollingLatencyMs)),
    row("Model steps", String(usage.steps)),
    row(
      "Tokens",
      [
        `${formatInteger(usage.inputTokens)} input`,
        `${formatInteger(usage.outputTokens)} output`,
        `${formatInteger(usage.cacheReadTokens)} cache read`,
        `${formatInteger(usage.cacheWriteTokens)} cache write`,
      ].join(" · "),
    ),
    "",
    "EXPENSE",
    row("Model", formatCost(usage.costUsd)),
    row("Mux", `${job.units_consumed.toLocaleString("en-US")} units · 1 Robots job`),
    "",
    "DETAILS",
    row("Asset", assetId),
    row("Job", jobId),
  ].join("\n");
}

function row(label: string, value: string): string {
  return `  ${label.padEnd(18)} ${value}`;
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000
    ? `${Math.round(milliseconds)}ms`
    : `${(milliseconds / 1_000).toFixed(2)}s`;
}

function formatInteger(value: number | null): string {
  return value === null ? "unavailable" : value.toLocaleString("en-US");
}

function formatCost(value: number | null): string {
  return value === null ? "unavailable" : `$${value.toFixed(6)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
