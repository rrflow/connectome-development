import { queryOptions } from "@tanstack/react-query";
import { isRetryable, type RrdSessionClient } from "~/rrflow/session";
import { databaseQueryKey } from "./types";

/** Longest wait between asks while the engine reports itself busy. */
const MAX_BUSY_RETRY_MS = 8_000;
/** Attempts after an ordinary failure before a lens reports it. */
const FAILURE_RETRIES = 2;

/**
 * Retries for reads the engine may refuse while busy. Its diagnostic snapshot
 * gives up when requests landing during assembly keep changing it, and the
 * engine marks that refusal retryable: such reads are asked again, backing
 * off, until they succeed. Any other failure is retried twice, then shown.
 */
export const busyRetry = {
	retry: (failures: number, error: Error) => isRetryable(error) || failures < FAILURE_RETRIES,
	retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, MAX_BUSY_RETRY_MS),
};

/** The diagnostic snapshot both maps and the lens cards read; one per session. */
export function databaseQuery(client: RrdSessionClient, sessionKey: string) {
	return queryOptions({
		queryKey: databaseQueryKey(sessionKey),
		queryFn: () => client.database(),
		staleTime: Number.POSITIVE_INFINITY,
		...busyRetry,
	});
}
