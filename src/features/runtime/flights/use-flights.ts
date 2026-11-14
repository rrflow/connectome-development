import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useProject } from "../project/context";

/** Flights are recorded while prompts run, so the list follows the engine. */
export const FLIGHTS_REFRESH_MS = 10_000;

/**
 * One page of the engine's prompt flights, in the order the engine returns
 * them. The cache keys are the workbench's, so both show the same reads.
 */
export function useFlightPage() {
	const { client, session, sessionKey } = useProject();
	const [page, setPage] = useState({ sessionKey, cursor: 0 });
	const afterCursor = page.sessionKey === sessionKey ? page.cursor : 0;
	const snapshot = useQuery({
		queryKey: ["rrd-workbench-snapshot", sessionKey, afterCursor],
		queryFn: () => client.workbenchSnapshot(afterCursor),
		enabled: Boolean(session),
		refetchInterval: FLIGHTS_REFRESH_MS,
	});
	const last = snapshot.data?.flights.at(-1);
	return {
		snapshot,
		afterCursor,
		/** Opens the page after this one, when the engine said there is more. */
		next:
			snapshot.data?.truncated && last
				? () => setPage({ sessionKey, cursor: last.flight_cursor })
				: null,
		first: afterCursor === 0 ? null : () => setPage({ sessionKey, cursor: 0 }),
	};
}

export type FlightPage = ReturnType<typeof useFlightPage>;

/** The flight a person picked, forgotten when the session changes. */
export function useFlightSelection(fallback: string | null) {
	const { sessionKey } = useProject();
	const [selection, setSelection] = useState<{ sessionKey: string; id: string } | null>(null);
	const selected = selection?.sessionKey === sessionKey ? selection.id : fallback;
	return [selected, (id: string) => setSelection({ sessionKey, id })] as const;
}

/** Everything the engine recorded for one flight. */
export function useFlightDetail(flightId: string | null) {
	const { client, session, sessionKey } = useProject();
	return useQuery({
		queryKey: ["rrd-prompt-flight", sessionKey, flightId],
		queryFn: () => {
			if (flightId === null) throw new Error("No flight selected");
			return client.readPromptFlight({ flight_id: flightId });
		},
		enabled: Boolean(session) && flightId !== null,
		refetchInterval: FLIGHTS_REFRESH_MS,
	});
}
