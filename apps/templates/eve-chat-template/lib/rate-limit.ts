import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

type LimitOptions = {
  readonly key: string;
  readonly limit: number;
  readonly prefix: string;
  readonly windowSeconds: number;
};

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests. Please wait a moment and try again.");
    this.retryAfter = retryAfter;
  }
}

let connection: Promise<RedisClient> | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() || null;
}

function getRedis(url: string) {
  if (!connection) {
    const client = createClient({ url });

    // A dropped connection must not become an unhandled rejection; the next
    // call reconnects through a fresh promise.
    client.on("error", () => {});

    connection = client
      .connect()
      .then(() => client)
      .catch((error: unknown) => {
        connection = null;
        throw error;
      });
  }

  return connection;
}

export async function enforceRateLimit(options: LimitOptions) {
  const url = getRedisUrl();

  if (!url) {
    return;
  }

  const client = await getRedis(url);
  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / options.windowSeconds);
  const redisKey = `rate:${options.prefix}:${options.key}:${windowId}`;
  const count = await client.incr(redisKey);

  if (count === 1) {
    await client.expire(redisKey, options.windowSeconds);
  }

  if (count > options.limit) {
    const retryAfter = options.windowSeconds - (now % options.windowSeconds);
    throw new RateLimitError(retryAfter);
  }
}
