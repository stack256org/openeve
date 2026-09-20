import type { ConnectorSummary } from "#shared/types/connector";

/**
 * Loads connector summaries. Each integration reads its token from the
 * environment, so a summary changes only when the server restarts with a
 * different environment — there is no in-app connect flow to return from.
 */
export function useConnectors() {
  const {
    data: connectors,
    pending,
    error,
    refresh,
  } = useFetch<ConnectorSummary[]>("/api/connectors", {
    server: false,
    ...payloadCacheOptions,
  });

  const isInitialLoad = computed(() => pending.value && !connectors.value);

  return {
    connectors,
    pending,
    error,
    refresh,
    isInitialLoad,
  };
}
