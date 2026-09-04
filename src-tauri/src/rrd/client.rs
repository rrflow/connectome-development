use super::transport::{is_loopback_origin, rrd_origin};
use reqwest::{redirect::Policy, Client, Method, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::Url;

const RRD_PROTOCOL: &str = "rrd";
const RRD_PROTOCOL_VERSION: u64 = 1;
const MAX_RRD_RESPONSE_BYTES: usize = 4 * 1024 * 1024;
const MAX_CONTEXT_QUERY_BYTES: usize = 64 * 1024;
const MAX_CONTEXT_SEEDS: usize = 256;
const MAX_CONTEXT_ITEMS: u64 = 512;
const MAX_CONTEXT_OUTPUT_BYTES: u64 = 768 * 1024;
const MAX_CONTEXT_SCANNED_CHANGES: u64 = 1_000_000;
const MAX_CONTEXT_GRAPH_DEPTH: u8 = 32;
const SESSION_RENEWAL_MARGIN_MS: u64 = 30_000;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdConnectRequest {
    pub endpoint: String,
    pub instance: String,
    pub principal: String,
    pub api_key: String,
    pub scope: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdContextRequest {
    pub query: String,
    #[serde(default)]
    pub seeds: Vec<Value>,
    #[serde(default)]
    pub valid_at: Option<u64>,
    #[serde(default = "default_graph_depth")]
    pub max_graph_depth: u8,
    #[serde(default = "default_max_items")]
    pub max_items: u64,
    #[serde(default = "default_output_bytes")]
    pub max_output_bytes: u64,
    #[serde(default = "default_scanned_changes")]
    pub max_scanned_changes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RrdSessionSummary {
    pub session_id: String,
    pub issued_at_unix_ms: u64,
    pub idle_expires_at_unix_ms: u64,
    pub absolute_expires_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct RrdConnectionSummary {
    pub endpoint: String,
    pub instance: String,
    pub principal: String,
    pub scope: String,
    pub connected_at_unix_ms: u64,
    pub session: RrdSessionSummary,
    pub service: Value,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct SessionLease {
    session_id: String,
    token: String,
    issued_at_unix_ms: u64,
    idle_expires_at_unix_ms: u64,
    absolute_expires_at_unix_ms: u64,
    limits: Value,
}

impl SessionLease {
    fn validate(&self) -> Result<(), String> {
        validate_correlation_id(&self.session_id, "session id")?;
        validate_correlation_id(&self.token, "session token")?;
        if self.issued_at_unix_ms == 0
            || self.idle_expires_at_unix_ms <= self.issued_at_unix_ms
            || self.absolute_expires_at_unix_ms < self.idle_expires_at_unix_ms
            || !self.limits.is_object()
        {
            return Err("RRD returned an invalid session lease".into());
        }
        Ok(())
    }

    fn summary(&self) -> RrdSessionSummary {
        RrdSessionSummary {
            session_id: self.session_id.clone(),
            issued_at_unix_ms: self.issued_at_unix_ms,
            idle_expires_at_unix_ms: self.idle_expires_at_unix_ms,
            absolute_expires_at_unix_ms: self.absolute_expires_at_unix_ms,
        }
    }
}

struct Secret(String);

pub struct NativeRrdClient {
    http: Client,
    endpoint: Url,
    instance: String,
    principal: String,
    api_key: Secret,
    scope: String,
    session: Option<SessionLease>,
    sequence: u64,
}

impl NativeRrdClient {
    pub async fn connect(
        request: RrdConnectRequest,
    ) -> Result<(Self, RrdConnectionSummary), String> {
        let endpoint = rrd_origin(&request.endpoint)?;
        if endpoint.scheme() != "http" || !is_loopback_origin(&endpoint) {
            return Err(
                "authenticated RRD connections currently require loopback HTTP; remote mode requires the future mutual-TLS adapter"
                    .into(),
            );
        }
        validate_canonical_id(&request.instance, "instance")?;
        validate_canonical_id(&request.principal, "principal")?;
        validate_scope(&request.scope)?;
        if request.api_key.is_empty() || request.api_key.as_bytes().contains(&0) {
            return Err("RRD API key is empty or contains NUL".into());
        }
        let http = Client::builder()
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(15))
            .redirect(Policy::none())
            .build()
            .map_err(|error| format!("cannot build RRD HTTP client: {error}"))?;
        let mut client = Self {
            http,
            endpoint,
            instance: request.instance,
            principal: request.principal,
            api_key: Secret(request.api_key),
            scope: request.scope,
            session: None,
            sequence: 0,
        };
        let service = client.public_get("/v1/capabilities").await?;
        validate_service_capabilities(&service, &client.instance)?;
        let session = client.create_session().await?;
        let summary = RrdConnectionSummary {
            endpoint: client.endpoint.as_str().trim_end_matches('/').to_owned(),
            instance: client.instance.clone(),
            principal: client.principal.clone(),
            scope: client.scope.clone(),
            connected_at_unix_ms: now_unix_ms()?,
            session: session.summary(),
            service,
        };
        client.session = Some(session);
        Ok((client, summary))
    }

    pub async fn capabilities(&self) -> Result<Value, String> {
        let service = self.public_get("/v1/capabilities").await?;
        validate_service_capabilities(&service, &self.instance)?;
        Ok(service)
    }

    pub async fn diagnostic_snapshot(&mut self) -> Result<Value, String> {
        self.ensure_session().await?;
        let now = now_unix_ms()?;
        let payload = json!({
            "scope": self.scope,
            "graph_valid_at_unix_ms": now,
            "graph_known_at_cursor": null,
            "graph_compare_cursor": 0,
            "runtime_max_scanned_changes": 1_000_000,
            "changes_after_cursor": 0,
            "change_limit": 4_096,
            "audit_after_sequence": 0,
            "audit_limit": 1_024,
        });
        self.authenticated_call(Method::POST, "/v1/diagnostics/read", payload, false)
            .await
    }

    pub async fn assemble_context(&mut self, request: RrdContextRequest) -> Result<Value, String> {
        request.validate()?;
        self.ensure_session().await?;
        let payload = json!({
            "scope": self.scope,
            "query": request.query,
            "valid_at": request.valid_at.unwrap_or(now_unix_ms()?),
            "seeds": request.seeds,
            "max_graph_depth": request.max_graph_depth,
            "max_items": request.max_items,
            "max_output_bytes": request.max_output_bytes,
            "max_scanned_changes": request.max_scanned_changes,
        });
        self.authenticated_call(Method::POST, "/v1/context/assemble", payload, false)
            .await
    }

    pub async fn close(mut self) -> Result<(), String> {
        self.ensure_session().await?;
        let path = format!("/v1/sessions/{}", self.session()?.session_id);
        self.authenticated_call(Method::DELETE, &path, json!({}), true)
            .await?;
        Ok(())
    }

    async fn ensure_session(&mut self) -> Result<(), String> {
        let renewal_boundary = now_unix_ms()?.saturating_add(SESSION_RENEWAL_MARGIN_MS);
        let session = self.session()?;
        if renewal_boundary >= session.idle_expires_at_unix_ms
            || renewal_boundary >= session.absolute_expires_at_unix_ms
        {
            self.session = Some(self.create_session().await?);
        }
        Ok(())
    }

    async fn create_session(&mut self) -> Result<SessionLease, String> {
        let (request_id, operation_id, idempotency_key) = self.next_context(true)?;
        let envelope = self.envelope(
            json!({
                "limits": {
                    "idle_timeout_ms": 900_000,
                    "absolute_timeout_ms": 3_600_000,
                    "max_open_transactions": 4,
                }
            }),
            &request_id,
            &operation_id,
            idempotency_key.as_deref(),
        );
        let response = self
            .http
            .post(self.api_url("/v1/sessions"))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("X-RRD-Principal", &self.principal)
            .header("Authorization", format!("ApiKey {}", self.api_key.0))
            .body(
                serde_json::to_vec(&envelope)
                    .map_err(|error| format!("cannot encode RRD session request: {error}"))?,
            )
            .send()
            .await
            .map_err(|error| format!("RRD session request failed: {error}"))?;
        let payload = response_payload(response, Some((&request_id, &operation_id))).await?;
        let lease: SessionLease = serde_json::from_value(payload)
            .map_err(|error| format!("RRD returned an invalid session lease: {error}"))?;
        lease.validate()?;
        Ok(lease)
    }

    async fn authenticated_call(
        &mut self,
        method: Method,
        path: &str,
        payload: Value,
        mutation: bool,
    ) -> Result<Value, String> {
        let (session_id, token) = {
            let session = self.session()?;
            (session.session_id.clone(), session.token.clone())
        };
        let (request_id, operation_id, idempotency_key) = self.next_context(mutation)?;
        let envelope = self.envelope(
            payload,
            &request_id,
            &operation_id,
            idempotency_key.as_deref(),
        );
        let response = self
            .http
            .request(method, self.api_url(path))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("X-RRD-Session", session_id)
            .header("Authorization", format!("Bearer {token}"))
            .body(
                serde_json::to_vec(&envelope)
                    .map_err(|error| format!("cannot encode RRD request: {error}"))?,
            )
            .send()
            .await
            .map_err(|error| format!("RRD authenticated request failed: {error}"))?;
        response_payload(response, Some((&request_id, &operation_id))).await
    }

    async fn public_get(&self, path: &str) -> Result<Value, String> {
        let response = self
            .http
            .get(self.api_url(path))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| format!("RRD HTTP request failed: {error}"))?;
        response_payload(response, None).await
    }

    fn next_context(&mut self, mutation: bool) -> Result<(String, String, Option<String>), String> {
        self.sequence = self
            .sequence
            .checked_add(1)
            .ok_or("Connectome RRD request sequence exhausted")?;
        let request_id = format!("connectome-request-{}", self.sequence);
        let operation_id = format!("connectome-operation-{}", self.sequence);
        let idempotency_key = mutation.then(|| format!("connectome-key-{}", self.sequence));
        Ok((request_id, operation_id, idempotency_key))
    }

    fn envelope(
        &self,
        payload: Value,
        request_id: &str,
        operation_id: &str,
        idempotency_key: Option<&str>,
    ) -> Value {
        json!({
            "protocol": RRD_PROTOCOL,
            "protocol_version": RRD_PROTOCOL_VERSION,
            "context": {
                "request_id": request_id,
                "operation_id": operation_id,
                "idempotency_key": idempotency_key,
                "deadline_unix_ms": null,
            },
            "resource": {
                "segments": [{"kind": "instance", "id": self.instance}],
            },
            "payload": payload,
        })
    }

    fn api_url(&self, path: &str) -> Url {
        let mut url = self.endpoint.clone();
        url.set_path(path);
        url
    }

    fn session(&self) -> Result<&SessionLease, String> {
        self.session
            .as_ref()
            .ok_or_else(|| "Connectome has no authenticated RRD session".into())
    }
}

impl RrdContextRequest {
    fn validate(&self) -> Result<(), String> {
        if self.query.len() > MAX_CONTEXT_QUERY_BYTES || self.query.as_bytes().contains(&0) {
            return Err("context query exceeds its byte bound or contains NUL".into());
        }
        if self.seeds.is_empty() && self.query.trim().is_empty() {
            return Err("context request requires a query or at least one seed".into());
        }
        if self.seeds.len() > MAX_CONTEXT_SEEDS {
            return Err("context request exceeds its seed bound".into());
        }
        let unique = self
            .seeds
            .iter()
            .map(Value::to_string)
            .collect::<BTreeSet<_>>();
        if unique.len() != self.seeds.len() {
            return Err("context seeds must be unique".into());
        }
        if self.valid_at == Some(0)
            || self.max_graph_depth > MAX_CONTEXT_GRAPH_DEPTH
            || self.max_items == 0
            || self.max_items > MAX_CONTEXT_ITEMS
            || self.max_output_bytes == 0
            || self.max_output_bytes > MAX_CONTEXT_OUTPUT_BYTES
            || self.max_scanned_changes == 0
            || self.max_scanned_changes > MAX_CONTEXT_SCANNED_CHANGES
        {
            return Err("context request exceeds the public RRD bounds".into());
        }
        Ok(())
    }
}

async fn response_payload(
    mut response: Response,
    expected: Option<(&str, &str)>,
) -> Result<Value, String> {
    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RRD_RESPONSE_BYTES as u64)
    {
        return Err("RRD response exceeds four MiB".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("cannot read RRD response: {error}"))?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_RRD_RESPONSE_BYTES {
            return Err("RRD response exceeds four MiB".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let envelope: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("RRD returned invalid JSON: {error}"))?;
    if envelope["protocol"] != RRD_PROTOCOL || envelope["protocol_version"] != RRD_PROTOCOL_VERSION
    {
        return Err("endpoint does not implement RRD protocol v1".into());
    }
    let request_id = envelope["request_id"]
        .as_str()
        .ok_or("RRD response has no request identity")?;
    let operation_id = envelope["operation_id"]
        .as_str()
        .ok_or("RRD response has no operation identity")?;
    if let Some((expected_request, expected_operation)) = expected {
        if request_id != expected_request || operation_id != expected_operation {
            return Err("RRD response request/operation identity differs".into());
        }
    }
    let outcome = envelope["outcome"]
        .as_object()
        .ok_or("RRD response has no outcome")?;
    if outcome.get("status").and_then(Value::as_str) == Some("ok") && status.is_success() {
        return outcome
            .get("payload")
            .cloned()
            .ok_or_else(|| "RRD success response has no payload".into());
    }
    let message = outcome
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("RRD rejected the request");
    Err(format!("RRD returned {status}: {message}"))
}

fn validate_canonical_id(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 256
        || !value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'-' | b'_' | b'.'))
        })
    {
        return Err(format!("{label} is not a canonical RRD identifier"));
    }
    Ok(())
}

fn validate_correlation_id(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 256
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
    {
        return Err(format!("RRD returned an invalid {label}"));
    }
    Ok(())
}

fn validate_scope(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 256 || value.as_bytes().contains(&0) {
        return Err("RRD scope must be a non-empty bounded string without NUL".into());
    }
    Ok(())
}

fn validate_service_capabilities(service: &Value, expected_instance: &str) -> Result<(), String> {
    if service["protocol"] != RRD_PROTOCOL
        || service["protocol_version"] != RRD_PROTOCOL_VERSION
        || service["instance"]["kind"] != "instance"
        || !service["capabilities"].is_array()
        || !service["product_capabilities"].is_object()
    {
        return Err("RRD returned an invalid service capability contract".into());
    }
    let observed_instance = service["instance"]["id"]
        .as_str()
        .ok_or("RRD capability response has no instance identity")?;
    if observed_instance != expected_instance {
        return Err(format!(
            "RRD instance mismatch: expected {expected_instance}, received {observed_instance}"
        ));
    }
    Ok(())
}

fn now_unix_ms() -> Result<u64, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch")?
        .as_millis();
    u64::try_from(millis).map_err(|_| "system clock does not fit RRD time".into())
}

const fn default_graph_depth() -> u8 {
    2
}

const fn default_max_items() -> u64 {
    32
}

const fn default_output_bytes() -> u64 {
    256 * 1024
}

const fn default_scanned_changes() -> u64 {
    100_000
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    #[test]
    fn request_validation_matches_the_public_rrd_bounds() {
        assert!(validate_canonical_id("project-one", "instance").is_ok());
        assert!(validate_canonical_id("Project-One", "instance").is_err());
        assert!(validate_scope("instance:project-one").is_ok());
        assert!(RrdContextRequest {
            query: String::new(),
            seeds: Vec::new(),
            valid_at: Some(1),
            max_graph_depth: 2,
            max_items: 32,
            max_output_bytes: 4096,
            max_scanned_changes: 100,
        }
        .validate()
        .is_err());

        let remote = tauri::async_runtime::block_on(NativeRrdClient::connect(RrdConnectRequest {
            endpoint: "https://runtime.example.com".into(),
            instance: "instance-one".into(),
            principal: "connectome-client".into(),
            api_key: "must-not-leave-over-server-auth-only".into(),
            scope: "instance:instance-one".into(),
        }));
        assert!(matches!(remote, Err(error) if error.contains("mutual-TLS")));
    }

    #[test]
    fn authenticated_client_uses_one_native_rrd_session_for_diagnostics_and_context() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind fake RRD");
        let address = listener.local_addr().expect("read fake RRD address");
        let server = thread::spawn(move || {
            respond(
                listener.accept().expect("accept capability request").0,
                "server-request",
                "server-operation",
                json!({
                    "protocol": "rrd",
                    "protocol_version": 1,
                    "instance": {"kind": "instance", "id": "instance-one"},
                    "capabilities": [],
                    "product_capabilities": {"contract_version": 1, "capabilities": []},
                }),
                |request, _, body| {
                    assert_eq!(request, "GET /v1/capabilities HTTP/1.1");
                    assert_eq!(body, &Value::Null);
                },
            );
            respond(
                listener.accept().expect("accept session request").0,
                "connectome-request-1",
                "connectome-operation-1",
                json!({
                    "session_id": "session-one",
                    "token": "token-one",
                    "issued_at_unix_ms": 1,
                    "idle_expires_at_unix_ms": u64::MAX - 1,
                    "absolute_expires_at_unix_ms": u64::MAX,
                    "limits": {
                        "idle_timeout_ms": 900_000,
                        "absolute_timeout_ms": 3_600_000,
                        "max_open_transactions": 4,
                    }
                }),
                |request, headers, body| {
                    assert_eq!(request, "POST /v1/sessions HTTP/1.1");
                    assert_eq!(headers["x-rrd-principal"], "connectome-client");
                    assert_eq!(headers["authorization"], "ApiKey test-api-key");
                    assert_eq!(body["protocol"], "rrd");
                    assert_eq!(body["resource"]["segments"][0]["id"], "instance-one");
                    assert_eq!(body["context"]["idempotency_key"], "connectome-key-1");
                },
            );
            respond(
                listener.accept().expect("accept diagnostic request").0,
                "connectome-request-2",
                "connectome-operation-2",
                json!({"format_version": 1, "scope": "instance:instance-one"}),
                |request, headers, body| {
                    assert_eq!(request, "POST /v1/diagnostics/read HTTP/1.1");
                    assert_eq!(headers["x-rrd-session"], "session-one");
                    assert_eq!(headers["authorization"], "Bearer token-one");
                    assert_eq!(body["payload"]["scope"], "instance:instance-one");
                    assert_eq!(body["context"]["idempotency_key"], Value::Null);
                },
            );
            respond(
                listener.accept().expect("accept context request").0,
                "connectome-request-3",
                "connectome-operation-3",
                json!({"contract_version": 1, "items": []}),
                |request, headers, body| {
                    assert_eq!(request, "POST /v1/context/assemble HTTP/1.1");
                    assert_eq!(headers["x-rrd-session"], "session-one");
                    assert_eq!(headers["authorization"], "Bearer token-one");
                    assert_eq!(body["payload"]["query"], "find alpha");
                    assert_eq!(body["payload"]["max_graph_depth"], 2);
                },
            );
            respond(
                listener.accept().expect("accept close request").0,
                "connectome-request-4",
                "connectome-operation-4",
                json!({"state": "closed"}),
                |request, headers, body| {
                    assert_eq!(request, "DELETE /v1/sessions/session-one HTTP/1.1");
                    assert_eq!(headers["authorization"], "Bearer token-one");
                    assert_eq!(body["context"]["idempotency_key"], "connectome-key-4");
                },
            );
        });

        let (mut client, summary) =
            tauri::async_runtime::block_on(NativeRrdClient::connect(RrdConnectRequest {
                endpoint: format!("http://{address}"),
                instance: "instance-one".into(),
                principal: "connectome-client".into(),
                api_key: "test-api-key".into(),
                scope: "instance:instance-one".into(),
            }))
            .expect("connect to fake native RRD");
        assert_eq!(summary.instance, "instance-one");
        assert_eq!(summary.session.session_id, "session-one");
        let encoded_summary = serde_json::to_string(&summary).expect("encode public summary");
        assert!(!encoded_summary.contains("test-api-key"));
        assert!(!encoded_summary.contains("token-one"));

        let snapshot = tauri::async_runtime::block_on(client.diagnostic_snapshot())
            .expect("read diagnostic snapshot");
        assert_eq!(snapshot["format_version"], 1);
        let packet = tauri::async_runtime::block_on(client.assemble_context(RrdContextRequest {
            query: "find alpha".into(),
            seeds: Vec::new(),
            valid_at: Some(100),
            max_graph_depth: 2,
            max_items: 32,
            max_output_bytes: 4096,
            max_scanned_changes: 100,
        }))
        .expect("assemble context");
        assert_eq!(packet["contract_version"], 1);
        tauri::async_runtime::block_on(client.close()).expect("close session");
        server.join().expect("join fake RRD");
    }

    fn read_request(mut stream: TcpStream) -> (String, BTreeMap<String, String>, Value) {
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .expect("set request timeout");
        let mut bytes = Vec::new();
        let header_end = loop {
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).expect("read fake RRD request");
            assert!(read > 0, "request ended before HTTP headers");
            bytes.extend_from_slice(&chunk[..read]);
            if let Some(offset) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                break offset + 4;
            }
        };
        let head = std::str::from_utf8(&bytes[..header_end]).expect("HTTP headers are UTF-8");
        let mut lines = head.split("\r\n");
        let request = lines.next().expect("request line").to_owned();
        let headers = lines
            .filter_map(|line| line.split_once(':'))
            .map(|(name, value)| (name.to_ascii_lowercase(), value.trim().to_owned()))
            .collect::<BTreeMap<_, _>>();
        let content_length = headers
            .get("content-length")
            .map(|value| value.parse::<usize>().expect("valid content length"))
            .unwrap_or_default();
        while bytes.len() - header_end < content_length {
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).expect("read fake RRD body");
            assert!(read > 0, "request ended before HTTP body");
            bytes.extend_from_slice(&chunk[..read]);
        }
        let body = if content_length == 0 {
            Value::Null
        } else {
            serde_json::from_slice(&bytes[header_end..header_end + content_length])
                .expect("request body is JSON")
        };
        (request, headers, body)
    }

    fn respond(
        mut stream: TcpStream,
        request_id: &str,
        operation_id: &str,
        payload: Value,
        inspect: impl FnOnce(&str, &BTreeMap<String, String>, &Value),
    ) {
        let (request, headers, body) = read_request(stream.try_clone().expect("clone test stream"));
        inspect(&request, &headers, &body);
        let response = json!({
            "protocol": "rrd",
            "protocol_version": 1,
            "request_id": request_id,
            "operation_id": operation_id,
            "outcome": {"status": "ok", "payload": payload},
        })
        .to_string();
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            response.len(),
            response
        )
        .expect("write fake RRD response");
    }
}
