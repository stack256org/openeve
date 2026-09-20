import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HOST_PROVIDER_ENV,
  installHostProvider,
  resolveHostProvider,
} from "#internal/host/provider.js";

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

describe("installHostProvider", () => {
  it("makes an authored self host win over a Vercel environment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv(HOST_PROVIDER_ENV, "");
    installHostProvider("self");
    expect(resolveHostProvider()).toBe("self");
  });

  it("makes an authored vercel host win over an absent environment", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv(HOST_PROVIDER_ENV, "");
    installHostProvider("vercel");
    expect(resolveHostProvider()).toBe("vercel");
  });

  it("leaves the environment in charge when nothing was authored", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv(HOST_PROVIDER_ENV, "");
    installHostProvider(undefined);
    expect(resolveHostProvider()).toBe("vercel");
  });

  it("still lets an explicit argument win over an installed host", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv(HOST_PROVIDER_ENV, "");
    installHostProvider("vercel");
    expect(resolveHostProvider("self")).toBe("self");
  });

  it("ignores an installed value that names no known host", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv(HOST_PROVIDER_ENV, "fly");
    expect(resolveHostProvider()).toBe("vercel");
  });
});
