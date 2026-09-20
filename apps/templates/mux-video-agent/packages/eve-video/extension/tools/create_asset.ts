import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { compactAsset } from "../lib/assets";
import { requestMux } from "../lib/mux-api";

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "sourceUrl must use http or https");

const inputSchema = z
  .object({
    sourceUrl: httpUrlSchema.describe(
      "A URL Mux can fetch without browser cookies or private request headers.",
    ),
    playbackPolicy: z.enum(["public", "signed"]).default("public"),
    videoQuality: z.enum(["basic", "plus", "premium"]).default("basic"),
    test: z
      .boolean()
      .default(true)
      .describe("Test assets are watermarked, limited to 10 seconds, and deleted after 24 hours."),
    generatedSubtitles: z
      .object({
        languageCode: z.string().trim().min(1).max(32).default("auto"),
        name: z.string().trim().min(1).max(255).optional(),
      })
      .strict()
      .optional(),
    title: z.string().trim().min(1).max(512).optional(),
    externalId: z.string().trim().min(1).max(128).optional(),
    creatorId: z.string().trim().min(1).max(128).optional(),
    passthrough: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export default defineTool({
  description:
    "Create a Mux Video asset from a user-approved hosted media URL. Defaults to a short-lived watermarked test asset.",
  inputSchema,
  approval: always(),
  async execute(input, ctx) {
    const meta = compact({
      title: input.title,
      external_id: input.externalId,
      creator_id: input.creatorId,
    });
    const source = compact({
      url: input.sourceUrl,
      generated_subtitles:
        input.generatedSubtitles === undefined
          ? undefined
          : [
              compact({
                language_code: input.generatedSubtitles.languageCode,
                name: input.generatedSubtitles.name,
              }),
            ],
    });
    const asset = await requestMux<unknown>("/video/v1/assets", {
      method: "POST",
      body: compact({
        inputs: [source],
        playback_policies: [input.playbackPolicy],
        video_quality: input.videoQuality,
        test: input.test,
        meta: Object.keys(meta).length === 0 ? undefined : meta,
        passthrough: input.passthrough,
      }),
      signal: ctx.abortSignal,
    });

    return { asset };
  },
  toModelOutput(output) {
    return { type: "json", value: compactAsset(output.asset) };
  },
});

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
