use reqwest::{redirect::Policy, Client};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tauri::{ipc::Channel, State};

mod client;
mod cluster;
mod transport;
mod view;

use client::{
    NativeRrdClient, RrdConnectRequest, RrdQueryRequest, RrdVectorMapRequest,
    RrdVectorPointsRequest, RrdVectorSearchRequest,
};
use transport::public_rrd_url;
use view::{
    ConnectionView, DatabaseView, QueryView, ServiceView, StorageView, VectorCollectionsView,
    VectorMapProgressView, VectorMapView, VectorPointsView, VectorSearchView,
};

const MAX_RRD_RESPONSE_BYTES: u64 = 1024 * 1024;
const NOT_CONNECTED: &str = "Connectome is not connected to RRD";

/// The one authenticated native RRD connection. A command takes a handle and
/// releases this lock before any request, so lenses run concurrently; the
/// client itself pins its session for each request it sends.
#[derive(Default)]
pub struct RrdClientState(tokio::sync::Mutex<Option<Arc<NativeRrdClient>>>);

impl RrdClientState {
    async fn client(&self) -> Result<Arc<NativeRrdClient>, String> {
        self.0
            .lock()
            .await
            .clone()
            .ok_or_else(|| NOT_CONNECTED.into())
    }
}

#[tauri::command]
pub async fn rrd_connect(
    request: RrdConnectRequest,
    state: State<'_, RrdClientState>,
) -> Result<ConnectionView, String> {
    // Held across the handshake so two windows cannot open two sessions.
    let mut guard = state.0.lock().await;
    if guard.is_some() {
        return Err("Connectome is already connected to RRD; disconnect first".into());
    }
    let client = NativeRrdClient::connect(request).await?;
    let connection = client.connection();
    *guard = Some(Arc::new(client));
    Ok(connection)
}

/// The live native session, if any, so a lens can resume it after navigation.
#[tauri::command]
pub async fn rrd_session(
    state: State<'_, RrdClientState>,
) -> Result<Option<ConnectionView>, String> {
    Ok(state
        .0
        .lock()
        .await
        .as_ref()
        .map(|client| client.connection()))
}

#[tauri::command]
pub async fn rrd_capabilities(state: State<'_, RrdClientState>) -> Result<ServiceView, String> {
    Ok(view::service(&state.client().await?.capabilities().await?))
}

#[tauri::command]
pub async fn rrd_database(state: State<'_, RrdClientState>) -> Result<DatabaseView, String> {
    state.client().await?.database().await
}

#[tauri::command]
pub async fn rrd_storage(state: State<'_, RrdClientState>) -> Result<StorageView, String> {
    state.client().await?.storage().await
}

#[tauri::command]
pub async fn rrd_query(
    request: RrdQueryRequest,
    state: State<'_, RrdClientState>,
) -> Result<QueryView, String> {
    state.client().await?.query(request).await
}

#[tauri::command]
pub async fn rrd_vector_collections(
    state: State<'_, RrdClientState>,
) -> Result<VectorCollectionsView, String> {
    state.client().await?.vector_collections().await
}

#[tauri::command]
pub async fn rrd_vector_points(
    request: RrdVectorPointsRequest,
    state: State<'_, RrdClientState>,
) -> Result<VectorPointsView, String> {
    state.client().await?.vector_points(request).await
}

#[tauri::command]
pub async fn rrd_vector_search(
    request: RrdVectorSearchRequest,
    state: State<'_, RrdClientState>,
) -> Result<VectorSearchView, String> {
    state.client().await?.vector_search(request).await
}

/// Nearest neighbours of every point the similarity map draws, one exact
/// engine search per point. `on_progress` hears each finished search.
#[tauri::command]
pub async fn rrd_vector_map(
    request: RrdVectorMapRequest,
    on_progress: Channel<VectorMapProgressView>,
    state: State<'_, RrdClientState>,
) -> Result<VectorMapView, String> {
    state
        .client()
        .await?
        .vector_map(request, |progress| {
            // A closed window stops only the progress display, never the map.
            let _ = on_progress.send(progress);
        })
        .await
}

#[tauri::command]
pub async fn rrd_disconnect(state: State<'_, RrdClientState>) -> Result<(), String> {
    let client = state.0.lock().await.take();
    match client {
        Some(client) => client.close().await,
        None => Ok(()),
    }
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
