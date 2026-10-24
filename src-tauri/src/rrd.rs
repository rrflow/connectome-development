use reqwest::{redirect::Policy, Client};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{ipc::Channel, State};

mod client;
mod cluster;
pub mod engine;
mod error;
pub mod estate;
mod transport;
mod view;

use client::{
    NativeRrdClient, RrdConnectRequest, RrdQueryRequest, RrdVectorMapRequest,
    RrdVectorPointsRequest, RrdVectorSearchRequest,
};
use error::RrdError;
use transport::public_rrd_url;
use view::{
    ConnectionView, DatabaseView, QueryView, ServiceView, StorageView, VectorCollectionsView,
    VectorMapProgressView, VectorMapView, VectorPointsView, VectorSearchView,
};

const MAX_RRD_RESPONSE_BYTES: u64 = 1024 * 1024;
const NOT_CONNECTED: &str = "Connectome is not connected to RRD";

/// Bounded profile-scoped native clients. A read clones exactly its requested
/// client before releasing the registry lock; there is no global active client.
#[derive(Default)]
pub struct RrdClientState(tokio::sync::Mutex<BTreeMap<String, Arc<NativeRrdClient>>>);

impl RrdClientState {
    async fn client(&self, profile: &str) -> Result<Arc<NativeRrdClient>, RrdError> {
        self.0
            .lock()
            .await
            .get(profile)
            .cloned()
            .ok_or_else(|| NOT_CONNECTED.into())
    }

    async fn connect(
        &self,
        profile: String,
        request: RrdConnectRequest,
    ) -> Result<ConnectionView, RrdError> {
        if profile.is_empty()
            || profile.len() > 128
            || !profile
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err("invalid project connection handle".into());
        }
        let mut guard = self.0.lock().await;
        if guard.contains_key(&profile) {
            return Err("this project profile is already connected; disconnect it first".into());
        }
        if guard.len() >= 8 {
            return Err(
                "eight native sessions are already open; disconnect a project first".into(),
            );
        }
        let client = NativeRrdClient::connect(request).await?;
        let connection = client.connection();
        guard.insert(profile, Arc::new(client));
        Ok(connection)
    }

    async fn disconnect(&self, profile: &str) -> Result<(), RrdError> {
        let client = self.0.lock().await.remove(profile);
        match client {
            Some(client) => client.close().await,
            None => Ok(()),
        }
    }
}

#[tauri::command]
pub async fn rrd_connect(
    profile: String,
    request: RrdConnectRequest,
    state: State<'_, RrdClientState>,
) -> Result<ConnectionView, RrdError> {
    state.connect(profile, request).await
}

/// The live native session, if any, so a lens can resume it after navigation.
#[tauri::command]
pub async fn rrd_session(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<Option<ConnectionView>, RrdError> {
    Ok(state
        .0
        .lock()
        .await
        .get(&profile)
        .map(|client| client.connection()))
}

#[tauri::command]
pub async fn rrd_capabilities(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<ServiceView, RrdError> {
    Ok(view::service(
        &state.client(&profile).await?.capabilities().await?,
    ))
}

#[tauri::command]
pub async fn rrd_schema(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<Value, RrdError> {
    let snapshot = state.client(&profile).await?.schema().await?;
    // Only catalogue metadata; no credential or application records cross this command.
    let tables = snapshot.schema.as_ref().map(|schema| schema.tables.iter().take(256).map(|(name, table)| {
        serde_json::json!({"name": name, "model": table.model, "mode": table.mode,
            "properties": {"table": table.properties, "record":schema.records.get(name), "relation":schema.relations.get(name), "event":schema.events.get(name)}, "additional_properties": table.allow_additional_properties})
    }).collect::<Vec<_>>()).unwrap_or_default();
    Ok(
        serde_json::json!({"known_at_cursor":snapshot.known_at_cursor,
        "read_manifest_sha256":snapshot.read_manifest_sha256,
        "schema_revision":snapshot.schema.as_ref().map(|s| s.revision),
        "tables":tables, "truncated":snapshot.schema.as_ref().is_some_and(|s| s.tables.len()>256)}),
    )
}

#[tauri::command]
pub async fn rrd_database(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<DatabaseView, RrdError> {
    state.client(&profile).await?.database().await
}

#[tauri::command]
pub async fn rrd_storage(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<StorageView, RrdError> {
    state.client(&profile).await?.storage().await
}

#[tauri::command]
pub async fn rrd_query(
    profile: String,
    request: RrdQueryRequest,
    state: State<'_, RrdClientState>,
) -> Result<QueryView, RrdError> {
    state.client(&profile).await?.query(request).await
}

#[tauri::command]
pub async fn rrd_vector_collections(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<VectorCollectionsView, RrdError> {
    state.client(&profile).await?.vector_collections().await
}

#[tauri::command]
pub async fn rrd_vector_points(
    profile: String,
    request: RrdVectorPointsRequest,
    state: State<'_, RrdClientState>,
) -> Result<VectorPointsView, RrdError> {
    state.client(&profile).await?.vector_points(request).await
}

#[tauri::command]
pub async fn rrd_vector_search(
    profile: String,
    request: RrdVectorSearchRequest,
    state: State<'_, RrdClientState>,
) -> Result<VectorSearchView, RrdError> {
    state.client(&profile).await?.vector_search(request).await
}

/// Nearest neighbours of every point the similarity map draws, one exact
/// engine search per point. `on_progress` hears each finished search.
#[tauri::command]
pub async fn rrd_vector_map(
    profile: String,
    request: RrdVectorMapRequest,
    on_progress: Channel<VectorMapProgressView>,
    state: State<'_, RrdClientState>,
) -> Result<VectorMapView, RrdError> {
    state
        .client(&profile)
        .await?
        .vector_map(request, |progress| {
            // A closed window stops only the progress display, never the map.
            let _ = on_progress.send(progress);
        })
        .await
}

#[tauri::command]
pub async fn rrd_disconnect(
    profile: String,
    state: State<'_, RrdClientState>,
) -> Result<(), RrdError> {
    state.disconnect(&profile).await
}

#[tauri::command]
pub async fn rrd_public_request(endpoint: String, path: String) -> Result<Value, String> {
    let url = public_rrd_url(&endpoint, &path)?;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(15))
        .redirect(Policy::none())
        .build()
        .map_err(|error| format!("cannot build RRD HTTP client: {error}"))?;
    let mut response = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("RRD HTTP request failed: {error}"))?;
    let status = response.status();

    if response
        .content_length()
        .is_some_and(|length| length > MAX_RRD_RESPONSE_BYTES)
    {
        return Err("RRD response exceeds 1 MiB".into());
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("cannot read RRD response: {error}"))?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_RRD_RESPONSE_BYTES as usize {
            return Err("RRD response exceeds 1 MiB".into());
        }
        bytes.extend_from_slice(&chunk);
    }

    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("RRD returned invalid JSON: {error}"))?;
    if !status.is_success() {
        let detail = value
            .pointer("/outcome/error/message")
            .and_then(Value::as_str)
            .unwrap_or("RRD rejected the public request");
        return Err(format!("RRD returned {status}: {detail}"));
    }

    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    #[test]
    fn public_request_crosses_the_native_http_boundary() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let address = listener.local_addr().expect("read listener address");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept RRD request");
            let mut request = [0_u8; 2048];
            let length = stream.read(&mut request).expect("read RRD request");
            let request = String::from_utf8_lossy(&request[..length]);
            assert!(request.starts_with("GET /v1/health/live HTTP/1.1"));
            let body = r#"{"protocol":"rrd","protocol_version":1,"request_id":"request-test","operation_id":"operation-test","outcome":{"status":"ok","payload":{"observed_at_unix_ms":1}}}"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .expect("write RRD response");
        });

        let response = tauri::async_runtime::block_on(rrd_public_request(
            format!("http://{address}"),
            "/v1/health/live".into(),
        ))
        .expect("native RRD request succeeds");
        assert_eq!(response["protocol"], "rrd");
        assert_eq!(response["outcome"]["payload"]["observed_at_unix_ms"], 1);
        server.join().expect("join test server");
    }
}
