/**
 * An integration test failure with a message that is safe to show the operator.
 * Anything else reaching `throwIntegrationError` is reported generically so a
 * stack trace, hostname, or token fragment never reaches the browser.
 */
export class IntegrationTestError extends Error {}

export function throwIntegrationError(error: unknown): never {
  if (error instanceof IntegrationTestError) {
    throw createError({
      statusCode: 502,
      statusMessage: "Integration error",
      message: error.message,
    });
  }

  console.error("Integration test failed", error);

  throw createError({
    statusCode: 502,
    statusMessage: "Request failed",
    message: "The integration test failed. Check the server logs for details.",
  });
}
