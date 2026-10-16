//! Authenticated native RRD session built on RRFlow's Rust SDK.
//!
//! `rrd-client` and `rrd-contract` own every request and response type and
//! validate each response before Connectome projects it into a view model.
//! The operator credential and the session bearer stay in this process; the
//! webview receives only `view` projections.

use super::transport::{is_loopback_origin, rrd_origin};
use super::view::{
    self, ConnectionView, DatabaseView, QueryView, ServiceView, SessionView, StorageView,
    VectorCollectionsView, VectorPointsView, VectorSearchView,
};
use rrd_client::{ClientConfig, RequestOptions, RrdClient, Session};
use rrd_contract::{
    CanonicalId, CloseSession, CreateSession, DataReference, DataVectorValue, DiagnosticSnapshot,
    ExecuteQuery, ListVectorCollections, QueryBudget, ReadDiagnosticSnapshot, RetrieveVectorPoints,
    ScrollVectorPoints, SearchVectors, ServiceCapabilities, SessionLimits, VectorSearchMode,
    VectorSearchQuery, MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES, MAX_QUERY_BYTES,
    MAX_VECTOR_POINT_PAGE, MAX_VECTOR_SEARCH_TOP_K, MAX_VECTOR_STORAGE_KEYS,
};
use serde::Deserialize;
use std::fmt;
use std::net::{SocketAddr, ToSocketAddrs};
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// Connectome's own session policy; the engine enforces its own ceilings.
const SESSION_IDLE_TIMEOUT_MS: u64 = 900_000;
const SESSION_ABSOLUTE_TIMEOUT_MS: u64 = 3_600_000;
const SESSION_RENEWAL_MARGIN_MS: u64 = 30_000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
/// Most recent change-feed and audit records the Storage lens renders.
const RECENT_CHANGES: u64 = 64;
const RECENT_AUDIT_RECORDS: u16 = 64;
const MAX_CREDENTIAL_FILE_BYTES: u64 = 16 * 1024;

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

pub struct NativeRrdClient {
    client: RrdClient,
    endpoint: String,
    instance: CanonicalId,
    principal: CanonicalId,
    api_key: Secret,
    session: Session,
    connected_at_unix_ms: u64,
    service: ServiceView,
    /// The estate's configured query budget, read from its capability document.
    query_budget: QueryBudget,
    sequence: u64,
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

fn loopback_address(endpoint: &str) -> Result<(String, SocketAddr), String> {
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
    let address = (host.trim_matches(|c| c == '[' || c == ']'), port)
        .to_socket_addrs()
        .map_err(|error| format!("cannot resolve RRD loopback endpoint: {error}"))?
        .find(|address| address.ip().is_loopback())
        .ok_or("RRD endpoint does not resolve to a loopback address")?;
    Ok((origin.as_str().trim_end_matches('/').to_owned(), address))
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

fn session_view(session: &Session) -> SessionView {
    SessionView {
        session_id: session.session_id().as_str().into(),
        issued_at_unix_ms: session.issued_at_unix_ms(),
        idle_expires_at_unix_ms: session.idle_expires_at_unix_ms(),
        absolute_expires_at_unix_ms: session.absolute_expires_at_unix_ms(),
    }
}

fn sdk_error(error: rrd_client::Error) -> String {
    error.to_string()
}

/// Per-connection request correlation; mutations also carry an idempotency key.
fn request_options(sequence: &mut u64, mutation: bool) -> Result<RequestOptions, String> {
    *sequence = sequence
        .checked_add(1)
        .ok_or("Connectome RRD request sequence exhausted")?;
    let request = format!("connectome-request-{sequence}");
    let operation = format!("connectome-operation-{sequence}");
    let options = if mutation {
        RequestOptions::mutation(&request, &operation, &format!("connectome-key-{sequence}"))
    } else {
        RequestOptions::read(&request, &operation)
    };
    options.map_err(sdk_error)
}

async fn create_session(
    client: &RrdClient,
    principal: &CanonicalId,
    api_key: &Secret,
    sequence: &mut u64,
) -> Result<Session, String> {
    let request = CreateSession {
        limits: SessionLimits {
            idle_timeout_ms: SESSION_IDLE_TIMEOUT_MS,
            absolute_timeout_ms: SESSION_ABSOLUTE_TIMEOUT_MS,
            max_open_transactions: 1,
        },
    };
    client
        .create_session(
            principal.clone(),
            &api_key.0,
            request,
            request_options(sequence, true)?,
        )
        .await
        .map_err(sdk_error)
}

impl NativeRrdClient {
    pub async fn connect(request: RrdConnectRequest) -> Result<Self, String> {
        let (endpoint, address) = loopback_address(&request.endpoint)?;
        let instance = canonical(&request.instance, "instance")?;
        let (principal, api_key) = read_credential(&request.credential_path)?;
        let config = ClientConfig {
            request_timeout: REQUEST_TIMEOUT,
            ..ClientConfig::default()
        };
        let client =
            RrdClient::connect_local(address, instance.clone(), config).map_err(sdk_error)?;
        // The SDK validates the capability contract and the exact instance identity.
        let capabilities = client.capabilities().await.map_err(sdk_error)?;
        let mut sequence = 0;
        let session = create_session(&client, &principal, &api_key, &mut sequence).await?;
        Ok(Self {
            client,
            endpoint,
            instance,
            principal,
            api_key,
            session,
            connected_at_unix_ms: now_unix_ms()?,
            service: view::service(&capabilities),
            query_budget: capabilities.configuration.query.clone(),
            sequence,
        })
    }

    /// The session as the webview may see it: identities, expiry, and service.
    pub fn connection(&self) -> ConnectionView {
        ConnectionView {
            endpoint: self.endpoint.clone(),
            instance: self.instance.as_str().into(),
            principal: self.principal.as_str().into(),
            connected_at_unix_ms: self.connected_at_unix_ms,
            session: session_view(&self.session),
            service: self.service.clone(),
        }
    }

    fn scope(&self) -> String {
        format!("instance:{}", self.instance.as_str())
    }

    fn options(&mut self, mutation: bool) -> Result<RequestOptions, String> {
        request_options(&mut self.sequence, mutation)
    }

    /// Replace the session before it can expire mid-request.
    async fn ensure_session(&mut self) -> Result<(), String> {
        let boundary = now_unix_ms()?.saturating_add(SESSION_RENEWAL_MARGIN_MS);
        if boundary >= self.session.idle_expires_at_unix_ms()
            || boundary >= self.session.absolute_expires_at_unix_ms()
        {
            self.session = create_session(
                &self.client,
                &self.principal,
                &self.api_key,
                &mut self.sequence,
            )
            .await?;
        }
        Ok(())
    }

    pub async fn capabilities(&self) -> Result<ServiceCapabilities, String> {
        self.client.capabilities().await.map_err(sdk_error)
    }

    async fn diagnostic_snapshot(&mut self) -> Result<DiagnosticSnapshot, String> {
        self.ensure_session().await?;
        let request = ReadDiagnosticSnapshot {
            scope: self.scope(),
            graph_valid_at_unix_ms: now_unix_ms()?,
            graph_known_at_cursor: None,
            graph_compare_cursor: 0,
            runtime_max_scanned_changes: MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES,
            changes_after_cursor: 0,
            change_limit: RECENT_CHANGES,
            audit_after_sequence: 0,
            audit_limit: RECENT_AUDIT_RECORDS,
        };
        let options = self.options(false)?;
        self.client
            .read_diagnostic_snapshot(&self.session, request, options)
            .await
            .map_err(sdk_error)
    }

    pub async fn database(&mut self) -> Result<DatabaseView, String> {
        Ok(view::database(&self.diagnostic_snapshot().await?))
    }

    pub async fn storage(&mut self) -> Result<StorageView, String> {
        let snapshot = self.diagnostic_snapshot().await?;
        Ok(view::storage(&snapshot, &self.service.storage_profile))
    }

    pub async fn query(&mut self, request: RrdQueryRequest) -> Result<QueryView, String> {
        if request.query.trim().is_empty()
            || request.query.len() > MAX_QUERY_BYTES
            || request.query.contains('\0')
        {
            return Err(format!(
                "RRFlowQL query must be non-empty, at most {MAX_QUERY_BYTES} bytes, and free of NUL"
            ));
        }
        self.ensure_session().await?;
        let request = ExecuteQuery {
            scope: self.scope(),
            query: request.query,
            parameters: Default::default(),
            budget: self.query_budget.clone(),
        };
        let options = self.options(false)?;
        let result = self
            .client
            .execute_query(&self.session, request, options)
            .await
            .map_err(sdk_error)?;
        Ok(view::query(&result))
    }

    pub async fn vector_collections(&mut self) -> Result<VectorCollectionsView, String> {
        self.ensure_session().await?;
        let request = ListVectorCollections {
            scope: self.scope(),
        };
        let options = self.options(false)?;
        let catalogue = self
            .client
            .list_vector_collections(&self.session, request, options)
            .await
            .map_err(sdk_error)?;
        Ok(view::collections(&catalogue))
    }

    pub async fn vector_points(
        &mut self,
        request: RrdVectorPointsRequest,
    ) -> Result<VectorPointsView, String> {
        if request.limit == 0 || request.limit > MAX_VECTOR_POINT_PAGE {
            return Err(format!(
                "vector page size must be in 1..={MAX_VECTOR_POINT_PAGE}"
            ));
        }
        self.ensure_session().await?;
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
        let options = self.options(false)?;
        let page = self
            .client
            .scroll_vector_points(&self.session, request, options)
            .await
            .map_err(sdk_error)?;
        Ok(view::points(&page))
    }

    /// Query by example: retrieve one stored dense vector, then search its collection.
    pub async fn vector_search(
        &mut self,
        request: RrdVectorSearchRequest,
    ) -> Result<VectorSearchView, String> {
        if request.top_k == 0 || request.top_k > MAX_VECTOR_SEARCH_TOP_K {
            return Err(format!("top_k must be in 1..={MAX_VECTOR_SEARCH_TOP_K}"));
        }
        self.ensure_session().await?;
        let collection_id = canonical(&request.collection_id, "collection")?;
        let vector_name = canonical(&request.vector_name, "vector name")?;
        let example = data_reference(&request.example)?;
        let valid_at = now_unix_ms()?;
        let retrieve = RetrieveVectorPoints {
            scope: self.scope(),
            collection_id: collection_id.clone(),
            vector_name: vector_name.clone(),
            valid_at,
            references: vec![example.clone()],
            max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
        };
        let options = self.options(false)?;
        let batch = self
            .client
            .retrieve_vector_points(&self.session, retrieve, options)
            .await
            .map_err(sdk_error)?;
        let point = batch
            .points
            .into_iter()
            .find(|point| point.reference == example)
            .ok_or("the example vector is not visible at the current read stamp")?;
        let DataVectorValue::Dense { values } = point.value else {
            return Err("query by example currently supports dense vectors only".into());
        };
        let search = SearchVectors {
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
        };
        let options = self.options(false)?;
        let result = self
            .client
            .search_vectors(&self.session, search, options)
            .await
            .map_err(sdk_error)?;
        Ok(view::search(&example, &result))
    }

    pub async fn close(mut self) -> Result<(), String> {
        let options = self.options(true)?;
        self.client
            .close_session(&self.session, CloseSession {}, options)
            .await
            .map(|_| ())
            .map_err(sdk_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_and_identity_validation_fail_closed() {
        assert!(loopback_address("http://127.0.0.1:9477").is_ok());
        assert!(loopback_address("http://localhost:9477").is_ok());
        assert!(loopback_address("https://runtime.example.com").is_err());
        assert!(loopback_address("http://runtime.example.com:9477").is_err());
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
