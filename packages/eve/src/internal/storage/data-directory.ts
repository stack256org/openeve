import { join } from "node:path";

/**
 * Resolves the single directory holding every durable open-eve artifact.
 * One path to back up, one path to move between hosts.
 */
export function resolveDataDirectory(appRoot: string): string {
  const configured = process.env.EVE_DATA_DIR?.trim();
  return configured === undefined || configured === "" ? join(appRoot, "data") : configured;
}
