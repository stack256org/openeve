import { defineTool } from "eve/tools";
import { z } from "zod";

import { compactWorkflowJob, requestMux } from "../lib/mux-api";
import { workflowSchema } from "../lib/workflows";

export default defineTool({
  description:
    "Retrieve the persisted status and outputs of one known Mux Robots job. The workflow and job ID must match the original job.",
  inputSchema: z
    .object({
      workflow: workflowSchema,
      jobId: z.string().trim().min(1),
    })
    .strict(),
  async execute({ workflow, jobId }, ctx) {
    const job = await requestMux<unknown>(
      `/robots/v0/jobs/${encodeURIComponent(workflow)}/${encodeURIComponent(jobId)}`,
      { signal: ctx.abortSignal },
    );
    return { workflow, jobId, job };
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        workflow: output.workflow,
        jobId: output.jobId,
        job: compactWorkflowJob(output.job),
      },
    };
  },
});
