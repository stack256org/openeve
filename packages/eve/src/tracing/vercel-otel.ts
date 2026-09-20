import { createRequire } from "node:module";

import type { Configuration } from "#compiled/@vercel/otel/index.js";

const require = createRequire(import.meta.url);

/**
 * Loads the vendored `@vercel/otel` registrar on first use.
 *
 * Registration is synchronous, so this uses `require` rather than a dynamic
 * import. Keeping the registrar out of the module graph is what lets a
 * self-hosted deployment run without ever loading Vercel code, which
 * `scripts/check-no-vercel-runtime.mjs` enforces.
 */
export function loadRegisterOTel(): (configuration: Configuration) => void {
  const otel = require("#compiled/@vercel/otel/index.js") as {
    registerOTel: (configuration: Configuration) => void;
  };
  return otel.registerOTel;
}
