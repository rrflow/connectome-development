import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { RrdLiveEventView, RrdSessionClient } from "~/rrflow/session";
import { databaseQueryKey } from "../types";

/**
 * Changes landing within this window become one step. Research on dynamic
 * graphs favours staged change over continuous motion, and each step costs a
 * full read of the graph.
 */
const BATCH_MS = 2_000;
/** Steps kept for the activity list. */
const HISTORY_LIMIT = 20;
/** How long the records of the latest step stay marked on the graph. */
const CHANGED_MARK_MS = 8_000;

const NONE: ReadonlySet<string> = new Set();

export interface LiveBatch {
	throughCursor: number;
	atUnixMs: number;
	/** `kind:id` of each record or relation the step changed. */
	targets: string[];
}

export type LiveStatus =
	| { state: "connecting" }
	| { state: "live" }
	| { state: "stopped"; reason: string };

export interface LiveChanges {
	status: LiveStatus;
	/** Newest first. */
	batches: LiveBatch[];
	/** What the latest step changed, while it is still marked. */
	changed: ReadonlySet<string>;
}

/**
 * Follows the engine's change stream while the caller is mounted and refreshes
 * the graph after each batch. An idle engine sends nothing and costs nothing.
 */
export function useLiveChanges(client: RrdSessionClient, sessionKey: string): LiveChanges {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<LiveStatus>({ state: "connecting" });
	const [batches, setBatches] = useState<LiveBatch[]>([]);
	const [changed, setChanged] = useState<ReadonlySet<string>>(NONE);

	useEffect(() => {
		let active = true;
		let handle: string | null = null;
		let pending: string[] = [];
		let throughCursor = 0;
		let flushTimer: ReturnType<typeof setTimeout> | undefined;
		let markTimer: ReturnType<typeof setTimeout> | undefined;

		const refresh = () =>
			queryClient.invalidateQueries({ queryKey: databaseQueryKey(sessionKey) });

		const flush = () => {
			flushTimer = undefined;
			const targets = [...new Set(pending)];
			pending = [];
			setBatches((current) =>
				[{ throughCursor, atUnixMs: Date.now(), targets }, ...current].slice(
					0,
					HISTORY_LIMIT,
				),
			);
			setChanged(new Set(targets));
			clearTimeout(markTimer);
			markTimer = setTimeout(() => setChanged(NONE), CHANGED_MARK_MS);
			void refresh();
		};

		const onEvent = (event: RrdLiveEventView) => {
			if (!active) return;
			if (event.event === "subscribed") {
				setStatus({ state: "live" });
				// These attachments cannot show that nothing changed in the gap.
				if (event.reason === "reconnected" || event.reason === "replaced") void refresh();
			} else if (event.event === "changes") {
				pending.push(...event.page.changes.map((change) => change.mutation.target));
				throughCursor = event.through_cursor;
				flushTimer ??= setTimeout(flush, BATCH_MS);
			} else if (event.event === "ended") {
				setStatus({
					state: "stopped",
					reason: event.message ?? "The live connection was closed.",
				});
			}
		};

		client.openLive({ kind: "changes" }, onEvent).then(
			(view) => {
				if (active) handle = view.handle;
				else void client.closeLive(view.handle).catch(() => undefined);
			},
			(error: unknown) => {
				if (active) {
					setStatus({
						state: "stopped",
						reason: error instanceof Error ? error.message : String(error),
					});
				}
			},
		);

		return () => {
			active = false;
			clearTimeout(flushTimer);
			clearTimeout(markTimer);
			if (handle) void client.closeLive(handle).catch(() => undefined);
		};
	}, [client, sessionKey]);

	return { status, batches, changed };
}
