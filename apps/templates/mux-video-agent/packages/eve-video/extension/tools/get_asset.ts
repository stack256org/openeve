import { defineTool } from "eve/tools";
import { z } from "zod";

import { compactAsset } from "../lib/assets";
import { requestMux } from "../lib/mux-api";

export default defineTool({
  description:
    "Retrieve one known Mux Video asset, including status, tracks, metadata, and safe public playback URLs.",
  inputSchema: z
    .object({
      assetId: z.string().trim().min(1),
    })
    .strict(),
  async execute({ assetId }, ctx) {
    const asset = await requestMux<unknown>(`/video/v1/assets/${encodeURIComponent(assetId)}`, {
      signal: ctx.abortSignal,
    });
    return { assetId, asset };
  },
  toModelOutput(output) {
    return { type: "json", value: compactAsset(output.asset) };
  },
});
