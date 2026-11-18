import type {
	RrdColdTierStateView,
	RrdMetricView,
	RrdNodeView,
	RrdPhysicalStorageView,
	RrdQueryView,
	RrdStorageView,
} from "~/rrflow/session";

/*
 * The engine view's model: rrflowDB, rrflowKV, rrflowQL and rrflowCLD read
 * from one storage observation and one live rrflowQL answer, placed on the
 * change cursor they share. Every number is the engine's; a part that did
 * not report is "not reported", never zero.
 */

export type PartId = "db" | "kv" | "ql" | "cld";

export type PartPosition =
	| { kind: "at"; cursor: number }
	| { kind: "behind"; cursor: number; by: number }
	| { kind: "off"; reason: string }
	| { kind: "unknown"; reason: string };

export interface KvReading {
	physicalSequence: number | null;
	durableSequence: number | null;
	walBytes: number | null;
	memtableKeys: number | null;
	memtableBytes: number | null;
	segments: number | null;
	segmentBytes: number | null;
	flushes: number | null;
	compactions: number | null;
}

export interface EngineReading {
	observedAtMs: number;
	/** rrflowDB's committed head on the change cursor. */
	head: number;
	oldestRetained: number | null;
	kv: KvReading;
	cld: RrdColdTierStateView | null;
	queryIndexes: number;
}

/** One rrflowQL answer, as Connectome asked for and timed it. */
export interface QueryProbe {
	view: RrdQueryView;
	kind: string;
	roundTripMs: number;
	atMs: number;
}

function metric(
	view: RrdPhysicalStorageView,
	group: string,
	id: string,
): RrdMetricView | undefined {
	return view.groups
		.find((candidate) => candidate.id === group)
		?.metrics.find((candidate) => candidate.id === id);
}

function number(view: RrdPhysicalStorageView, group: string, id: string): number | null {
	return metric(view, group, id)?.value ?? null;
}

export function readEngine(storage: RrdStorageView): EngineReading {
	const physical = storage.physical;
	return {
		observedAtMs: storage.observed_at_unix_ms,
		head: storage.change_head_cursor,
		oldestRetained: storage.oldest_retained_cursor,
		kv: {
			physicalSequence: number(physical, "sequences", "physical_sequence"),
			durableSequence: number(physical, "sequences", "durable_sequence"),
			walBytes: number(physical, "write_ahead_log", "payload"),
			memtableKeys: number(physical, "memtable", "keys"),
			memtableBytes: number(physical, "memtable", "approximate_bytes"),
			segments: number(physical, "segments", "segments"),
			segmentBytes: number(physical, "segments", "segment_bytes"),
			flushes: number(physical, "maintenance", "automatic_flushes"),
			compactions: number(physical, "maintenance", "automatic_compactions"),
		},
		cld: physical.cold_tier ?? null,
		queryIndexes: storage.query_indexes.length,
	};
}

export interface Activity {
	seconds: number;
	commits: number;
	kvWrites: number | null;
	walBytes: number | null;
	flushes: number | null;
	compactions: number | null;
	cldCopied: number | null;
}

function change(before: number | null, after: number | null): number | null {
	return before === null || after === null ? null : after - before;
}

/**
 * What changed between two observations of the same engine process. A
 * counter that went backwards means the engine restarted, so no rate is shown.
 */
export function activity(
	previous: EngineReading | undefined,
	current: EngineReading,
): Activity | null {
	if (!previous || current.observedAtMs <= previous.observedAtMs) return null;
	const kvWrites = change(previous.kv.physicalSequence, current.kv.physicalSequence);
	if (current.head < previous.head || (kvWrites !== null && kvWrites < 0)) return null;
	return {
		seconds: (current.observedAtMs - previous.observedAtMs) / 1000,
		commits: current.head - previous.head,
		kvWrites,
		walBytes: change(previous.kv.walBytes, current.kv.walBytes),
		flushes: change(previous.kv.flushes, current.kv.flushes),
		compactions: change(previous.kv.compactions, current.kv.compactions),
		cldCopied:
			previous.cld && current.cld
				? current.cld.through_cursor - previous.cld.through_cursor
				: null,
	};
}

function place(cursor: number, head: number): PartPosition {
	return cursor >= head ? { kind: "at", cursor } : { kind: "behind", cursor, by: head - cursor };
}

/** The furthest cursor any part has reported; the rail ends here. */
export function axisHead(reading: EngineReading, probe: QueryProbe | null): number {
	return Math.max(reading.head, probe?.view.known_at_cursor ?? 0);
}

export function positions(
	reading: EngineReading,
	probe: QueryProbe | null,
	probeError: string | null,
): Record<PartId, PartPosition> {
	const head = axisHead(reading, probe);
	const cld = reading.cld;
	return {
		// An rrflowQL answer at the head is itself a committed rrflowDB head, so
		// the newer of the two observations is rrflowDB's position.
		db: { kind: "at", cursor: head },
		// rrflowKV keeps its own sequence, not the change cursor; it holds the
		// head because every read of the head comes from it.
		kv:
			reading.kv.durableSequence === null
				? { kind: "unknown", reason: "rrflowKV reported no sequence" }
				: { kind: "at", cursor: head },
		ql: probe
			? place(probe.view.known_at_cursor, head)
			: { kind: "unknown", reason: probeError ?? "rrflowQL has not answered yet" },
		cld: !cld
			? { kind: "unknown", reason: "the engine did not report rrflowCLD" }
			: !cld.enabled
				? { kind: "off", reason: "off for this installation" }
				: place(cld.through_cursor, head),
	};
}

/** Writes rrflowKV has applied but not yet made durable. */
export function unsyncedWrites(kv: KvReading): number | null {
	return kv.physicalSequence === null || kv.durableSequence === null
		? null
		: Math.max(0, kv.physicalSequence - kv.durableSequence);
}

const KIND = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;

/** The record kind the engram holds most of, which a probe can always read. */
export function probeKind(nodes: readonly RrdNodeView[] | undefined): string | null {
	const counts = new Map<string, number>();
	for (const node of nodes ?? []) {
		if (KIND.test(node.kind)) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
	}
	let best: string | null = null;
	for (const [kind, count] of counts) {
		if (
			best === null ||
			count > (counts.get(best) ?? 0) ||
			(count === counts.get(best) && kind < best)
		)
			best = kind;
	}
	return best;
}

export const PROBE_LIMIT = 20;

/** A bounded read at the head, so its answer says which cursor rrflowQL saw. */
export function probeQuery(kind: string, validAtMs: number): string {
	if (!KIND.test(kind)) throw new Error("The probe kind is not a plain record kind");
	if (!Number.isSafeInteger(validAtMs) || validAtMs <= 0)
		throw new Error("The probe time is invalid");
	return `FROM record:${kind} AT VALID ${validAtMs} KNOWN HEAD PROJECT * LIMIT ${PROBE_LIMIT}`;
}

/** One sentence about all four parts, from the positions alone. */
export function agreement(parts: Record<PartId, PartPosition>, head: number): string {
	const behind = (Object.entries(parts) as [PartId, PartPosition][]).filter(
		([, position]) => position.kind === "behind",
	);
	const missing = (Object.values(parts) as PartPosition[]).filter(
		(position) => position.kind === "unknown" || position.kind === "off",
	).length;
	if (behind.length === 0 && missing === 0)
		return `All four parts agree on change ${head.toLocaleString()}.`;
	const names: Record<PartId, string> = {
		db: "rrflowDB",
		kv: "rrflowKV",
		ql: "rrflowQL",
		cld: "rrflowCLD",
	};
	const lagging = behind.map(([id, position]) =>
		position.kind === "behind"
			? `${names[id]} is ${position.by.toLocaleString()} ${position.by === 1 ? "change" : "changes"} behind`
			: "",
	);
	const summary = lagging.length > 0 ? `${lagging.join("; ")}.` : "";
	const unknown =
		missing > 0
			? ` ${missing} ${missing === 1 ? "part has" : "parts have"} no position to show.`
			: "";
	return `The head is change ${head.toLocaleString()}. ${summary}${unknown}`.trim();
}
