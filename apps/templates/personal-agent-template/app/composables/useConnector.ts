import { getErrorStatus, getSetupStatus } from "#shared/utils/status";
import type { ConnectorSummary } from "#shared/types/connector";

/**
 * Test action and derived UI state for one connector row.
 */
export function useConnector(connector: () => ConnectorSummary, onRefresh?: () => void) {
  const testing = ref(false);
  const showTestResults = ref(false);
  const testResults = ref<string[] | null>(null);
  const actionError = ref<string | null>(null);

  const id = computed(() => connector().id);
  const status = computed(() => connectorStatusLabel(connector().status.state));

  const isConnected = computed(() => connector().status.state === "connected");
  const needsSetup = computed(() => connector().status.state === "setup_required");
  const setupStatus = computed(() => getSetupStatus(connector().status));
  const errorStatus = computed(() => getErrorStatus(connector().status));
  const hintLines = computed(() => setupStatus.value?.hint?.split("\n").filter(Boolean) ?? []);

  const parsedResults = computed(() =>
    (testResults.value ?? []).map((line) => parseTestResult(line)),
  );

  const resultsHeading = computed(() => testResultsHeading(connector().id));

  async function test() {
    testing.value = true;
    actionError.value = null;
    testResults.value = null;
    showTestResults.value = false;
    try {
      const { results } = await $fetch<{ results: string[] }>(
        `/api/integrations/${id.value}/test`,
        {
          method: "POST",
        },
      );
      testResults.value = results;
      showTestResults.value = true;
      onRefresh?.();
    } catch (error) {
      actionError.value = getFetchErrorMessage(error);
    } finally {
      testing.value = false;
    }
  }

  function clearResults() {
    testResults.value = null;
    showTestResults.value = false;
  }

  return {
    status,
    isConnected,
    needsSetup,
    setupStatus,
    errorStatus,
    hintLines,
    testing,
    showTestResults,
    testResults,
    actionError,
    parsedResults,
    resultsHeading,
    test,
    clearResults,
  };
}
