import { connectors } from "~~/server/connectors";
import { probeStatus } from "~~/server/utils/integrations";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireSessionUserId(event);

  return connectors.map((connector) => ({
    id: connector.id,
    name: connector.name,
    description: connector.description,
    icon: connector.icon,
    envVar: connector.envVar,
    connectionName: connector.connectionName,
    testLabel: connector.test.label,
    status: probeStatus(connector),
  }));
});
