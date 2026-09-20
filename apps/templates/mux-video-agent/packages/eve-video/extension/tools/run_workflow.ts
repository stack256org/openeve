import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import { compactWorkflowJob, requestMux } from "../lib/mux-api";
import {
  parametersForWorkflow,
  runWorkflowInputSchema,
  runWorkflowToolInputSchema,
} from "../lib/workflows";

export default defineTool({
  description:
    "Start one supported asynchronous Mux Robots job for a known Mux asset. Returns the job identifier and initial status; it does not wait for completion.",
  inputSchema: runWorkflowToolInputSchema,
  approval: always(),
  async execute(rawInput, ctx) {
    const input = runWorkflowInputSchema.parse(rawInput);
    const body: Record<string, unknown> = {
      parameters: parametersForWorkflow(input),
    };
    if (input.passthrough !== undefined) body.passthrough = input.passthrough;
    const job = await requestMux<unknown>(`/robots/v0/jobs/${encodeURIComponent(input.workflow)}`, {
      method: "POST",
      body,
      signal: ctx.abortSignal,
    });

    return {
      assetId: input.assetId,
      workflow: input.workflow,
      job,
    };
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        assetId: output.assetId,
        workflow: output.workflow,
        job: compactWorkflowJob(output.job),
      },
    };
  },
});
