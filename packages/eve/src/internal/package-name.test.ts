import { describe, expect, it } from "vitest";

import {
  canonicalEvePackageName,
  EVE_PACKAGE_NAME,
  EVE_PUBLISHED_PACKAGE_NAME,
  isEvePackageName,
} from "./package-name.js";

describe("isEvePackageName", () => {
  it("accepts the import specifier and the published name", () => {
    expect(isEvePackageName(EVE_PACKAGE_NAME)).toBe(true);
    expect(isEvePackageName(EVE_PUBLISHED_PACKAGE_NAME)).toBe(true);
  });

  it("rejects another package and a missing name", () => {
    expect(isEvePackageName("eve-catalog")).toBe(false);
    expect(isEvePackageName(undefined)).toBe(false);
  });
});

describe("canonicalEvePackageName", () => {
  it("maps the published name onto the specifier that resolves", () => {
    expect(canonicalEvePackageName(EVE_PUBLISHED_PACKAGE_NAME)).toBe(EVE_PACKAGE_NAME);
    expect(canonicalEvePackageName(EVE_PACKAGE_NAME)).toBe(EVE_PACKAGE_NAME);
  });

  it("leaves any other package name alone", () => {
    expect(canonicalEvePackageName("next")).toBe("next");
  });
});
