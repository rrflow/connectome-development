//! Bounded HTTP fixtures for the real installed engine, not model quality evidence.
use super::*;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Instant;

pub(super) fn accept_loopback_request(listener: &TcpListener, path: &str) -> (TcpStream, Value) {
    listener.set_nonblocking(true).unwrap();
    let deadline = Instant::now() + Duration::from_secs(15);
    let (mut socket, _) = loop {
        match listener.accept() {
            Ok(socket) => break socket,
            Err(error)
                if error.kind() == std::io::ErrorKind::WouldBlock && Instant::now() < deadline =>
            {
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("bounded loopback fixture accept failed: {error}"),
        }
    };
    socket.set_nonblocking(false).unwrap();
    socket
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        let mut byte = [0];
        socket.read_exact(&mut byte).unwrap();
        header.push(byte[0]);
        assert!(header.len() < 8_192);
    }
    let header = String::from_utf8(header).unwrap();
    assert!(header.starts_with(&format!("POST {path} HTTP/1.1")));
    let length: usize = header
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse().unwrap())
        })
        .expect("bounded request length");
    assert!(length < 524_288);
    let mut body = vec![0; length];
    socket.read_exact(&mut body).unwrap();
    (
        socket,
        serde_json::from_slice(&body).expect("bounded request JSON"),
    )
}

pub(super) fn reply_loopback_chat(socket: &mut TcpStream, model: &str, content: &str) {
    let body = serde_json::to_vec(&serde_json::json!({
        "model": model,
        "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": content}}]
    }))
    .unwrap();
    write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).unwrap();
    socket.write_all(&body).unwrap();
}

pub(super) fn reply_loopback_system_one(socket: &mut TcpStream, request: &Value) {
    let criteria = request["questions"]["endpoint"]["criteria"]
        .as_object()
        .expect("native endpoint criteria");
    let choice = serde_json::json!({"kind":"select", "binding_id":"connectome-loopback-worker", "effort":null});
    let selected = criteria
        .iter()
        .find(|(_, value)| **value == choice)
        .expect("admitted worker choice")
        .0;
    let probabilities: serde_json::Map<String, Value> = criteria
        .keys()
        .map(|key| {
            (
                key.clone(),
                serde_json::json!(if key == selected { 1.0 } else { 0.0 }),
            )
        })
        .collect();
    let body = serde_json::to_vec(&serde_json::json!({
        "model":request["model"],
        "answers":{"endpoint":{"type":"choice", "choice":selected, "confidence":1.0, "probabilities":probabilities}},
        "usage":{"input_tokens":120,"output_tokens":12}
    })).unwrap();
    write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).unwrap();
    socket.write_all(&body).unwrap();
}
