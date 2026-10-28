//! Authenticated native RRD session built on RRFlow's Rust SDK.
//!
//! `rrd-client` and `rrd-contract` own every request and response type and
//! validate each response before Connectome projects it into a view model.
//! The operator credential and the session bearer stay in this process; the
//! webview receives only `view` projections.
//!
//! Lenses call in concurrently. Each request pins the current session lease
//! until it completes, and the lease is renewed or replaced only while no
//! request pins it, because a renewal rotates the bearer the engine accepts.
//!
//! Governed effects live in submodules: `transaction` (preview, then commit
//! exactly what was previewed), `backup`, `artifact` (exports held natively
//! until saved), `history` (changefeed and audit pages) and `live` (durable
//! subscriptions delivered over `/v1/ws`).

use super::error::RrdError;
use super::transport::{is_loopback_origin, rrd_origin};
use super::view::{
    self, ConnectionView, DatabaseView, MapLinkView, MapPointView, QueryView, ServiceView,
    SessionView, StorageView, VectorCollectionsView, VectorMapProgressView, VectorMapView,
    VectorPointsView, VectorSearchView,
};
use rrd_client::{ClientConfig, RequestOptions, RrdClient, Session};
use rrd_contract::{
    CanonicalId, CloseSession, CreateSession, DataReference, DataVectorValue, DiagnosticSnapshot,
    ExecuteQuery, ListVectorCollections, QueryBudget, ReadDiagnosticSnapshot, RenewSession,
    RetrieveVectorPoints, ScrollVectorPoints, SearchVectors, ServiceCapabilities, SessionLimits,
    VectorPointBatch, VectorPointPage, VectorPointSnapshot, VectorSearchHit, VectorSearchMode,
    VectorSearchQuery, VectorSearchResult, MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES, MAX_QUERY_BYTES,
    MAX_VECTOR_POINT_PAGE, MAX_VECTOR_SEARCH_TOP_K, MAX_VECTOR_STORAGE_KEYS,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::fmt;
use std::future::Future;
use std::net::{SocketAddr, ToSocketAddrs};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::net::TcpStream;
use tokio::sync::{RwLock, RwLockReadGuard};
use tokio::task::JoinSet;
use uuid::Uuid;

mod artifact;
mod backup;
mod history;
mod live;
mod transaction;

pub use artifact::{save_artifact, RrdAuditExportRequest, RrdQueryExportRequest};
pub use backup::{RrdBackupCreateRequest, RrdBackupRestoreRequest, RrdBackupsRequest};
pub use history::{RrdAuditRequest, RrdChangesFollowRequest, RrdChangesRequest};
pub use live::{LiveSink, RrdLiveOpenRequest};
pub use transaction::{RrdChangeCommitRequest, RrdChangePreviewRequest};

// Connectome's own session policy; the engine enforces its own ceilings.
const SESSION_IDLE_TIMEOUT_MS: u64 = 900_000;
const SESSION_ABSOLUTE_TIMEOUT_MS: u64 = 3_600_000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
/// A request pins the lease it was sent with until it completes, so a lease is
/// handed out only while it outlives the longest request with room to spare.
const SESSION_RENEWAL_MARGIN: Duration = Duration::from_secs(60);
const _: () = assert!(SESSION_RENEWAL_MARGIN.as_secs() > REQUEST_TIMEOUT.as_secs());
const SESSION_CLOSED: &str = "the RRD session is closed";
const LOOPBACK_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
/// The diagnostic read always carries a change-feed page and an audit page,
/// read forward from the given position. The lenses render neither, only the
/// read stamp and the head positions, so they ask for the smallest page the
/// contract accepts.
const DIAGNOSTIC_CHANGE_PAGE: u64 = 1;
const DIAGNOSTIC_AUDIT_PAGE: u16 = 1;
const MAX_CREDENTIAL_FILE_BYTES: u64 = 16 * 1024;
/// Points the similarity map draws at most; each costs one exact engine search.
const MAX_VECTOR_MAP_POINTS: usize = 600;
/// Nearest neighbours the engine returns for each point on the similarity map.
const VECTOR_MAP_NEIGHBOURS: u64 = 5;
/// Exact searches in flight at once while the similarity map is built.
const VECTOR_MAP_CONCURRENCY: usize = 8;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdConnectRequest {
    /// Loopback HTTP origin of the RRD service, for example `http://127.0.0.1:9477`.
    pub endpoint: String,
    /// Instance identity confirmed by the public capability handshake.
    pub instance: String,
    /// Installed operator credential file (`.rrflow/credentials/<principal>.json`).
    pub credential_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdQueryRequest {
    pub query: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdVectorPointsRequest {
    pub collection_id: String,
    pub vector_name: String,
    #[serde(default)]
    pub after: Option<RrdReference>,
    pub limit: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdVectorSearchRequest {
    pub collection_id: String,
    pub vector_name: String,
    /// Query by example: the stored point whose vector is the query.
    pub example: RrdReference,
    pub top_k: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdVectorMapRequest {
    pub collection_id: String,
    pub vector_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdReference {
    pub kind: String,
    pub id: String,
}

/// The installed operator credential document. Only the two fields used here
/// are read; the engine owns and validates the rest of its format.
#[derive(Deserialize)]
struct OperatorCredential {
    principal_id: String,
    credential: String,
}

struct Secret(String);

impl fmt::Debug for Secret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

/// Correlation identifiers for one connection: a random run prefix plus a
/// counter. The engine derives a session's identity from the idempotency key
/// that created it and answers a repeated key with the first result, so keys
/// must never repeat across connections or app launches.
struct RequestIds {
    run: String,
    sequence: AtomicU64,
}

impl RequestIds {
    fn new() -> Self {
        Self {
            run: Uuid::new_v4().simple().to_string(),
            sequence: AtomicU64::new(0),
        }
    }

    /// Options for the next request; a mutation also carries an idempotency key.
    fn next(&self, mutation: bool) -> Result<RequestOptions, RrdError> {
        let sequence = self
            .sequence
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |value| {
                value.checked_add(1)
            })
            .map_err(|_| "Connectome RRD request sequence exhausted")?
            + 1;
        let prefix = format!("connectome-{}", self.run);
        let request = format!("{prefix}-request-{sequence}");
        let operation = format!("{prefix}-operation-{sequence}");
        let options = if mutation {
            RequestOptions::mutation(&request, &operation, &format!("{prefix}-key-{sequence}"))
        } else {
            RequestOptions::read(&request, &operation)
        };
        options.map_err(RrdError::sdk)
    }
}

/// When a session lapses, on this process's monotonic clock. Each deadline is
/// measured from before the request that granted it, so it passes no later
/// than the engine's own deadline whatever either wall clock reads; the
/// engine's expiry timestamps are never compared with this machine's time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Deadlines {
    idle: Instant,
    absolute: Instant,
}

impl Deadlines {
    fn granted(requested_at: Instant, limits: &SessionLimits) -> Result<Self, String> {
        Ok(Self {
            idle: after(requested_at, limits.idle_timeout_ms)?,
            absolute: after(requested_at, limits.absolute_timeout_ms)?,
        })
    }

    /// A renewal restarts the idle timer; the absolute deadline never moves.
    fn renewed(self, requested_at: Instant, limits: &SessionLimits) -> Result<Self, String> {
        Ok(Self {
            idle: after(requested_at, limits.idle_timeout_ms)?,
            absolute: self.absolute,
        })
    }

    /// Whether a request sent at `now` completes before the session can lapse.
    fn outlive_request(self, now: Instant) -> bool {
        self.idle.min(self.absolute).saturating_duration_since(now) > SESSION_RENEWAL_MARGIN
    }

    /// Whether renewing at `now` still buys a request's worth of time; past
    /// this point only a new session can.
    fn renewable(self, now: Instant) -> bool {
        self.absolute.saturating_duration_since(now) > SESSION_RENEWAL_MARGIN
    }
}

fn after(start: Instant, millis: u64) -> Result<Instant, String> {
    start
        .checked_add(Duration::from_millis(millis))
        .ok_or_else(|| "the RRD session limits do not fit this clock".into())
}

struct Lease {
    session: Session,
    deadlines: Deadlines,
}

impl Lease {
    async fn open(
        client: &RrdClient,
        principal: &CanonicalId,
        api_key: &Secret,
        ids: &RequestIds,
    ) -> Result<Self, RrdError> {
        let request = CreateSession {
            limits: SessionLimits {
                idle_timeout_ms: SESSION_IDLE_TIMEOUT_MS,
                absolute_timeout_ms: SESSION_ABSOLUTE_TIMEOUT_MS,
                max_open_transactions: 1,
            },
        };
        let requested_at = Instant::now();
        let session = client
            .create_session(principal.clone(), &api_key.0, request, ids.next(true)?)
            .await
            .map_err(RrdError::sdk)?;
        let deadlines = Deadlines::granted(requested_at, session.limits())?;
        Ok(Self { session, deadlines })
    }
}

pub struct NativeRrdClient {
    client: RrdClient,
    endpoint: String,
    instance: CanonicalId,
    principal: CanonicalId,
    api_key: Secret,
    connected_at_unix_ms: u64,
    service: ServiceView,
    /// The estate's configured query budget, read from its capability document.
    query_budget: QueryBudget,
    /// The session policy the engine granted when the connection opened.
    limits: SessionLimits,
    ids: RequestIds,
    /// `None` once the operator closed the session.
    lease: RwLock<Option<Lease>>,
    /// The previewed change waiting for its commit, if any.
    pending: tokio::sync::Mutex<Option<transaction::PendingChange>>,
    artifacts: artifact::Artifacts,
    /// Counts lease refreshes. A live subscription's socket keeps the bearer
    /// it connected with, so it reconnects whenever this changes.
    bearer_generation: tokio::sync::watch::Sender<u64>,
    live: live::LiveSubscriptions,
}

fn now_unix_ms() -> Result<u64, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch")?
        .as_millis();
    u64::try_from(millis).map_err(|_| "system clock does not fit RRD time".into())
}

fn canonical(value: &str, label: &str) -> Result<CanonicalId, String> {
    CanonicalId::new(value)
        .map_err(|error| format!("{label} is not a canonical RRD identifier: {error}"))
}

fn data_reference(reference: &RrdReference) -> Result<DataReference, String> {
    Ok(DataReference {
        kind: canonical(&reference.kind, "reference kind")?,
        id: canonical(&reference.id, "reference id")?,
    })
}

/// The validated loopback origin plus every loopback socket address it names.
fn loopback_candidates(endpoint: &str) -> Result<(String, Vec<SocketAddr>), String> {
    let origin = rrd_origin(endpoint)?;
    if origin.scheme() != "http" || !is_loopback_origin(&origin) {
        return Err(
            "authenticated RRD connections currently require loopback HTTP; remote mode requires the mutual-TLS profile"
                .into(),
        );
    }
    let host = origin.host_str().ok_or("RRD endpoint has no host")?;
    let port = origin
        .port_or_known_default()
        .ok_or("RRD endpoint has no port")?;
    let candidates: Vec<SocketAddr> = (host.trim_matches(|c| c == '[' || c == ']'), port)
        .to_socket_addrs()
        .map_err(|error| format!("cannot resolve RRD loopback endpoint: {error}"))?
        .filter(|address| address.ip().is_loopback())
        .collect();
    if candidates.is_empty() {
        return Err("RRD endpoint does not resolve to a loopback address".into());
    }
    Ok((origin.as_str().trim_end_matches('/').to_owned(), candidates))
}

/// `localhost` names both `::1` and `127.0.0.1`, and RRD may listen on only
/// one family. The SDK dials a single address, so pick the first that accepts.
async fn reachable_loopback(candidates: &[SocketAddr]) -> Result<SocketAddr, String> {
    for address in candidates {
        let probe = tokio::time::timeout(LOOPBACK_PROBE_TIMEOUT, TcpStream::connect(address));
        if matches!(probe.await, Ok(Ok(_))) {
            return Ok(*address);
        }
    }
    Err(format!(
        "no RRD service accepts connections at {}",
        candidates
            .iter()
            .map(SocketAddr::to_string)
            .collect::<Vec<_>>()
            .join(" or ")
    ))
}

/// Whether the instance proved at `endpoint` still answers there as itself.
/// The SDK checks the instance identity its public capabilities carry, so
/// another process that took over the port does not pass. This can only take
/// readiness away: answering is not RRFlow's authenticated proof.
pub async fn answers_as(endpoint: &str, instance: &str) -> Result<(), RrdError> {
    let (_, candidates) = loopback_candidates(endpoint)?;
    let address = reachable_loopback(&candidates).await?;
    let config = ClientConfig {
        request_timeout: LOOPBACK_PROBE_TIMEOUT,
        max_attempts: 1,
        ..ClientConfig::default()
    };
    let client = RrdClient::connect_local(address, canonical(instance, "instance")?, config)
        .map_err(RrdError::sdk)?;
    client.capabilities().await.map_err(RrdError::sdk)?;
    Ok(())
}

fn read_credential(path: &str) -> Result<(CanonicalId, Secret), String> {
    let path = Path::new(path);
    let metadata = std::fs::metadata(path)
        .map_err(|error| format!("cannot read the RRD credential file: {error}"))?;
    if !metadata.is_file() || metadata.len() > MAX_CREDENTIAL_FILE_BYTES {
        return Err("the RRD credential path is not a bounded credential file".into());
    }
    let bytes = std::fs::read(path)
        .map_err(|error| format!("cannot read the RRD credential file: {error}"))?;
    let document: OperatorCredential = serde_json::from_slice(&bytes).map_err(|_| {
        "the RRD credential file is not an installed operator credential".to_owned()
    })?;
    if document.credential.is_empty() || document.credential.contains('\0') {
        return Err("the RRD credential file holds an empty credential".into());
    }
    Ok((
        canonical(&document.principal_id, "credential principal")?,
        Secret(document.credential),
    ))
}

fn reference_key(reference: &DataReference) -> (String, String) {
    (
        reference.kind.as_str().to_owned(),
        reference.id.as_str().to_owned(),
    )
}

/// The first `limit` hits that are drawn on the map and are not the query
/// point itself, ranked from 1 in the engine's result order.
fn neighbour_links(
    from: usize,
    hits: &[VectorSearchHit],
    drawn: &HashMap<(String, String), usize>,
    limit: u64,
) -> Vec<MapLinkView> {
    hits.iter()
        .filter_map(|hit| {
            drawn
                .get(&reference_key(&hit.reference))
                .map(|&to| (to, hit.score))
        })
        .filter(|&(to, _)| to != from)
        .take(usize::try_from(limit).unwrap_or(usize::MAX))
        .enumerate()
        .map(|(rank, (to, score))| MapLinkView {
            from,
            to,
            rank: rank + 1,
            score,
        })
        .collect()
}

/// One rrflowQL request within the estate's budget, refused before it is sent
/// when the contract could never accept it.
fn execute_query(
    query: &str,
    scope: String,
    budget: &QueryBudget,
) -> Result<ExecuteQuery, RrdError> {
    if query.trim().is_empty() || query.len() > MAX_QUERY_BYTES || query.contains('\0') {
        return Err(format!(
            "RRFlowQL query must be non-empty, at most {MAX_QUERY_BYTES} bytes, and free of NUL"
        )
        .into());
    }
    Ok(ExecuteQuery {
        scope,
        query: query.to_owned(),
        parameters: Default::default(),
        budget: budget.clone(),
    })
}

/// The lowest and highest cursor seen across the reads that built one view.
fn widen(range: Option<(u64, u64)>, cursor: u64) -> (u64, u64) {
    range.map_or((cursor, cursor), |(low, high)| {
        (low.min(cursor), high.max(cursor))
    })
}

impl NativeRrdClient {
    pub async fn connect(request: RrdConnectRequest) -> Result<Self, RrdError> {
        let (endpoint, candidates) = loopback_candidates(&request.endpoint)?;
        let address = reachable_loopback(&candidates).await?;
        let instance = canonical(&request.instance, "instance")?;
        let (principal, api_key) = read_credential(&request.credential_path)?;
        let config = ClientConfig {
            request_timeout: REQUEST_TIMEOUT,
            ..ClientConfig::default()
        };
        let client =
            RrdClient::connect_local(address, instance.clone(), config).map_err(RrdError::sdk)?;
        // The SDK validates the capability contract and the exact instance identity.
        let capabilities = client.capabilities().await.map_err(RrdError::sdk)?;
        let ids = RequestIds::new();
        let lease = Lease::open(&client, &principal, &api_key, &ids).await?;
        Ok(Self {
            limits: lease.session.limits().clone(),
            lease: RwLock::new(Some(lease)),
            client,
            endpoint,
            instance,
            principal,
            api_key,
            connected_at_unix_ms: now_unix_ms()?,
            service: view::service(&capabilities),
            query_budget: capabilities.configuration.query.clone(),
            ids,
            pending: Default::default(),
            artifacts: Default::default(),
            bearer_generation: tokio::sync::watch::Sender::new(0),
            live: Default::default(),
        })
    }

    /// The connection as the webview may see it: identities, session policy,
    /// and service. Bearers and engine-clock expiry instants stay native.
    pub fn connection(&self) -> ConnectionView {
        ConnectionView {
            endpoint: self.endpoint.clone(),
            instance: self.instance.as_str().into(),
            principal: self.principal.as_str().into(),
            connected_at_unix_ms: self.connected_at_unix_ms,
            session: SessionView {
                idle_timeout_ms: self.limits.idle_timeout_ms,
                absolute_timeout_ms: self.limits.absolute_timeout_ms,
            },
            service: self.service.clone(),
        }
    }

    fn scope(&self) -> String {
        format!("instance:{}", self.instance.as_str())
    }

    /// The current session, pinned until the guard drops. A session that would
    /// not outlive a request is first renewed, or replaced once renewal cannot
    /// help, under the write lock, so no in-flight request holds the bearer
    /// that the renewal rotates or the replacement closes.
    async fn lease(&self) -> Result<RwLockReadGuard<'_, Lease>, RrdError> {
        {
            let current = self.lease.read().await;
            let fresh = current
                .as_ref()
                .ok_or(SESSION_CLOSED)?
                .deadlines
                .outlive_request(Instant::now());
            if fresh {
                return RwLockReadGuard::try_map(current, Option::as_ref)
                    .map_err(|_| SESSION_CLOSED.into());
            }
        }
        let mut current = self.lease.write().await;
        let stale = !current
            .as_ref()
            .ok_or(SESSION_CLOSED)?
            .deadlines
            .outlive_request(Instant::now());
        // Another request may have refreshed the session while this one waited.
        if stale {
            let refreshed = self
                .refresh(current.as_ref().ok_or(SESSION_CLOSED)?)
                .await?;
            *current = Some(refreshed);
            self.bearer_generation
                .send_modify(|generation| *generation += 1);
        }
        RwLockReadGuard::try_map(current.downgrade(), Option::as_ref)
            .map_err(|_| SESSION_CLOSED.into())
    }

    /// Refreshes the session now, as `lease` does once it nears a deadline:
    /// renewed in place, or replaced by a new session when `replace` is set.
    #[cfg(test)]
    async fn refresh_now(&self, replace: bool) -> Result<(), RrdError> {
        let mut current = self.lease.write().await;
        let lease = current.as_ref().ok_or(SESSION_CLOSED)?;
        let refreshed = if replace {
            let replacement =
                Lease::open(&self.client, &self.principal, &self.api_key, &self.ids).await?;
            let _ = self
                .client
                .close_session(&lease.session, CloseSession {}, self.ids.next(true)?)
                .await;
            replacement
        } else {
            self.refresh(lease).await?
        };
        *current = Some(refreshed);
        self.bearer_generation
            .send_modify(|generation| *generation += 1);
        Ok(())
    }

    /// Renews `current`, or opens a new session when renewal cannot outlast a
    /// request or the engine refuses it (the session lapsed while Connectome
    /// sat idle, or used up its renewals).
    async fn refresh(&self, current: &Lease) -> Result<Lease, RrdError> {
        if current.deadlines.renewable(Instant::now()) {
            let requested_at = Instant::now();
            match self
                .client
                .renew_session(&current.session, RenewSession {}, self.ids.next(true)?)
                .await
            {
                Ok(session) => {
                    let deadlines = current.deadlines.renewed(requested_at, session.limits())?;
                    return Ok(Lease { session, deadlines });
                }
                Err(error) => {
                    log::info!("RRD session renewal refused ({error}); opening a new session")
                }
            }
        }
        let replacement =
            Lease::open(&self.client, &self.principal, &self.api_key, &self.ids).await?;
        // Best effort: the old session may already have lapsed on the engine.
        let _ = self
            .client
            .close_session(&current.session, CloseSession {}, self.ids.next(true)?)
            .await;
        Ok(replacement)
    }

    /// Sends one request with the current session pinned until it completes.
    async fn send<T, Fut>(
        &self,
        mutation: bool,
        request: impl FnOnce(Session, RequestOptions) -> Fut,
    ) -> Result<T, RrdError>
    where
        Fut: Future<Output = rrd_client::Result<T>>,
    {
        let lease = self.lease().await?;
        let options = self.ids.next(mutation)?;
        let result = request(lease.session.clone(), options).await;
        drop(lease);
        result.map_err(RrdError::sdk)
    }

    pub async fn capabilities(&self) -> Result<ServiceCapabilities, RrdError> {
        self.client.capabilities().await.map_err(RrdError::sdk)
    }

    async fn diagnostic_snapshot(&self) -> Result<DiagnosticSnapshot, RrdError> {
        let request = ReadDiagnosticSnapshot {
            scope: self.scope(),
            graph_valid_at_unix_ms: now_unix_ms()?,
            graph_known_at_cursor: None,
            graph_compare_cursor: 0,
            runtime_max_scanned_changes: MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES,
            changes_after_cursor: 0,
            change_limit: DIAGNOSTIC_CHANGE_PAGE,
            audit_after_sequence: 0,
            audit_limit: DIAGNOSTIC_AUDIT_PAGE,
        };
        self.send(false, |session, options| async move {
            self.client
                .read_diagnostic_snapshot(&session, request, options)
                .await
        })
        .await
    }

    async fn scroll(&self, request: ScrollVectorPoints) -> Result<VectorPointPage, RrdError> {
        self.send(false, |session, options| async move {
            self.client
                .scroll_vector_points(&session, request, options)
                .await
        })
        .await
    }

    async fn retrieve(&self, request: RetrieveVectorPoints) -> Result<VectorPointBatch, RrdError> {
        self.send(false, |session, options| async move {
            self.client
                .retrieve_vector_points(&session, request, options)
                .await
        })
        .await
    }

    async fn search(&self, request: SearchVectors) -> Result<VectorSearchResult, RrdError> {
        self.send(false, |session, options| async move {
            self.client.search_vectors(&session, request, options).await
        })
        .await
    }

    pub async fn schema(&self) -> Result<rrd_contract::DataSchemaSnapshot, RrdError> {
        let request = rrd_contract::ReadDataSchema {
            scope: self.scope(),
            max_storage_keys: 4096,
        };
        self.send(false, |session, options| async move {
            self.client
                .read_data_schema(&session, request, options)
                .await
        })
        .await
    }

    pub async fn database(&self) -> Result<DatabaseView, RrdError> {
        Ok(view::database(&self.diagnostic_snapshot().await?))
    }

    pub async fn storage(&self) -> Result<StorageView, RrdError> {
        let snapshot = self.diagnostic_snapshot().await?;
        Ok(view::storage(&snapshot, &self.service.storage_profile))
    }

    pub async fn query(&self, request: RrdQueryRequest) -> Result<QueryView, RrdError> {
        let execution = execute_query(&request.query, self.scope(), &self.query_budget)?;
        let result = self
            .send(false, |session, options| async move {
                self.client
                    .execute_query(&session, execution, options)
                    .await
            })
            .await
            .map_err(|error| error.in_query(&request.query))?;
        Ok(view::query(&result))
    }

    pub async fn vector_collections(&self) -> Result<VectorCollectionsView, RrdError> {
        let request = ListVectorCollections {
            scope: self.scope(),
        };
        let catalogue = self
            .send(false, |session, options| async move {
                self.client
                    .list_vector_collections(&session, request, options)
                    .await
            })
            .await?;
        Ok(view::collections(&catalogue))
    }

    pub async fn vector_points(
        &self,
        request: RrdVectorPointsRequest,
    ) -> Result<VectorPointsView, RrdError> {
        if request.limit == 0 || request.limit > MAX_VECTOR_POINT_PAGE {
            return Err(format!("vector page size must be in 1..={MAX_VECTOR_POINT_PAGE}").into());
        }
        let request = ScrollVectorPoints {
            scope: self.scope(),
            collection_id: canonical(&request.collection_id, "collection")?,
            vector_name: canonical(&request.vector_name, "vector name")?,
            valid_at: now_unix_ms()?,
            after_reference: request.after.as_ref().map(data_reference).transpose()?,
            limit: request.limit,
            max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
            filter: None,
        };
        Ok(view::points(&self.scroll(request).await?))
    }

    /// Query by example: retrieve one stored dense vector, then search its collection.
    pub async fn vector_search(
        &self,
        request: RrdVectorSearchRequest,
    ) -> Result<VectorSearchView, RrdError> {
        if request.top_k == 0 || request.top_k > MAX_VECTOR_SEARCH_TOP_K {
            return Err(format!("top_k must be in 1..={MAX_VECTOR_SEARCH_TOP_K}").into());
        }
        let collection_id = canonical(&request.collection_id, "collection")?;
        let vector_name = canonical(&request.vector_name, "vector name")?;
        let example = data_reference(&request.example)?;
        let valid_at = now_unix_ms()?;
        let batch = self
            .retrieve(RetrieveVectorPoints {
                scope: self.scope(),
                collection_id: collection_id.clone(),
                vector_name: vector_name.clone(),
                valid_at,
                references: vec![example.clone()],
                max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
            })
            .await?;
        let point = batch
            .points
            .into_iter()
            .find(|point| point.reference == example)
            .ok_or("the example vector is not visible at the current read stamp")?;
        let DataVectorValue::Dense { values } = point.value else {
            return Err("query by example currently supports dense vectors only".into());
        };
        let result = self
            .search(SearchVectors {
                scope: self.scope(),
                valid_at,
                collection_id: Some(collection_id),
                vector_name: Some(vector_name),
                field: None,
                query: VectorSearchQuery::Dense { values },
                filter: None,
                metric: None,
                top_k: request.top_k,
                mode: VectorSearchMode::Exact,
                max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
            })
            .await?;
        Ok(view::search(&example, &result))
    }

    /// The similarity map: scroll the collection's points up to the map bound,
    /// then ask the engine for every point's nearest neighbours with one exact
    /// search each. Every link is an engine search hit; values stay native.
    /// `progress` hears how many of the searches have finished.
    pub async fn vector_map(
        self: &Arc<Self>,
        request: RrdVectorMapRequest,
        progress: impl Fn(VectorMapProgressView),
    ) -> Result<VectorMapView, RrdError> {
        let started = Instant::now();
        let collection_id = canonical(&request.collection_id, "collection")?;
        let vector_name = canonical(&request.vector_name, "vector name")?;
        let valid_at = now_unix_ms()?;

        let mut points: Vec<VectorPointSnapshot> = Vec::new();
        let mut after: Option<DataReference> = None;
        let mut keys_examined = 0u64;
        let mut cursors = None;
        let mut truncated = false;
        loop {
            let remaining = u64::try_from(MAX_VECTOR_MAP_POINTS - points.len())
                .map_err(|_| "similarity map bound does not fit a page size")?;
            let page = self
                .scroll(ScrollVectorPoints {
                    scope: self.scope(),
                    collection_id: collection_id.clone(),
                    vector_name: vector_name.clone(),
                    valid_at,
                    after_reference: after.clone(),
                    limit: remaining.min(MAX_VECTOR_POINT_PAGE),
                    max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
                    filter: None,
                })
                .await?;
            keys_examined = keys_examined.saturating_add(page.read_evidence.keys_examined);
            cursors = Some(widen(cursors, page.known_at_cursor));
            let progressed = !page.points.is_empty();
            points.extend(page.points);
            match page.next_after {
                None => break,
                Some(_) if points.len() >= MAX_VECTOR_MAP_POINTS => {
                    truncated = true;
                    break;
                }
                Some(next) if progressed || after.as_ref() != Some(&next) => after = Some(next),
                Some(_) => return Err("the vector point scroll stopped advancing".into()),
            }
        }

        let drawn: HashMap<(String, String), usize> = points
            .iter()
            .enumerate()
            .map(|(position, point)| (reference_key(&point.reference), position))
            .collect();
        let queries = points
            .iter()
            .enumerate()
            .filter_map(|(position, point)| match &point.value {
                DataVectorValue::Dense { values } => Some((position, values.clone())),
                _ => None,
            })
            .collect::<Vec<_>>();
        let unsearchable = points.len() - queries.len();
        let total = u64::try_from(queries.len()).map_err(|_| "too many map points")?;
        let drawn_points: Vec<MapPointView> = points
            .iter()
            .map(|point| MapPointView {
                reference: view::reference(&point.reference),
                subject: view::reference(&point.subject),
            })
            .collect();
        progress(VectorMapProgressView {
            searched: 0,
            total,
            points: Some(drawn_points.clone()),
            truncated,
        });

        let mut queries = queries.into_iter();
        let mut tasks = JoinSet::new();
        let mut links = Vec::new();
        let mut searches = 0u64;
        let mut exact = true;
        loop {
            while tasks.len() < VECTOR_MAP_CONCURRENCY {
                let Some((from, values)) = queries.next() else {
                    break;
                };
                let search = SearchVectors {
                    scope: self.scope(),
                    valid_at,
                    collection_id: Some(collection_id.clone()),
                    vector_name: Some(vector_name.clone()),
                    field: None,
                    query: VectorSearchQuery::Dense { values },
                    filter: None,
                    metric: None,
                    // The query point is its own best match.
                    top_k: VECTOR_MAP_NEIGHBOURS + 1,
                    mode: VectorSearchMode::Exact,
                    max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
                };
                let client = Arc::clone(self);
                tasks.spawn(async move { (from, client.search(search).await) });
            }
            let Some(joined) = tasks.join_next().await else {
                break;
            };
            let (from, result) =
                joined.map_err(|error| format!("a similarity search task failed: {error}"))?;
            let result = result?;
            searches += 1;
            exact &= result.exact;
            keys_examined = keys_examined.saturating_add(result.read_evidence.keys_examined);
            cursors = Some(widen(cursors, result.known_at_cursor));
            links.extend(neighbour_links(
                from,
                &result.hits,
                &drawn,
                VECTOR_MAP_NEIGHBOURS,
            ));
            progress(VectorMapProgressView {
                searched: searches,
                total,
                points: None,
                truncated,
            });
        }
        links.sort_by_key(|link| (link.from, link.rank));
        let (known_at_cursor_min, known_at_cursor_max) = cursors.unwrap_or_default();

        Ok(VectorMapView {
            collection_id: collection_id.as_str().into(),
            vector_name: vector_name.as_str().into(),
            points: drawn_points,
            links,
            neighbours: VECTOR_MAP_NEIGHBOURS,
            truncated,
            unsearchable,
            searches,
            exact,
            keys_examined,
            known_at_cursor_min,
            known_at_cursor_max,
            elapsed_ms: u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
        })
    }

    /// Closes the session once no request pins it; later requests fail closed.
    /// The session's open transaction ends with it, so a pending change is
    /// dropped, and so are held exports.
    pub async fn close(&self) -> Result<(), RrdError> {
        // Live subscriptions close their durable subscriptions first, while
        // the session that owns them is still open.
        self.live.close_all().await;
        let Some(lease) = self.lease.write().await.take() else {
            return Ok(());
        };
        *self.pending.lock().await = None;
        self.artifacts.clear();
        self.client
            .close_session(&lease.session, CloseSession {}, self.ids.next(true)?)
            .await
            .map(|_| ())
            .map_err(RrdError::sdk)
    }
}

#[cfg(test)]
mod process;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_and_identity_validation_fail_closed() {
        assert!(loopback_candidates("http://127.0.0.1:9477").is_ok());
        assert!(loopback_candidates("http://localhost:9477").is_ok());
        assert!(loopback_candidates("https://runtime.example.com").is_err());
        assert!(loopback_candidates("http://runtime.example.com:9477").is_err());
        assert!(canonical("instance-one", "instance").is_ok());
        assert!(canonical("Instance-One", "instance").is_err());
        assert!(data_reference(&RrdReference {
            kind: "document".into(),
            id: "readme".into()
        })
        .is_ok());
        assert!(data_reference(&RrdReference {
            kind: "Document".into(),
            id: "readme".into()
        })
        .is_err());
    }

    #[test]
    fn request_ids_never_repeat_across_connections() {
        let first = RequestIds::new();
        let second = RequestIds::new();
        let a = first.next(true).expect("valid mutation options");
        let b = first.next(true).expect("valid mutation options");
        let c = second.next(true).expect("valid mutation options");
        // Every connection's first session request used to carry the same key,
        // so the engine answered it with the session an earlier launch opened.
        assert_ne!(a.idempotency_key, b.idempotency_key);
        assert_ne!(a.idempotency_key, c.idempotency_key);
        assert_ne!(a.request_id, c.request_id);
        assert_ne!(a.operation_id, c.operation_id);
        assert!(a.request_id.as_str().ends_with("-request-1"));
        assert!(c.request_id.as_str().ends_with("-request-1"));
        let read = second.next(false).expect("valid read options");
        assert!(read.idempotency_key.is_none());
        assert!(read.request_id.as_str().ends_with("-request-2"));
    }

    #[test]
    fn request_ids_fail_closed_when_the_sequence_is_exhausted() {
        let ids = RequestIds {
            run: "run".into(),
            sequence: AtomicU64::new(u64::MAX),
        };
        assert!(ids.next(false).is_err());
    }

    fn limits(idle_ms: u64, absolute_ms: u64) -> SessionLimits {
        SessionLimits {
            idle_timeout_ms: idle_ms,
            absolute_timeout_ms: absolute_ms,
            max_open_transactions: 1,
        }
    }

    #[test]
    fn a_lease_is_handed_out_only_while_it_outlives_a_request() {
        let start = Instant::now();
        let deadlines = Deadlines::granted(start, &limits(900_000, 3_600_000)).expect("deadlines");
        let margin = SESSION_RENEWAL_MARGIN;
        let idle = Duration::from_millis(900_000);
        assert!(deadlines.outlive_request(start));
        assert!(deadlines.outlive_request(start + idle - margin - Duration::from_millis(1)));
        assert!(!deadlines.outlive_request(start + idle - margin));
        assert!(!deadlines.outlive_request(start + idle + idle));
    }

    #[test]
    fn renewal_restarts_the_idle_timer_but_never_the_absolute_one() {
        let start = Instant::now();
        let session = limits(900_000, 3_600_000);
        let deadlines = Deadlines::granted(start, &session).expect("deadlines");
        let later = start + Duration::from_millis(850_000);
        assert!(!deadlines.outlive_request(later));
        assert!(deadlines.renewable(later));
        let renewed = deadlines.renewed(later, &session).expect("renewed");
        assert!(renewed.outlive_request(later));
        assert_eq!(renewed.absolute, deadlines.absolute);
        // Near the absolute deadline only a new session can help.
        let late = deadlines.absolute - SESSION_RENEWAL_MARGIN;
        assert!(!deadlines.renewable(late));
        assert!(!renewed.outlive_request(late));
    }

    fn hit(id: &str, score: f64) -> VectorSearchHit {
        let reference = DataReference {
            kind: canonical("embedding", "kind").expect("kind"),
            id: canonical(id, "id").expect("id"),
        };
        VectorSearchHit {
            subject: reference.clone(),
            reference,
            source_cursor: 1,
            score,
        }
    }

    #[test]
    fn map_links_rank_drawn_neighbours_and_skip_the_query_point() {
        let drawn: HashMap<(String, String), usize> = ["a", "b", "c", "d"]
            .iter()
            .enumerate()
            .map(|(position, id)| (("embedding".to_owned(), (*id).to_owned()), position))
            .collect();
        // The query point leads its own hits; "x" is outside the drawn bound.
        let hits = [
            hit("a", 1.0),
            hit("c", 0.9),
            hit("x", 0.8),
            hit("b", 0.7),
            hit("d", 0.6),
        ];
        let links = neighbour_links(0, &hits, &drawn, 2);
        let pairs: Vec<(usize, usize, usize)> = links
            .iter()
            .map(|link| (link.from, link.to, link.rank))
            .collect();
        assert_eq!(pairs, [(0, 2, 1), (0, 1, 2)]);
        assert!((links[0].score - 0.9).abs() < f64::EPSILON);
        assert!(neighbour_links(3, &[], &drawn, 5).is_empty());
    }

    #[test]
    fn cursor_ranges_widen_across_reads() {
        let range = widen(None, 7);
        assert_eq!(range, (7, 7));
        let range = widen(Some(range), 4);
        assert_eq!(widen(Some(range), 9), (4, 9));
    }

    #[test]
    fn localhost_resolves_to_the_loopback_family_that_listens() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind IPv4 loopback");
        let listening = listener.local_addr().expect("listener address");
        let refused = std::net::TcpListener::bind("127.0.0.1:0")
            .and_then(|closed| closed.local_addr())
            .expect("reserve a closed port");
        let chosen = tauri::async_runtime::block_on(reachable_loopback(&[refused, listening]))
            .expect("one loopback address accepts");
        assert_eq!(chosen, listening);
        assert!(tauri::async_runtime::block_on(reachable_loopback(&[refused])).is_err());
    }

    #[test]
    fn credential_file_is_read_natively_and_redacted() {
        let directory = std::env::temp_dir().join(format!(
            "connectome-credential-{}",
            now_unix_ms().expect("clock")
        ));
        std::fs::create_dir_all(&directory).expect("create credential directory");
        let path = directory.join("local-operator.json");
        std::fs::write(
            &path,
            r#"{"format_version":1,"plan_sha256":"00","principal_id":"local-operator","credential_bytes":32,"credential":"secret-value"}"#,
        )
        .expect("write credential");
        let (principal, secret) =
            read_credential(path.to_str().expect("utf-8 path")).expect("read credential");
        assert_eq!(principal.as_str(), "local-operator");
        assert_eq!(format!("{secret:?}"), "[REDACTED]");
        std::fs::write(&path, r#"{"principal_id":"Local","credential":"x"}"#).expect("rewrite");
        assert!(read_credential(path.to_str().expect("utf-8 path")).is_err());
        std::fs::remove_dir_all(directory).expect("remove credential directory");
    }
}
