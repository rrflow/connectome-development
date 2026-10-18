//! Connectome's native client against a real RRD process.
//!
//! Each test installs and serves a fresh estate through the product's own
//! serve path (`rrd::estate::serve_estate`, the sequence behind the desktop's
//! "Start serving") with the `rrflow` binary named by `RRFLOW_BIN`, loads a
//! small fixture through the SDK, and drives `NativeRrdClient` the way the
//! lenses do. They are ignored by default; CI's RRD process job builds
//! `rrflow` at the revision `Cargo.lock` pins and runs them with `--ignored`.

use super::*;
use crate::rrd::estate::{
    serve_estate, EstateServeRequest, EstateStage, InstallMode, ServeObserver, ServedEstate,
};
use rrd_contract::{
    BeginTransaction, CommitTransaction, DataSchemaRegistry, EnsureVectorCollection,
    PreviewTransaction, TransactionMutation,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const FIXTURE_COLLECTION: &str = "notes";
const FIXTURE_VECTOR: &str = "body";
/// Two groups of four documents, densely linked inside each group.
const GROUPS: [&str; 2] = ["a", "b"];
const GROUP_SIZE: usize = 4;
const DOCUMENTS: usize = GROUPS.len() * GROUP_SIZE;
/// Six links inside each group plus one bridge between them.
const RELATIONS: usize = GROUPS.len() * 6 + 1;
/// Each group's vectors lean on their own block of dimensions.
const DIMENSIONS_PER_GROUP: usize = 4;
const DIMENSIONS: usize = GROUPS.len() * DIMENSIONS_PER_GROUP;
/// Bounds for the fixture's transactions, far above what eight records need.
const TRANSACTION_TIMEOUT: Duration = Duration::from_secs(60);
const TRANSACTION_MAX_STORAGE_KEYS: u32 = 10_000;

/// One installed and served estate, stopped and removed when dropped.
struct Estate {
    served: ServedEstate,
    address: SocketAddr,
    instance: String,
}

/// The serve sequence's boundaries and the engine's output, kept so a
/// failing test can show what the product path reported.
#[derive(Default)]
struct RecordingObserver {
    lines: Mutex<Vec<String>>,
}

impl ServeObserver for RecordingObserver {
    fn stage(&self, stage: EstateStage) {
        self.lines.lock().expect("observer").push(format!(
            "[{} {}] {}",
            stage.stage, stage.state, stage.detail
        ));
    }

    fn output(&self, line: String) {
        self.lines.lock().expect("observer").push(line);
    }
}

fn rrflow() -> PathBuf {
    PathBuf::from(
        std::env::var_os("RRFLOW_BIN").expect("RRFLOW_BIN must name the rrflow binary to drive"),
    )
}

impl Estate {
    /// Installs a fresh estate and serves it exactly as the desktop does.
    fn install_and_serve() -> Self {
        let project = std::env::temp_dir().join(format!(
            "connectome-rrd-process-{}.project",
            Uuid::new_v4().simple()
        ));
        let observer = Arc::new(RecordingObserver::default());
        let served = serve_estate(
            EstateServeRequest {
                project: project.to_string_lossy().into_owned(),
                mode: InstallMode::Fresh,
                executable: rrflow().to_string_lossy().into_owned(),
            },
            observer.clone(),
        )
        .unwrap_or_else(|error| {
            panic!(
                "the product serve path failed: {error:?}\n{}",
                observer.lines.lock().expect("observer").join("\n")
            )
        });
        assert!(served.view.installed, "a fresh project is installed first");
        let address: SocketAddr = served
            .view
            .endpoint
            .strip_prefix("http://")
            .and_then(|address| address.parse().ok())
            .expect("the served estate names a loopback HTTP address");
        let instance = served.view.instance.clone();

        Self {
            served,
            address,
            instance,
        }
    }

    fn connect_request(&self) -> RrdConnectRequest {
        RrdConnectRequest {
            endpoint: self.served.view.endpoint.clone(),
            instance: self.instance.clone(),
            credential_path: self.served.view.credential_path.clone(),
        }
    }
}

impl Drop for Estate {
    fn drop(&mut self) {
        let _ = self.served.server.kill();
        let _ = self.served.server.wait();
        let _ = std::fs::remove_dir_all(&self.served.view.project);
    }
}

fn mutations(value: Value) -> Vec<TransactionMutation> {
    serde_json::from_value(value).expect("fixture mutations match the contract")
}

/// Commits one transaction as an operator would: begin, preview, then commit
/// exactly the previewed mutations under the previewed digest.
async fn commit(client: &RrdClient, session: &Session, ids: &RequestIds, batch: Value) {
    let transaction = client
        .begin_transaction(
            session,
            BeginTransaction {
                scope: canonical("data", "scope").expect("scope"),
                timeout_ms: TRANSACTION_TIMEOUT.as_millis() as u64,
            },
            ids.next(true).expect("options"),
        )
        .await
        .expect("begin the fixture transaction");
    let preview = client
        .preview_transaction(
            session,
            &transaction.transaction_id,
            PreviewTransaction {
                mutations: mutations(batch),
                valid_at: None,
                max_storage_keys: TRANSACTION_MAX_STORAGE_KEYS,
            },
            ids.next(true).expect("options"),
        )
        .await
        .expect("preview the fixture transaction");
    let mut options = ids.next(true).expect("options");
    options.deadline_unix_ms =
        Some(now_unix_ms().expect("clock") + TRANSACTION_TIMEOUT.as_millis() as u64);
    client
        .commit_transaction(
            session,
            &transaction.transaction_id,
            CommitTransaction {
                operation_sha256: preview.operation_sha256,
                mutations: preview.mutations,
            },
            options,
        )
        .await
        .expect("commit the fixture transaction");
}

fn document(group: &str, index: usize) -> String {
    format!("{group}{}", index + 1)
}

/// Unit vectors that sit close inside each group and far across groups.
fn vector(group: usize, index: usize) -> Vec<f64> {
    let mut values = [0.05; DIMENSIONS];
    let block = values
        .iter_mut()
        .skip(group * DIMENSIONS_PER_GROUP)
        .take(DIMENSIONS_PER_GROUP);
    for (offset, value) in block.enumerate() {
        *value = 1.0 - 0.1 * ((offset + index) % DIMENSIONS_PER_GROUP) as f64;
    }
    let norm = values.iter().map(|value| value * value).sum::<f64>().sqrt();
    values.iter().map(|value| value / norm).collect()
}

/// Two groups of four documents, densely linked inside each group and joined
/// by one link, each with a vector near its group's.
async fn load_fixture(estate: &Estate) {
    let request = estate.connect_request();
    let (principal, api_key) = read_credential(&request.credential_path).expect("credential");
    let client = RrdClient::connect_local(
        estate.address,
        canonical(&estate.instance, "instance").expect("instance"),
        ClientConfig {
            request_timeout: REQUEST_TIMEOUT,
            ..ClientConfig::default()
        },
    )
    .expect("SDK client");
    let ids = RequestIds::new();
    let lease = Lease::open(&client, &principal, &api_key, &ids)
        .await
        .expect("operator session");
    let session = &lease.session;

    // A fresh estate already carries the engine's own types, so the fixture
    // extends the current registry under the next revision. The read asks for
    // the same one-record pages the lenses do.
    let current = client
        .read_diagnostic_snapshot(
            session,
            ReadDiagnosticSnapshot {
                scope: format!("instance:{}", estate.instance),
                graph_valid_at_unix_ms: now_unix_ms().expect("clock"),
                graph_known_at_cursor: None,
                graph_compare_cursor: 0,
                runtime_max_scanned_changes: MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES,
                changes_after_cursor: 0,
                change_limit: DIAGNOSTIC_CHANGE_PAGE,
                audit_after_sequence: 0,
                audit_limit: DIAGNOSTIC_AUDIT_PAGE,
            },
            ids.next(false).expect("options"),
        )
        .await
        .expect("read the current schema")
        .schema;
    commit(
        &client,
        session,
        &ids,
        json!([{ "mutation": "put_schema", "registry": fixture_schema(current) }]),
    )
    .await;

    client
        .ensure_vector_collection(
            session,
            EnsureVectorCollection {
                scope: format!("instance:{}", estate.instance),
                collection_id: canonical(FIXTURE_COLLECTION, "collection").expect("collection"),
                vectors: serde_json::from_value(json!([{
                    "name": FIXTURE_VECTOR,
                    "field": "body_embedding",
                    "kind": "dense",
                    "dimensions": DIMENSIONS,
                    "metric": "cosine",
                    "memory_tier": "cached"
                }]))
                .expect("named vector"),
            },
            ids.next(true).expect("options"),
        )
        .await
        .expect("ensure the fixture collection");

    let mut batch = Vec::new();
    for (group_index, group) in GROUPS.iter().enumerate() {
        for index in 0..GROUP_SIZE {
            let id = document(group, index);
            batch.push(json!({
                "mutation": "put_record",
                "reference": { "kind": "document", "id": id },
                "valid_from": 1,
                "properties": {
                    "title": { "type": "string", "value": format!("Document {id}") },
                    "group": { "type": "string", "value": group }
                }
            }));
            batch.push(json!({
                "mutation": "put_vector",
                "reference": { "kind": "embedding", "id": format!("{id}--body") },
                "subject": { "kind": "document", "id": id },
                "collection_id": FIXTURE_COLLECTION,
                "vector_name": FIXTURE_VECTOR,
                "field": "body_embedding",
                "valid_from": 1,
                "value": { "kind": "dense", "values": vector(group_index, index) },
                "properties": {}
            }));
        }
        // A ring plus both diagonals: every pair inside the group but two.
        for (from, to) in [(0, 1), (1, 2), (2, 3), (3, 0), (0, 2), (1, 3)] {
            batch.push(link(&document(group, from), &document(group, to)));
        }
    }
    batch.push(link("a1", "b1"));
    commit(&client, session, &ids, Value::Array(batch)).await;
}

/// The current registry plus the fixture's document, relation, and vector kinds.
fn fixture_schema(current: Option<DataSchemaRegistry>) -> Value {
    let mut registry = current
        .map(|registry| serde_json::to_value(registry).expect("the registry serializes"))
        .unwrap_or_else(|| json!({ "revision": 0, "migration": "", "tables": {} }));
    let revision = registry["revision"].as_u64().unwrap_or(0) + 1;
    registry["revision"] = json!(revision);
    registry["migration"] = json!("Connectome RRD process fixture");
    registry["tables"]["document"] = json!({ "model": "relational", "mode": "strict" });
    registry["tables"]["links_to"] = json!({ "model": "graph_relation", "mode": "strict" });
    registry["tables"]["embedding"] = json!({ "model": "vector", "mode": "schemaless" });
    registry["records"]["document"] = json!({
        "properties": {
            "title": { "value_type": "string", "required": true },
            "group": { "value_type": "string", "required": true }
        },
        "allow_additional_properties": false,
        "unique_properties": []
    });
    registry["relations"]["links_to"] = json!({
        "from": ["document"],
        "to": ["document"],
        "properties": {},
        "allow_additional_properties": false,
        "unique_pair": true
    });
    registry
}

fn link(from: &str, to: &str) -> Value {
    json!({
        "mutation": "put_relation",
        "reference": { "kind": "links_to", "id": format!("{from}--{to}") },
        "from": { "kind": "document", "id": from },
        "to": { "kind": "document", "id": to },
        "valid_from": 1,
        "properties": {}
    })
}

fn group_of(record: &str) -> char {
    record
        .rsplit(':')
        .next()
        .and_then(|key| key.chars().next())
        .expect("fixture keys start with their group")
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn a_second_connection_never_replays_the_first_session() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let first = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("first connection");
        let second = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("second connection");
        // With per-launch request counters both connections sent the same
        // idempotency key, so the engine handed the second the first's
        // session, and closing one closed both.
        first.close().await.expect("close the first session");
        second
            .database()
            .await
            .expect("the second connection keeps its own session");
        second.close().await.expect("close the second session");
        let closed = second
            .database()
            .await
            .expect_err("a closed session refuses reads");
        assert_eq!(closed.message, SESSION_CLOSED);
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn the_lenses_read_a_live_estate() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection"),
        );
        let connection = client.connection();
        assert_eq!(connection.instance, estate.instance);
        assert_eq!(connection.session.idle_timeout_ms, SESSION_IDLE_TIMEOUT_MS);

        // Records & relations: the graph and its clusters. A fresh estate also
        // holds the engine's own records, so the fixture's kinds are counted.
        let database = client.database().await.expect("database view");
        let graph = &database.graph;
        let documents = graph.nodes.iter().filter(|node| node.kind == "document");
        assert_eq!(documents.count(), DOCUMENTS);
        let links = graph.edges.iter().filter(|edge| edge.kind == "links_to");
        assert_eq!(links.count(), RELATIONS);
        let cluster = |key: &str| {
            graph
                .nodes
                .iter()
                .find(|node| node.key == key)
                .unwrap_or_else(|| panic!("{key} is drawn"))
                .cluster
        };
        assert!((2..=GROUP_SIZE).all(|index| cluster(&format!("a{index}")) == cluster("a1")));
        assert!((2..=GROUP_SIZE).all(|index| cluster(&format!("b{index}")) == cluster("b1")));
        assert_ne!(cluster("a1"), cluster("b1"));

        // The console: a query runs inside the session and returns its rows. The
        // view maps every result shape the same way, so one query covers it.
        let at = now_unix_ms().expect("clock");
        let rows = client
            .query(RrdQueryRequest {
                query: format!("FROM record:document AT VALID {at} KNOWN HEAD PROJECT * LIMIT 50"),
            })
            .await
            .expect("record query");
        assert_eq!(rows.returned_rows, DOCUMENTS as u64);

        // Storage engine: rrflowKV's live counters.
        let storage = client.storage().await.expect("storage view");
        assert_eq!(storage.physical.profile, "rrflow_kv");
        assert!(!storage.physical.groups.is_empty());

        // Vectors: the catalogue, the points, and an exact search by example.
        let catalogue = client.vector_collections().await.expect("collections");
        assert_eq!(catalogue.collections.len(), 1);
        let points = client
            .vector_points(RrdVectorPointsRequest {
                collection_id: FIXTURE_COLLECTION.into(),
                vector_name: FIXTURE_VECTOR.into(),
                after: None,
                limit: 50,
            })
            .await
            .expect("points");
        assert_eq!(points.points.len(), DOCUMENTS);
        let search = client
            .vector_search(RrdVectorSearchRequest {
                collection_id: FIXTURE_COLLECTION.into(),
                vector_name: FIXTURE_VECTOR.into(),
                example: RrdReference {
                    kind: "embedding".into(),
                    id: "a1--body".into(),
                },
                top_k: GROUP_SIZE as u64,
            })
            .await
            .expect("search by example");
        assert_eq!(
            search.hits.first().map(|hit| hit.subject.id.as_str()),
            Some("a1")
        );
        assert!(search
            .hits
            .iter()
            .all(|hit| hit.subject.id.starts_with('a')));

        // The similarity map, with a storage read running beside it: lenses no
        // longer queue behind each other, and a read the busy engine refuses
        // comes back retryable rather than as a failure.
        let progress = Arc::new(Mutex::new(Vec::new()));
        let heard = Arc::clone(&progress);
        let mapper = Arc::clone(&client);
        let map = tauri::async_runtime::spawn(async move {
            mapper
                .vector_map(
                    RrdVectorMapRequest {
                        collection_id: FIXTURE_COLLECTION.into(),
                        vector_name: FIXTURE_VECTOR.into(),
                    },
                    move |message| heard.lock().expect("progress").push(message),
                )
                .await
        });
        if let Err(error) = client.storage().await {
            assert!(
                error.retryable,
                "a storage read beside the map failed: {error}"
            );
        }
        let map = map.await.expect("map task").expect("similarity map");
        client
            .storage()
            .await
            .expect("a storage read once the map is built");
        assert_eq!(map.points.len(), DOCUMENTS);
        assert_eq!(map.searches, DOCUMENTS as u64);
        let neighbours = (DOCUMENTS - 1).min(VECTOR_MAP_NEIGHBOURS as usize);
        assert_eq!(map.links.len(), DOCUMENTS * neighbours);
        for link in map.links.iter().filter(|link| link.rank == 1) {
            let from = &map.points[link.from].subject.id;
            let to = &map.points[link.to].subject.id;
            assert_eq!(group_of(from), group_of(to), "{from}'s nearest is {to}");
        }
        {
            let progress = progress.lock().expect("progress");
            let first = progress.first().expect("the map reports progress");
            assert_eq!(first.searched, 0);
            assert_eq!(first.points.as_ref().map(Vec::len), Some(DOCUMENTS));
            assert_eq!(
                progress.last().map(|message| message.searched),
                Some(DOCUMENTS as u64)
            );
        }

        client.close().await.expect("close the session");
    });
}

/// The turnkey path: with no executable configured, the desktop runs the
/// engine bundled beside it, and only because it hashes to the digest this
/// build embedded from `binaries/engine.json`. The staged sidecar is copied
/// beside the test executable, where Tauri installs `bundle.externalBin`.
#[test]
#[ignore = "drives the staged engine sidecar; CI stages it and runs with --ignored"]
fn the_bundled_engine_serves_as_the_verified_sidecar() {
    let manifest_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries/engine.json");
    let manifest: Value = serde_json::from_slice(
        &std::fs::read(&manifest_path)
            .expect("the engine is staged (scripts/engine/build-sidecar.mjs)"),
    )
    .expect("engine manifest is JSON");
    let staged = manifest_path
        .parent()
        .expect("binaries directory")
        .join(manifest["file"].as_str().expect("manifest names its file"));
    let beside_exe = std::env::current_exe()
        .expect("test executable")
        .parent()
        .expect("executable directory")
        .join(format!("rrflow{}", std::env::consts::EXE_SUFFIX));
    std::fs::copy(&staged, &beside_exe).expect("place the sidecar beside the executable");

    let project = std::env::temp_dir().join(format!(
        "connectome-rrd-sidecar-{}.project",
        Uuid::new_v4().simple()
    ));
    let observer = Arc::new(RecordingObserver::default());
    let served = serve_estate(
        EstateServeRequest {
            project: project.to_string_lossy().into_owned(),
            mode: InstallMode::Fresh,
            executable: String::new(),
        },
        observer.clone(),
    );
    let _ = std::fs::remove_file(&beside_exe);
    let mut served = served.unwrap_or_else(|error| {
        panic!(
            "the sidecar serve path failed: {error:?}\n{}",
            observer.lines.lock().expect("observer").join("\n")
        )
    });
    let _ = served.server.kill();
    let _ = served.server.wait();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(
        served.view.engine.source,
        crate::rrd::engine::EngineSource::Sidecar
    );
    assert_eq!(
        served.view.engine.sha256,
        manifest["sha256"]
            .as_str()
            .expect("manifest names its sha256")
    );
    assert_eq!(
        served.view.engine.revision.as_deref(),
        manifest["revision"].as_str()
    );
    let lines = observer.lines.lock().expect("observer");
    assert!(
        lines
            .iter()
            .any(|line| line.contains("[engine done]") && line.contains("bundled with this build")),
        "{}",
        lines.join("\n")
    );
}
