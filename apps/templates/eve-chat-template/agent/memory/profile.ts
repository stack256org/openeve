import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

// fileMemory() stores documents in the local data directory by default, so
// memory works anywhere with no configuration. Vercel's filesystem is not
// durable, so a Vercel deployment needs a Blob store instead: only the
// EVE_MEMORY_BLOB_* namespace enables it. eve also accepts generic BLOB_*
// variables, but this template ignores them so memory never silently takes
// over an application's own Blob store.
const MEMORY_BLOB_ENV_KEYS = [
  "EVE_MEMORY_BLOB_STORE_ID",
  "EVE_MEMORY_BLOB_READ_WRITE_TOKEN",
] as const;

function hasMemoryBlobStorage() {
  return MEMORY_BLOB_ENV_KEYS.some((key) => process.env[key]?.trim());
}

export default defineMemory({
  description: "Remember stable facts and preferences about the caller.",
  provider: fileMemory(),
  scope(context) {
    // On Vercel, do not expose memory tools until Blob storage is attached.
    if (process.env.VERCEL && !hasMemoryBlobStorage()) {
      return null;
    }

    return byPrincipal(context);
  },
});
