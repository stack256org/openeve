/**
 * The published npm package name for the eve framework.
 *
 * This module is intentionally free of side effects and heavy imports so that
 * any layer can reference the package identity without pulling in filesystem
 * or module-resolution code.
 */
export const EVE_PACKAGE_NAME = "eve";

/**
 * The scoped name the framework is published under.
 *
 * Consumers install it aliased to {@link EVE_PACKAGE_NAME}
 * (`"eve": "npm:@stack256org/openeve@^x.y.z"`), so the install directory and
 * every import specifier still read `eve` while the installed manifest carries
 * this name. Code that identifies a `package.json` as the framework's must
 * accept both; code that emits an import specifier must emit
 * {@link EVE_PACKAGE_NAME}, because that is the only one that resolves.
 */
export const EVE_PUBLISHED_PACKAGE_NAME = "@stack256org/openeve";

/** Whether a `package.json` `name` identifies the framework package. */
export function isEvePackageName(name: unknown): boolean {
  return name === EVE_PACKAGE_NAME || name === EVE_PUBLISHED_PACKAGE_NAME;
}

/** Maps the framework's manifest name to the specifier that resolves for it. */
export function canonicalEvePackageName(name: string): string {
  return isEvePackageName(name) ? EVE_PACKAGE_NAME : name;
}
