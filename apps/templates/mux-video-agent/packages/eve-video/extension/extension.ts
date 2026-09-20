import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    tokenId: z.string().min(1).optional(),
    tokenSecret: z.string().min(1).optional(),
    apiBaseUrl: z.string().url().default("https://api.mux.com"),
  }),
});
