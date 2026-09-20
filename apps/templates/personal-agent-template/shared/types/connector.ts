export type ConnectorStatus =
  | { state: "connected" }
  | { state: "setup_required"; message: string; hint?: string }
  | { state: "error"; message: string };

export type ConnectorState = ConnectorStatus["state"];

/** API response — one row in the integrations hub. */
export interface ConnectorSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  envVar: string;
  connectionName: string;
  testLabel: string;
  status: ConnectorStatus;
}

/** Server registry entry in `server/connectors.ts`. */
export interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  /** Environment variable holding this integration's API token. */
  envVar: string;
  /** Eve connection name from `agent/connections/<connectionName>.ts`. */
  connectionName: string;
  icon: string;
  test: {
    label: string;
    run: (token: string) => Promise<string[]>;
  };
}

export interface ParsedTestResult {
  id?: string;
  tag?: string;
  title: string;
}
