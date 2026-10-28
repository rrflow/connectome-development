import { Channel, type InvokeArgs, invoke, isTauri } from "@tauri-apps/api/core";

/*
 * Authenticated RRD session views.
 *
 * RRFlow's Rust SDK (`rrd-client` + `rrd-contract`) owns every RRD wire type
 * and validates each response inside the Tauri process. These interfaces are
 * Connectome view models: the bounded projections `src-tauri/src/rrd/view.rs`
 * serializes for the Database, Vectors, and Storage lenses, and those its
 * `effect` and `history` modules serialize for changes, backups, exports, the
 * changefeed and the audit chain. The operator credential and the session
 * bearer never cross into the webview; a pending change and a held export
 * cross only as opaque handles.
 */

export interface RrdReference {
	kind: string;
	id: string;
}

/**
 * The session policy the engine granted. The native client renews the session
 * before the idle limit passes and opens a new one before the absolute limit,
 * timed on its own monotonic clock, so no expiry instant crosses the boundary.
 */
export interface RrdSessionView {
	idle_timeout_ms: number;
	absolute_timeout_ms: number;
}

export interface RrdCapabilityView {
	name: string;
	contract_version: number;
	status: string;
	limitation: string | null;
}

export interface RrdInstalledEstateView {
	project_id: string;
	estate_id: string;
	instance_id: string;
}

export interface RrdServiceView {
	implementation: string;
	implementation_version: string;
	instance: string;
	deployment_form: string;
	storage_profile: string;
	endpoint_presentation: string;
	installed_estate: RrdInstalledEstateView | null;
	configuration_revision: number;
	configuration_sha256: string;
	capabilities: RrdCapabilityView[];
}

export interface RrdConnectionView {
	endpoint: string;
	instance: string;
	principal: string;
	connected_at_unix_ms: number;
	session: RrdSessionView;
	service: RrdServiceView;
}

export interface RrdSchemaView {
	known_at_cursor: number;
	read_manifest_sha256: string;
	schema_revision: number | null;
	truncated: boolean;
	tables: {
		name: string;
		model: string;
		mode: string;
		properties: Record<string, unknown>;
		additional_properties: boolean;
	}[];
}

export interface RrdTableView {
	name: string;
	model: string;
	mode: string;
}

export interface RrdModelView {
	id: string;
	kind: string;
	property_count: number;
	required_property_count: number;
	constraint_count: number;
}

export interface RrdNodeView {
	id: string;
	kind: string;
	key: string;
	label: string;
	valid_from_unix_ms: number;
	properties: Record<string, string>;
	/** Index into `RrdGraphView.clusters`. */
	cluster: number;
}

/**
 * A group of records linked more densely to each other than to the rest of
 * the estate. Connectome computes clusters from the relations to color the
 * graph; they are not estate data.
 */
export interface RrdClusterView {
	id: number;
	size: number;
	/** The member with the most relations, which names the cluster. */
	anchor: string;
	label: string;
}

export interface RrdEdgeView {
	id: string;
	kind: string;
	from: string;
	to: string;
}

export interface RrdGraphView {
	valid_at_unix_ms: number;
	known_at_cursor: number;
	nodes: RrdNodeView[];
	edges: RrdEdgeView[];
	/** Largest first. */
	clusters: RrdClusterView[];
}

export interface RrdSectionView {
	id: string;
	authority: string;
	coverage: string;
	row_count: number;
	known_at_cursor: number;
}

export interface RrdDatabaseView {
	observed_at_unix_ms: number;
	runtime_cursor: number;
	schema_revision: number | null;
	tables: RrdTableView[];
	models: RrdModelView[];
	graph: RrdGraphView;
	sections: RrdSectionView[];
}

export interface RrdQueryRowView {
	identity: string;
	values: Record<string, string>;
}

export interface RrdQueryView {
	canonical_query: string;
	known_at_cursor: number;
	schema_revision: number;
	columns: string[];
	rows: RrdQueryRowView[];
	returned_rows: number;
	truncated: boolean;
	keys_examined: number;
	output_bytes: number;
}

export interface RrdNamedVectorView {
	name: string;
	field: string;
	kind: string;
	dimensions: number;
	metric: string;
	memory_tier: string;
	embedding_model: string | null;
	embedding_model_digest: string | null;
}

export interface RrdCollectionView {
	collection_id: string;
	generation: number;
	updated_at_unix_ms: number;
	configuration_sha256: string;
	payload_indexes: number;
	vectors: RrdNamedVectorView[];
}

export interface RrdVectorCollectionsView {
	revision: number;
	collections: RrdCollectionView[];
}

export interface RrdPointView {
	reference: RrdReference;
	subject: RrdReference;
	source_cursor: number;
	value_kind: string;
	dimensions: number;
	norm: number;
	preview: number[];
	payload: Record<string, string>;
}

export interface RrdVectorPointsView {
	collection_id: string;
	vector_name: string;
	known_at_cursor: number;
	keys_examined: number;
	points: RrdPointView[];
	next_after: RrdReference | null;
	truncated: boolean;
}

export interface RrdHitView {
	reference: RrdReference;
	subject: RrdReference;
	score: number;
	source_cursor: number;
}

export interface RrdVectorSearchView {
	query: RrdReference;
	access_path: string;
	exact: boolean;
	known_at_cursor: number;
	keys_examined: number;
	canonical_candidates: number;
	selected_candidates: number;
	loaded_artifact_bytes: number;
	hits: RrdHitView[];
}

export interface RrdMapPointView {
	reference: RrdReference;
	subject: RrdReference;
}

export interface RrdMapLinkView {
	/** Indexes into `RrdVectorMapView.points`; `to` is among `from`'s nearest. */
	from: number;
	to: number;
	/** 1 for the nearest neighbour. */
	rank: number;
	score: number;
}

/** Every drawn point with its nearest neighbours from the engine's exact search. */
export interface RrdVectorMapView {
	collection_id: string;
	vector_name: string;
	points: RrdMapPointView[];
	links: RrdMapLinkView[];
	/** Neighbours requested for each point. */
	neighbours: number;
	/** The collection holds more points than the map draws. */
	truncated: boolean;
	/** Points whose value kind cannot be searched by example. */
	unsearchable: number;
	searches: number;
	exact: boolean;
	keys_examined: number;
	known_at_cursor_min: number;
	known_at_cursor_max: number;
	elapsed_ms: number;
}

/** Progress of a similarity-map build, streamed while its searches run. */
export interface RrdVectorMapProgressView {
	/** Exact searches finished. */
	searched: number;
	/** Exact searches the map needs: one per searchable point. */
	total: number;
	/**
	 * The points the map draws, sent once with the first message, so a lens can
	 * resolve its records to points before the searches finish.
	 */
	points: RrdMapPointView[] | null;
	/** The collection holds more points than the map draws. */
	truncated: boolean;
}

export interface RrdVectorArtifactView {
	kind: string;
	projection_id: string;
	generation: number;
	source_cursor: number;
	object_length: number;
	media_type: string;
	published_at_unix_ms: number;
}

export interface RrdQueryIndexView {
	index_id: string;
	kind: string;
	state: string;
	generation: number;
	artifact_rows: number | null;
	definition_query: string;
}

export type RrdMetricUnit = "count" | "bytes" | "ratio";

export interface RrdMetricView {
	id: string;
	label: string;
	unit: RrdMetricUnit;
	value: number;
	/** Ceiling for a fill gauge, such as a cache capacity or a flush trigger. */
	limit: number | null;
	/** Cumulative since the engine process opened its store. */
	cumulative: boolean;
}

export interface RrdMetricGroupView {
	id: string;
	label: string;
	metrics: RrdMetricView[];
	notes: string[];
}

/** The engine's process-local storage observation; not part of the read stamp. */
export interface RrdPhysicalStorageView {
	observed_at_unix_ms: number;
	profile: string;
	evidence_level: string;
	headline: RrdMetricView[];
	groups: RrdMetricGroupView[];
}

export interface RrdStorageView {
	observed_at_unix_ms: number;
	storage_profile: string;
	backend: string;
	runtime_cursor: number;
	claim_sequence: number;
	control_sequence: number;
	catalogue_revision: number;
	schema_revision: number | null;
	runtime_manifest_sha256: string;
	change_head_cursor: number;
	oldest_retained_cursor: number | null;
	retention_leases: number;
	retention_pins: number;
	vector_artifacts: RrdVectorArtifactView[];
	query_indexes: RrdQueryIndexView[];
	physical: RrdPhysicalStorageView;
}

/**
 * One contract mutation as the webview proposes it, such as
 * `{ mutation: "put_record", reference, valid_from, properties }`. The native
 * process validates it against `rrd-contract` before anything reaches the
 * engine; the value model that types it is generated in a later step.
 */
export interface RrdMutation {
	mutation: string;
	[field: string]: unknown;
}

/** What one mutation writes, as a preview or a change row renders it. */
export interface RrdMutationView {
	/** The mutation's wire name, such as `put_record` or `retire_data`. */
	operation: string;
	/** `kind:id` for a record or relation; the event kind; `schema`. */
	target: string;
	/** A relation's `from → to`, or the subject the mutation attaches to. */
	subject: string | null;
	properties: Record<string, string>;
}

/** The read-your-writes snapshot behind a preview: its read stamp and size. */
export interface RrdProspectiveView {
	valid_at_unix_ms: number;
	known_at_cursor: number;
	schema_revision: number;
	read_manifest_sha256: string;
	selected_versions: number;
	keys_examined: number;
	entries: number;
}

/**
 * A previewed change waiting for the operator. Commit it with `handle` and the
 * `operation_sha256` shown; the native process commits exactly the previewed
 * mutations. A newer preview on the same connection replaces it.
 */
export interface RrdChangePreviewView {
	handle: string;
	operation_sha256: string;
	read_cursor: number;
	mutations: RrdMutationView[];
	prospective: RrdProspectiveView;
	timeout_ms: number;
}

export interface RrdCommitReceiptView {
	operation_sha256: string;
	mutation_count: number;
	first_claim_sequence: number;
	last_claim_sequence: number;
	runtime_commit_sha256: string | null;
	first_runtime_cursor: number | null;
	last_runtime_cursor: number | null;
	/** The engine answered with the receipt of a commit it had already made. */
	idempotent_replay: boolean;
}

export interface RrdChangeView {
	cursor: number;
	commit_sha256: string;
	commit_ordinal: number;
	at_unix_ms: number;
	actor: string;
	family: "data" | "claim";
	mutation: RrdMutationView;
	change_sha256: string;
	previous_change_sha256: string | null;
}

export interface RrdChangesView {
	requested_after_cursor: number;
	through_cursor: number;
	head_cursor: number;
	has_more: boolean;
	validation_method: string;
	change_reads: number;
	proof_nodes: number;
	changes: RrdChangeView[];
}

export interface RrdChangesFollowView {
	/** No change arrived before the wait ended. */
	timed_out: boolean;
	waited_ms: number;
	page: RrdChangesView;
}

export interface RrdAuditRecordView {
	sequence: number;
	at_unix_ms: number;
	principal: string | null;
	/** The security action, such as `transaction_commit`. */
	action: string;
	/** `kind:id` segments joined by `/`. */
	resource: string;
	request_id: string;
	operation_id: string;
	phase: "authorized" | "completed";
	decision: "allowed" | "denied" | "failed";
	status_code: number;
	audit_sha256: string;
	previous_audit_sha256: string | null;
}

export interface RrdAuditView {
	requested_after_sequence: number;
	through_sequence: number;
	chain_anchor_sha256: string | null;
	chain_head_sha256: string | null;
	records: RrdAuditRecordView[];
}

export interface RrdArchiveView {
	archive_sha256: string;
	action_count: number;
	standalone_claims: number;
	runtime_commits: number;
	runtime_mutations: number;
	payload_bytes: number;
	claim_sequence: number;
	runtime_cursor: number;
}

/** How a backup carries one family of estate state. */
export interface RrdCoverageView {
	family: string;
	coverage: "included" | "referenced_only" | "rebuild_required" | "excluded";
}

export interface RrdBackupView {
	backup_sha256: string;
	label: string;
	created_at_unix_ms: number;
	application_complete: boolean;
	archive: RrdArchiveView;
	coverage: RrdCoverageView[];
}

export interface RrdBackupsView {
	revision: number;
	catalogue_sha256: string;
	archives_verified: boolean;
	backups: RrdBackupView[];
}

export interface RrdBackupCreatedView {
	backup: RrdBackupView;
	catalogue_revision: number;
	catalogue_sha256: string;
	idempotent_replay: boolean;
}

/** A backup restored into its own verified root; the estate is not replaced. */
export interface RrdRestoreView {
	backup_sha256: string;
	restore_id: string;
	inventory: RrdArchiveView;
	reopened: boolean;
	idempotent_replay: boolean;
}

/** A verified export the native process holds until it is saved. */
export interface RrdArtifactView {
	handle: string;
	media_type: string;
	file_name: string;
	bytes: number;
	sha256: string;
}

export interface RrdQueryExportView {
	artifact: RrdArtifactView;
	profile: string;
	canonical_query: string;
	known_at_cursor: number;
	schema_revision: number;
	read_manifest_sha256: string;
	rows: number;
	columns: number;
	row_groups: number;
	elapsed_micros: number;
}

export interface RrdAuditExportView {
	artifact: RrdArtifactView;
	requested_after_sequence: number;
	through_sequence: number;
	record_count: number;
	chain_anchor_sha256: string | null;
	chain_head_sha256: string | null;
}

export interface RrdSavedArtifactView {
	path: string;
	bytes: number;
	sha256: string;
}

/** What a live subscription follows. */
export type RrdLiveStream = { kind: "changes" } | { kind: "query"; query: string };

export interface RrdLiveView {
	handle: string;
	stream: "changes" | "query";
	/** The cursor the subscription delivers after. */
	after_cursor: number;
	/** A live query's first result, read at `after_cursor`, when opened without a cursor. */
	first: RrdQueryView | null;
}

export interface RrdRowChangeView {
	before: RrdQueryRowView;
	after: RrdQueryRowView;
}

/**
 * Why a subscription was attached to a connection: first opened, resumed after
 * a lost connection or a session renewal, or continued by a new subscription
 * after the session was replaced.
 */
export type RrdLiveAttachment = "opened" | "reconnected" | "renewed" | "replaced";

/**
 * One live event, in cursor order. A change never repeats; after a reconnect a
 * live-query delta can overlap the one before it, so rows apply by identity.
 */
export type RrdLiveEventView =
	| {
			event: "subscribed";
			reason: RrdLiveAttachment;
			generation: number;
			acknowledged_cursor: number;
			head_cursor: number;
	  }
	| { event: "changes"; from_cursor: number; through_cursor: number; page: RrdChangesView }
	| {
			event: "rows";
			from_cursor: number;
			through_cursor: number;
			head_cursor: number;
			added: RrdQueryRowView[];
			updated: RrdRowChangeView[];
			removed: RrdQueryRowView[];
	  }
	/** Closed by the operator (`message` is null) or stopped by a failure. */
	| { event: "ended"; message: string | null; retryable: boolean };

export interface RrdConnectRequest {
	/** Loopback HTTP origin of the RRD service. */
	endpoint: string;
	/** Instance identity confirmed by the public capability handshake. */
	instance: string;
	/** Installed operator credential file; read only by the native process. */
	credential_path: string;
}

export interface RrdVectorPointsRequest {
	collection_id: string;
	vector_name: string;
	after: RrdReference | null;
	limit: number;
}

export interface RrdVectorMapRequest {
	collection_id: string;
	vector_name: string;
}

export interface RrdVectorSearchRequest {
	collection_id: string;
	vector_name: string;
	example: RrdReference;
	top_k: number;
}

/**
 * A failed native RRD command. `retryable` is the engine's own classification:
 * it marks a transient storage conflict retryable, such as a diagnostic read
 * that requests landing meanwhile kept changing.
 */
export class RrdCommandError extends Error {
	readonly retryable: boolean;

	constructor(message: string, retryable: boolean) {
		super(message);
		this.name = "RrdCommandError";
		this.retryable = retryable;
	}
}

/** Whether a failure is the engine asking to be asked again later. */
export function isRetryable(error: unknown): boolean {
	return error instanceof RrdCommandError && error.retryable;
}

/** Invokes a native RRD command, turning its error into an `Error`. */
async function call<T>(command: string, args?: InvokeArgs): Promise<T> {
	try {
		return await invoke<T>(command, args);
	} catch (error) {
		if (typeof error === "object" && error !== null && "message" in error) {
			const retryable = "retryable" in error && error.retryable === true;
			throw new RrdCommandError(String(error.message), retryable);
		}
		throw error instanceof Error ? error : new Error(String(error));
	}
}

/** One authenticated RRD session held by Connectome's native process. */
export class RrdSessionClient {
	constructor(readonly profile: string) {}
	private call<T>(command: string, args?: InvokeArgs): Promise<T> {
		return call<T>(command, { ...args, profile: this.profile });
	}

	private requireNative() {
		if (!isTauri()) {
			throw new Error("Authenticated RRD sessions require the native Connectome client");
		}
	}

	async connect(request: RrdConnectRequest): Promise<RrdConnectionView> {
		this.requireNative();
		const connection = await this.call<RrdConnectionView>("rrd_connect", { request });
		if (
			connection.instance !== request.instance ||
			connection.service.instance !== request.instance
		) {
			throw new Error("RRD session changed the requested instance identity");
		}
		return connection;
	}

	/** The live native session, if one survives from an earlier visit. */
	async current(): Promise<RrdConnectionView | null> {
		this.requireNative();
		return this.call<RrdConnectionView | null>("rrd_session");
	}

	async capabilities(): Promise<RrdServiceView> {
		this.requireNative();
		return this.call<RrdServiceView>("rrd_capabilities");
	}

	async schema(): Promise<RrdSchemaView> {
		this.requireNative();
		return this.call<RrdSchemaView>("rrd_schema");
	}

	async database(): Promise<RrdDatabaseView> {
		this.requireNative();
		return this.call<RrdDatabaseView>("rrd_database");
	}

	async storage(): Promise<RrdStorageView> {
		this.requireNative();
		return this.call<RrdStorageView>("rrd_storage");
	}

	async query(query: string): Promise<RrdQueryView> {
		this.requireNative();
		return this.call<RrdQueryView>("rrd_query", { request: { query } });
	}

	async vectorCollections(): Promise<RrdVectorCollectionsView> {
		this.requireNative();
		return this.call<RrdVectorCollectionsView>("rrd_vector_collections");
	}

	async vectorPoints(request: RrdVectorPointsRequest): Promise<RrdVectorPointsView> {
		this.requireNative();
		return this.call<RrdVectorPointsView>("rrd_vector_points", { request });
	}

	async vectorSearch(request: RrdVectorSearchRequest): Promise<RrdVectorSearchView> {
		this.requireNative();
		return this.call<RrdVectorSearchView>("rrd_vector_search", { request });
	}

	/**
	 * Nearest neighbours of every drawn point; one exact engine search each.
	 * `onProgress` hears each finished search while the map builds.
	 */
	async vectorMap(
		request: RrdVectorMapRequest,
		onProgress?: (progress: RrdVectorMapProgressView) => void,
	): Promise<RrdVectorMapView> {
		this.requireNative();
		const progress = new Channel<RrdVectorMapProgressView>();
		if (onProgress) progress.onmessage = onProgress;
		return this.call<RrdVectorMapView>("rrd_vector_map", { request, onProgress: progress });
	}

	/**
	 * Previews a data change inside a new transaction; nothing is committed. A
	 * newer preview on this connection replaces it.
	 */
	async previewChange(mutations: RrdMutation[], validAt?: number): Promise<RrdChangePreviewView> {
		this.requireNative();
		return this.call<RrdChangePreviewView>("rrd_change_preview", {
			request: { mutations, valid_at: validAt },
		});
	}

	/** Commits a previewed change exactly as previewed, under the digest shown. */
	async commitChange(preview: RrdChangePreviewView): Promise<RrdCommitReceiptView> {
		this.requireNative();
		return this.call<RrdCommitReceiptView>("rrd_change_commit", {
			request: { handle: preview.handle, operation_sha256: preview.operation_sha256 },
		});
	}

	async discardChange(handle: string): Promise<void> {
		this.requireNative();
		await this.call<void>("rrd_change_discard", { handle });
	}

	/** Changes after `afterCursor`, at most 256 per page. */
	async changes(afterCursor: number, limit: number): Promise<RrdChangesView> {
		this.requireNative();
		return this.call<RrdChangesView>("rrd_changes", {
			request: { after_cursor: afterCursor, limit },
		});
	}

	/** Waits up to `waitTimeoutMs` (at most 5000) for changes after `afterCursor`. */
	async followChanges(
		afterCursor: number,
		limit: number,
		waitTimeoutMs: number,
	): Promise<RrdChangesFollowView> {
		this.requireNative();
		return this.call<RrdChangesFollowView>("rrd_changes_follow", {
			request: { after_cursor: afterCursor, limit, wait_timeout_ms: waitTimeoutMs },
		});
	}

	/** Audit records after `afterSequence`, at most 512 per page. */
	async audit(afterSequence: number, limit: number): Promise<RrdAuditView> {
		this.requireNative();
		return this.call<RrdAuditView>("rrd_audit", {
			request: { after_sequence: afterSequence, limit },
		});
	}

	async exportAudit(afterSequence: number, limit: number): Promise<RrdAuditExportView> {
		this.requireNative();
		return this.call<RrdAuditExportView>("rrd_audit_export", {
			request: { after_sequence: afterSequence, limit },
		});
	}

	/** Runs `query` as a Parquet export; the file stays native until saved. */
	async exportQuery(query: string): Promise<RrdQueryExportView> {
		this.requireNative();
		return this.call<RrdQueryExportView>("rrd_query_export", { request: { query } });
	}

	/** Saves a held export where the operator chooses; `null` when cancelled. */
	async saveArtifact(handle: string): Promise<RrdSavedArtifactView | null> {
		this.requireNative();
		return this.call<RrdSavedArtifactView | null>("rrd_artifact_save", { handle });
	}

	async backups(verifyArchives = false): Promise<RrdBackupsView> {
		this.requireNative();
		return this.call<RrdBackupsView>("rrd_backups", {
			request: { verify_archives: verifyArchives },
		});
	}

	async createBackup(label: string): Promise<RrdBackupCreatedView> {
		this.requireNative();
		return this.call<RrdBackupCreatedView>("rrd_backup_create", { request: { label } });
	}

	/** Restores a backup into its own verified root beside the estate. */
	async restoreBackup(backupSha256: string): Promise<RrdRestoreView> {
		this.requireNative();
		return this.call<RrdRestoreView>("rrd_backup_restore", {
			request: { backup_sha256: backupSha256 },
		});
	}

	/**
	 * Opens a live subscription; `onEvent` hears its events until it is closed
	 * or ends. Without `afterCursor`, changes start at the estate's head and a
	 * live query runs once first, its result returned as `first`.
	 */
	async openLive(
		stream: RrdLiveStream,
		onEvent: (event: RrdLiveEventView) => void,
		afterCursor?: number,
	): Promise<RrdLiveView> {
		this.requireNative();
		const events = new Channel<RrdLiveEventView>();
		events.onmessage = onEvent;
		return this.call<RrdLiveView>("rrd_live_open", {
			request: { stream, after_cursor: afterCursor },
			onEvent: events,
		});
	}

	async closeLive(handle: string): Promise<void> {
		this.requireNative();
		await this.call<void>("rrd_live_close", { handle });
	}

	async disconnect(): Promise<void> {
		this.requireNative();
		await this.call<void>("rrd_disconnect");
	}
}
