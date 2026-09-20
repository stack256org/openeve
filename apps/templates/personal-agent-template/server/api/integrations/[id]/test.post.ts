import { getConnector } from "~~/server/connectors";
import { connectorIdParamsSchema } from "~~/server/schemas/integrations";
import { throwIntegrationError } from "~~/server/utils/errors";
import { requireToken } from "~~/server/utils/integrations";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, connectorIdParamsSchema.parse);

  await requireSessionUserId(event);
  const connector = getConnector(id);
  const token = requireToken(connector);

  try {
    const results = await connector.test.run(token);
    return { results };
  } catch (error) {
    throwIntegrationError(error);
  }
});
