import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { compactAsset } from "../lib/assets";
import { requestMux } from "../lib/mux-api";

const inputSchema = z
  .object({
    assetId: z.string().trim().min(1),
    startTimeSeconds: z.number().finite().nonnegative(),
    endTimeSeconds: z.number().finite().positive(),
    playbackPolicy: z.enum(["public", "signed"]).default("public"),
    videoQuality: z.enum(["basic", "plus", "premium"]).default("basic"),
    title: z.string().trim().min(1).max(512).optional(),
    passthrough: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.endTimeSeconds <= value.startTimeSeconds) {
      ctx.addIssue({
        code: "custom",
        path: ["endTimeSeconds"],
        message: "endTimeSeconds must be greater than startTimeSeconds",
      });
    }
  });

export default defineTool({
  description:
    "Create a new Mux Video asset containing an exact time range from a known source asset.",
  inputSchema,
  approval: always(),
  async execute(input, ctx) {
    const body: Record<string, unknown> = {
      inputs: [
        {
          url: `mux://assets/${input.assetId}`,
          start_time: input.startTimeSeconds,
          end_time: input.endTimeSeconds,
        },
      ],
      playback_policies: [input.playbackPolicy],
      video_quality: input.videoQuality,
    };
    if (input.title !== undefined) body.meta = { title: input.title };
    if (input.passthrough !== undefined) body.passthrough = input.passthrough;
    const asset = await requestMux<unknown>("/video/v1/assets", {
      method: "POST",
      body,
      signal: ctx.abortSignal,
    });

    return {
      sourceAssetId: input.assetId,
      startTimeSeconds: input.startTimeSeconds,
      endTimeSeconds: input.endTimeSeconds,
      asset,
    };
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        sourceAssetId: output.sourceAssetId,
        startTimeSeconds: output.startTimeSeconds,
        endTimeSeconds: output.endTimeSeconds,
        clip: compactAsset(output.asset),
      },
    };
  },
});
