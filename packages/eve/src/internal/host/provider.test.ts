import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveHostProvider } from "#internal/host/provider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveHostProvider", () => {
  it("defaults to self with no configuration and no environment", () => {
    vi.stubEnv("VERCEL", "");
    expect(resolveHostProvider()).toBe("self");
  });

  it("honours an authored host over the environment", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveHostProvider("self")).toBe("self");
  });

  it("falls back to vercel when the environment says so and nothing is authored", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveHostProvider()).toBe("vercel");
  });

  it("treats a whitespace-only VERCEL value as unset", () => {
    vi.stubEnv("VERCEL", "   ");
    expect(resolveHostProvider()).toBe("self");
  });
});
