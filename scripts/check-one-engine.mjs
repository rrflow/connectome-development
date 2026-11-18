import assert from "node:assert/strict";
import {
	activity,
	agreement,
	axisHead,
	positions,
	probeKind,
	probeQuery,
	readEngine,
	unsyncedWrites,
} from "../src/features/runtime/engine/model.ts";

const metric = (id, value) => ({
	id,
	label: id,
	unit: "count",
	value,
	limit: null,
	cumulative: false,
});

function storage({
	head = 100,
	at = 1_000,
	physical = 500,
	durable = 500,
	flushes = 2,
	cld = undefined,
} = {}) {
	return {
		observed_at_unix_ms: at,
		change_head_cursor: head,
		oldest_retained_cursor: 1,
		query_indexes: [],
		physical: {
			observed_at_unix_ms: at,
			profile: "rrflow_kv",
			evidence_level: "measured",
			headline: [],
			groups: [
				{
					id: "sequences",
					label: "",
					notes: [],
					metrics: [
						metric("physical_sequence", physical),
						metric("durable_sequence", durable),
					],
				},
				{ id: "write_ahead_log", label: "", notes: [], metrics: [metric("payload", 4096)] },
				{
					id: "maintenance",
					label: "",
					notes: [],
					metrics: [
						metric("automatic_flushes", flushes),
						metric("automatic_compactions", 0),
					],
				},
			],
			cold_tier: cld,
		},
	};
}

const probe = (known) => ({
	view: { known_at_cursor: known },
	kind: "doc",
	roundTripMs: 3,
	atMs: 1,
});
const cld = (through, enabled = true) => ({
	enabled,
	pending: false,
	through_cursor: through,
	files: 3,
	stopped: null,
});

// Every part at the same change agrees, and the sentence says so.
{
	const reading = readEngine(storage({ cld: cld(100) }));
	const parts = positions(reading, probe(100), null);
	assert.deepEqual(
		Object.values(parts).map((part) => part.kind),
		["at", "at", "at", "at"],
	);
	assert.equal(agreement(parts, 100), "All four parts agree on change 100.");
}

// A lagging cold tier and an older query answer are measured against the head.
{
	const reading = readEngine(storage({ head: 120, cld: cld(100) }));
	const parts = positions(reading, probe(118), null);
	assert.deepEqual(parts.cld, { kind: "behind", cursor: 100, by: 20 });
	assert.deepEqual(parts.ql, { kind: "behind", cursor: 118, by: 2 });
	assert.match(
		agreement(parts, 120),
		/rrflowQL is 2 changes behind; rrflowCLD is 20 changes behind\./,
	);
}

// A query answered after the storage read is a newer head; nothing is falsely behind.
{
	const reading = readEngine(storage({ head: 120, cld: cld(120) }));
	assert.equal(axisHead(reading, probe(125)), 125);
	const parts = positions(reading, probe(125), null);
	assert.deepEqual(parts.db, { kind: "at", cursor: 125 });
	assert.deepEqual(parts.kv, { kind: "at", cursor: 125 });
	assert.deepEqual(parts.ql, { kind: "at", cursor: 125 });
}

// Missing parts are stated, never drawn as zero.
{
	const reading = readEngine(storage({ cld: cld(0, false) }));
	reading.kv.durableSequence = null;
	const parts = positions(reading, null, "rrflowQL refused the probe");
	assert.equal(parts.kv.kind, "unknown");
	assert.deepEqual(parts.ql, { kind: "unknown", reason: "rrflowQL refused the probe" });
	assert.deepEqual(parts.cld, { kind: "off", reason: "off for this installation" });
	assert.match(agreement(parts, 100), /3 parts have no position to show/);
	assert.equal(positions(readEngine(storage()), null, null).cld.kind, "unknown");
}

// Activity is the difference between two observations of one process.
{
	const before = readEngine(
		storage({ head: 100, at: 1_000, physical: 500, flushes: 2, cld: cld(90) }),
	);
	const after = readEngine(
		storage({ head: 112, at: 6_000, physical: 530, flushes: 3, cld: cld(100) }),
	);
	assert.deepEqual(activity(before, after), {
		seconds: 5,
		commits: 12,
		kvWrites: 30,
		walBytes: 0,
		flushes: 1,
		compactions: 0,
		cldCopied: 10,
	});
	// A restart resets counters; no rate is invented across it.
	const restarted = readEngine(storage({ head: 112, at: 7_000, physical: 3 }));
	assert.equal(activity(after, restarted), null);
	assert.equal(activity(undefined, after), null);
	assert.equal(activity(after, after), null);
}

// Unsynced writes are the gap between applied and durable sequences.
assert.equal(unsyncedWrites(readEngine(storage({ physical: 510, durable: 500 })).kv), 10);
assert.equal(unsyncedWrites(readEngine(storage({ physical: 500, durable: 500 })).kv), 0);

// The probe reads the most common plain kind and nothing it cannot quote.
{
	const node = (kind) => ({ kind });
	assert.equal(
		probeKind([
			node("a"),
			node("b"),
			node("b"),
			node("bad kind"),
			node("bad kind"),
			node("bad kind"),
		]),
		"b",
	);
	assert.equal(probeKind([node("z"), node("a")]), "a");
	assert.equal(probeKind([]), null);
	assert.equal(probeKind(undefined), null);
	assert.equal(
		probeQuery("source-tree-entry", 1700000000000),
		"FROM record:source-tree-entry AT VALID 1700000000000 KNOWN HEAD PROJECT * LIMIT 20",
	);
	assert.throws(() => probeQuery("a b", 1), /plain record kind/);
	assert.throws(() => probeQuery("a", 0), /time is invalid/);
}

console.log("one-engine model: OK");
