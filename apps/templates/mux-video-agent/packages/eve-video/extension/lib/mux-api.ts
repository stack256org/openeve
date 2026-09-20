import extension from "../extension";

export type MuxRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
};

export class MuxApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: unknown,
    message: string,
  ) {
    super(message);
    this.name = "MuxApiError";
  }
}

export async function requestMux<T>(
  path: string,
  options: MuxRequestOptions = {},
  dependencies: { fetch?: typeof fetch } = {},
): Promise<T> {
  const { tokenId, tokenSecret, apiBaseUrl } = extension.config;
  if (!tokenId || !tokenSecret) {
    throw new Error("Mux credentials are not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.");
  }

  return requestMuxWithConfig<T>({ tokenId, tokenSecret, apiBaseUrl }, path, options, dependencies);
}

export async function requestMuxWithConfig<T>(
  config: { tokenId: string; tokenSecret: string; apiBaseUrl: string },
  path: string,
  options: MuxRequestOptions = {},
  dependencies: { fetch?: typeof fetch } = {},
): Promise<T> {
  const fetchImpl = dependencies.fetch ?? fetch;
  const url = new URL(path.replace(/^\/+/, ""), withTrailingSlash(config.apiBaseUrl));
  const headers: Record<string, string> = {
    authorization: `Basic ${Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString("base64")}`,
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetchImpl(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const responseBody = await parseResponse(response);

  if (!response.ok) {
    throw new MuxApiError(
      response.status,
      responseBody,
      `Mux API request failed with HTTP ${response.status}.`,
    );
  }

  if (isRecord(responseBody) && "data" in responseBody) {
    return responseBody.data as T;
  }

  return responseBody as T;
}

export function publicPlaybackUrls(asset: unknown): Array<{
  playbackId: string;
  hlsUrl: string;
  playerUrl: string;
  thumbnailUrl: string;
}> {
  if (!isRecord(asset) || !Array.isArray(asset.playback_ids)) return [];

  return asset.playback_ids.flatMap((playback) => {
    if (!isRecord(playback) || playback.policy !== "public" || typeof playback.id !== "string") {
      return [];
    }

    const playbackId = playback.id;
    return [
      {
        playbackId,
        hlsUrl: `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`,
        playerUrl: `https://player.mux.com/${encodeURIComponent(playbackId)}`,
        thumbnailUrl: `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg`,
      },
    ];
  });
}

export function compactWorkflowJob(job: unknown): Record<string, unknown> {
  if (!isRecord(job)) return { job };

  return {
    id: job.id ?? null,
    workflow: job.workflow ?? null,
    status: job.status ?? null,
    parameters: redactTemporaryUrls(job.parameters),
    outputs: redactTemporaryUrls(job.outputs),
    unitsConsumed: job.units_consumed ?? null,
    createdAt: job.created_at ?? null,
    updatedAt: job.updated_at ?? null,
    passthrough: job.passthrough ?? null,
    errors: redactTemporaryUrls(job.errors),
  };
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactTemporaryUrls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTemporaryUrls);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /^(?:temporary|signed|private|download).*(?:url|uri)$/i.test(key)
        ? "[redacted temporary URL]"
        : redactTemporaryUrls(item),
    ]),
  );
}
