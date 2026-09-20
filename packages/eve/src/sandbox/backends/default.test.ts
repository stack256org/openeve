import { afterEach, describe, expect, it, vi } from "vitest";

import { selectDefaultSandbox } from "#sandbox/backends/default.js";
import { SANDBOX_BACKEND_PROBES } from "#sandbox/backends/probes.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selectDefaultSandbox", () => {
  it("does not select the Vercel sandbox when no host is configured", () => {
    vi.stubEnv("VERCEL", "");
    expect(selectDefaultSandbox({}, SANDBOX_BACKEND_PROBES).name).not.toBe("vercel");
  });

  it("does not select the Vercel sandbox for a whitespace-only VERCEL value", () => {
    vi.stubEnv("VERCEL", "   ");
    expect(selectDefaultSandbox({}, SANDBOX_BACKEND_PROBES).name).not.toBe("vercel");
  });

  it("selects the Vercel sandbox when the environment names Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(selectDefaultSandbox({}, SANDBOX_BACKEND_PROBES).name).toBe("vercel");
  });
});
