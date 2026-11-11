import type { RrdQueryView, RrdSessionClient } from "~/rrflow/session";

/** A single accepted Inventory checkpoint, not a claim about the current source. */
export interface InventoryCheckpoint {
	jobId: string;
	digest: string;
	cursor: string;
	validAt: string;
	laterJobsNotScanned: boolean;
}

export interface InventoryNode {
	id: string;
	kind: "source-tree-snapshot" | "source-tree-entry";
	key: string;
	label: string;
}
export interface InventoryEdge {
	id: string;
	from: string;
	to: string;
}
export interface InventoryNeighborhood {
	nodes: InventoryNode[];
	edges: InventoryEdge[];
	/** A query LIMIT or engine truncation may have left additional relations. */
	mayHaveMore: boolean;
	keysExamined: number;
}

type Client = Pick<RrdSessionClient, "attunement" | "query">;
const DIGEST = /^[0-9a-f]{64}$/;
const U64_MAX = 18446744073709551615n;
const LABEL_CONCURRENCY = 4;
/** View bounds limit network work; the engine's configured budget remains authoritative. */
export const INVENTORY_LIMITS = [20, 40, 80] as const;

function decimal(value: string): string {
	if (!/^[1-9][0-9]*$/.test(value) || BigInt(value) > U64_MAX)
		throw new Error("Inventory checkpoint has invalid coordinates");
	return value;
}
function digest(value: string): string {
	if (!DIGEST.test(value)) throw new Error("Inventory identity is invalid");
	return value;
}
function atCheckpoint(result: RrdQueryView, checkpoint: InventoryCheckpoint): void {
	if (
		!Number.isSafeInteger(result.known_at_cursor) ||
		String(result.known_at_cursor) !== checkpoint.cursor
	)
		throw new Error("Engine query did not return the requested checkpoint cursor");
}
function context(checkpoint: InventoryCheckpoint): string {
	return `AT VALID ${decimal(checkpoint.validAt)} KNOWN ${decimal(checkpoint.cursor)}`;
}
function traversal(
	checkpoint: InventoryCheckpoint,
	kind: InventoryNode["kind"],
	key: string,
	limit: number,
): string {
	if (!INVENTORY_LIMITS.includes(limit as (typeof INVENTORY_LIMITS)[number]))
		throw new Error("Inventory view limit is invalid");
	return `FROM traverse:source-tree-contains START ${kind}:${JSON.stringify(digest(key))} DIRECTION OUTGOING DEPTH 1 ${context(checkpoint)} PROJECT from_id, from_kind, to_id, to_kind, relation_id, relation_kind LIMIT ${limit}`;
}
function recordQuery(checkpoint: InventoryCheckpoint, key: string): string {
	return `FROM record:source-tree-entry ${context(checkpoint)} WHERE id = ${JSON.stringify(digest(key))} PROJECT id, path, kind`;
}

/** Reads a bounded job page and follows the newest returned job with an Inventory checkpoint. */
export async function inventoryCheckpoint(client: Client): Promise<InventoryCheckpoint | null> {
	const page = await client.attunement({ action: "list", after_job_id: null });
	if (page.kind !== "page") throw new Error("Unexpected job discovery response");
	for (const summary of [...page.page.jobs].reverse()) {
		if (summary.checkpoint_count === "0") continue;
		const read = await client.attunement({ action: "read", job_id: summary.job_id });
		if (read.kind !== "snapshot") throw new Error("Unexpected job read response");
		if (read.snapshot.status.job.id !== summary.job_id)
			throw new Error("Job read did not match discovery");
		const checkpoint = [...read.snapshot.status.job.checkpoints]
			.reverse()
			.find((item) => item.phase === "inventory");
		if (checkpoint)
			return {
				jobId: summary.job_id,
				digest: digest(checkpoint.output_sha256),
				cursor: decimal(checkpoint.coordinates.runtime_cursor),
				validAt: decimal(checkpoint.committed_at_unix_ms),
				laterJobsNotScanned: Boolean(page.page.next_after_job_id),
			};
	}
	return null;
}

function rowEdge(
	row: RrdQueryView["rows"][number],
	fromKind: InventoryNode["kind"],
	fromKey: string,
): InventoryEdge & { target: string } {
	const value = row.values;
	if (
		value.from_kind !== fromKind ||
		value.from_id !== fromKey ||
		value.to_kind !== "source-tree-entry" ||
		value.relation_kind !== "source-tree-contains" ||
		!value.relation_id ||
		value.relation_id.length > 256
	)
		throw new Error("Inventory traversal returned an unexpected relation");
	const target = digest(value.to_id ?? "");
	return {
		id: value.relation_id,
		from: `${fromKind}:${fromKey}`,
		to: `source-tree-entry:${target}`,
		target,
	};
}

/** The root is discovered through the committed snapshot relation, not a scan. */
export async function inventoryRoot(
	client: Client,
	checkpoint: InventoryCheckpoint,
): Promise<string> {
	const result = await client.query(
		traversal(checkpoint, "source-tree-snapshot", checkpoint.digest, 20),
	);
	atCheckpoint(result, checkpoint);
	if (result.truncated || result.rows.length !== 1)
		throw new Error("Inventory checkpoint root is missing or incomplete");
	return rowEdge(result.rows[0], "source-tree-snapshot", checkpoint.digest).target;
}

async function entryLabel(
	client: Client,
	checkpoint: InventoryCheckpoint,
	id: string,
): Promise<string> {
	const result = await client.query(recordQuery(checkpoint, id));
	atCheckpoint(result, checkpoint);
	if (result.truncated || result.rows.length !== 1 || result.rows[0].values.id !== id)
		throw new Error("Inventory record is missing or incomplete at the checkpoint");
	const path = result.rows[0].values.path;
	if (typeof path !== "string") throw new Error("Inventory record path is unavailable");
	return path || "Project root";
}

/** Reads one authorized neighborhood and bounded record labels at the same stamp. */
export async function inventoryNeighborhood(
	client: Client,
	checkpoint: InventoryCheckpoint,
	selected: string,
	limit: number,
): Promise<InventoryNeighborhood> {
	digest(selected);
	const result = await client.query(traversal(checkpoint, "source-tree-entry", selected, limit));
	atCheckpoint(result, checkpoint);
	if (result.rows.length > limit) throw new Error("Inventory traversal exceeded its view bound");
	const seen = new Set<string>();
	const edges = result.rows.map((row) => {
		const edge = rowEdge(row, "source-tree-entry", selected);
		if (seen.has(edge.id)) throw new Error("Inventory traversal repeated a relationship");
		seen.add(edge.id);
		return edge;
	});
	const ids = [...new Set([selected, ...edges.map((edge) => edge.target)])];
	const labels = new Map<string, string>();
	for (let i = 0; i < ids.length; i += LABEL_CONCURRENCY) {
		const chunk = ids.slice(i, i + LABEL_CONCURRENCY);
		const values = await Promise.all(chunk.map((id) => entryLabel(client, checkpoint, id)));
		chunk.forEach((id, index) => {
			labels.set(id, values[index]);
		});
	}
	return {
		nodes: ids.map((id) => ({
			id: `source-tree-entry:${id}`,
			kind: "source-tree-entry",
			key: id,
			label: labels.get(id) ?? id,
		})),
		edges: edges.map(({ id, from, to }) => ({ id, from, to })),
		mayHaveMore: result.truncated || result.rows.length === limit,
		keysExamined: result.keys_examined,
	};
}
