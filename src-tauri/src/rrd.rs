use reqwest::{redirect::Policy, Client};
use serde_json::Value;
use std::time::Duration;
use tauri::State;

mod client;
mod transport;

use client::{NativeRrdClient, RrdConnectRequest, RrdConnectionSummary, RrdContextRequest};
use transport::public_rrd_url;

const MAX_RRD_RESPONSE_BYTES: u64 = 1024 * 1024;

#[derive(Default)]
pub struct RrdClientState(tokio::sync::Mutex<Option<NativeRrdClient>>);

#[tauri::command]
pub async fn rrd_connect(
    request: RrdConnectRequest,
    state: State<'_, RrdClientState>,
) -> Result<RrdConnectionSummary, String> {
    let mut guard = state.0.lock().await;
    if guard.is_some() {
        return Err("Connectome is already connected to RRD; disconnect first".into());
    }
    let (client, summary) = NativeRrdClient::connect(request).await?;
    *guard = Some(client);
    Ok(summary)
}

#[tauri::command]
pub async fn rrd_capabilities(state: State<'_, RrdClientState>) -> Result<Value, String> {
    let guard = state.0.lock().await;
    let client = guard.as_ref().ok_or("Connectome is not connected to RRD")?;
    client.capabilities().await
}

#[tauri::command]
pub async fn rrd_diagnostic_snapshot(state: State<'_, RrdClientState>) -> Result<Value, String> {
    let mut guard = state.0.lock().await;
    let client = guard.as_mut().ok_or("Connectome is not connected to RRD")?;
    client.diagnostic_snapshot().await
}

#[tauri::command]
pub async fn rrd_assemble_context(
    request: RrdContextRequest,
    state: State<'_, RrdClientState>,
) -> Result<Value, String> {
    let mut guard = state.0.lock().await;
    let client = guard.as_mut().ok_or("Connectome is not connected to RRD")?;
    client.assemble_context(request).await
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
