const DEFAULT_MUX_API_BASE_URL = "https://api.mux.com";
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "errored"]);

export interface PollSummaryJobOptions {
  jobId: string;
  signal: AbortSignal;
  sleep(ms: number): Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
}

export async function pollSummaryJob({
  jobId,
  signal,
  sleep,
  intervalMs = 3_000,
  timeoutMs = 6 * 60 * 1_000,
}: PollSummaryJobOptions): Promise<unknown> {
  const tokenId = readRequiredEnv("MUX_TOKEN_ID");
  const tokenSecret = readRequiredEnv("MUX_TOKEN_SECRET");
  const authorization = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
  const url = new URL(
    `/robots/v0/jobs/summarize/${encodeURIComponent(jobId)}`,
    DEFAULT_MUX_API_BASE_URL,
  );
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    const response = await fetch(url, {
      headers: { authorization },
      signal,
    });
    const body = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`Mux summarize job lookup failed with HTTP ${response.status}.`);
    }

    const job = unwrapData(body);
    const status = readString(job, "status");
    if (status === "completed") return job;
    if (status !== undefined && TERMINAL_STATUSES.has(status)) {
      throw new Error(`Mux summarize job ${jobId} reached terminal status ${status}.`);
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for Mux summarize job ${jobId} to complete.`);
}

export function readRequiredAssetIds(): Record<
  "MUX_TEST_ASSET_ID" | "MUX_TEST_MOVIE_TRAILER_ASSET_ID",
  string
> {
  const primary = readRequiredEnv("MUX_TEST_ASSET_ID");
  const movieTrailer = readRequiredEnv("MUX_TEST_MOVIE_TRAILER_ASSET_ID");
  if (primary === movieTrailer) {
    throw new Error(
      "MUX_TEST_ASSET_ID and MUX_TEST_MOVIE_TRAILER_ASSET_ID must reference different assets.",
    );
  }

  return {
    MUX_TEST_ASSET_ID: primary,
    MUX_TEST_MOVIE_TRAILER_ASSET_ID: movieTrailer,
  };
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required eval environment variable ${name}.`);
  return value;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function unwrapData(value: unknown): unknown {
  return isRecord(value) && "data" in value ? value.data : value;
}

function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const item = value[key];
  return typeof item === "string" ? item : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
