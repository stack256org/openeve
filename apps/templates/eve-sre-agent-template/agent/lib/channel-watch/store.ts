import { resolveSlackUser, type SlackUserAuthLike } from "#lib/auth.ts";
import { createObjectStore } from "#lib/object-store.ts";

const STORE_ROOT = "sre-channel-watch";

export interface ChannelWatchKey {
  readonly channelId: string;
  readonly teamId: string;
}

export interface ChannelWatchRecord {
  readonly watchedAt: string;
  readonly watchedBy: string;
}

export interface WatchObjectStore {
  delete: (pathname: string) => Promise<void>;
  read: (pathname: string) => Promise<string | null>;
  write: (pathname: string, content: string) => Promise<void>;
}

export class ChannelWatchStoreError extends Error {}

export class ChannelWatchAuthError extends ChannelWatchStoreError {
  constructor() {
    super("A human Slack user is required to watch or unwatch a channel.");
    this.name = "ChannelWatchAuthError";
  }
}

function watchPath({ teamId, channelId }: ChannelWatchKey): string {
  return `${STORE_ROOT}/${teamId}/${channelId}.json`;
}

const watchObjectStore: WatchObjectStore = createObjectStore();

export class ChannelWatchStore {
  private readonly objects: WatchObjectStore;
  private readonly now: () => Date;

  constructor(objects: WatchObjectStore = watchObjectStore, now: () => Date = () => new Date()) {
    this.objects = objects;
    this.now = now;
  }

  async has(key: ChannelWatchKey): Promise<boolean> {
    const pathname = watchPath(key);
    try {
      return (await this.objects.read(pathname)) !== null;
    } catch (error) {
      console.warn("[sre/channel-watch] failed to read watch membership", {
        error: error instanceof Error ? error.message : String(error),
        pathname,
      });
      return false;
    }
  }

  async watch(
    auth: SlackUserAuthLike | null | undefined,
    key: ChannelWatchKey,
  ): Promise<ChannelWatchRecord> {
    const user = resolveSlackUser(auth);
    if (!user) {
      throw new ChannelWatchAuthError();
    }
    const record = {
      watchedAt: this.now().toISOString(),
      watchedBy: user.principalId,
    };
    await this.objects.write(watchPath(key), JSON.stringify(record));
    return record;
  }

  async unwatch(auth: SlackUserAuthLike | null | undefined, key: ChannelWatchKey): Promise<void> {
    const user = resolveSlackUser(auth);
    if (!user) {
      throw new ChannelWatchAuthError();
    }
    await this.objects.delete(watchPath(key));
  }
}

const defaultStore = new ChannelWatchStore();

export function getChannelWatchStore(): ChannelWatchStore {
  return defaultStore;
}
