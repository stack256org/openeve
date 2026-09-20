import { z } from "zod";

export const connectorIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Connector id is required"),
});
