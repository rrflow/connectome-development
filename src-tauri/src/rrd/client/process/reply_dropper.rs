//! Drop an actual engine reply after receiving it. No generated response or model data.
use super::*;
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;

pub(super) struct ReplyDropper {
    pub(super) address: SocketAddr,
    stop: Arc<AtomicBool>,
    drop_path: Arc<Mutex<Option<String>>>,
    counts: Arc<Mutex<BTreeMap<String, usize>>>,
    thread: Option<JoinHandle<()>>,
}

impl ReplyDropper {
    pub(super) fn new(backend: SocketAddr) -> Self {
        assert!(backend.ip().is_loopback());
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let drop_path = Arc::new(Mutex::new(None::<String>));
        let counts = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
        let (worker_stop, worker_drop, worker_counts) =
            (stop.clone(), drop_path.clone(), counts.clone());
        let thread = std::thread::spawn(move || {
            for incoming in listener.incoming() {
                if worker_stop.load(Ordering::SeqCst) {
                    break;
                }
                let mut incoming = incoming.unwrap();
                incoming
                    .set_read_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                incoming
                    .set_write_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                let mut request = Vec::new();
                let (headers_end, length) = loop {
                    let mut buffer = [0; 8192];
                    let count = incoming.read(&mut buffer).unwrap();
                    if count == 0 {
                        break (0, 0);
                    }
                    request.extend_from_slice(&buffer[..count]);
                    assert!(request.len() <= 2 * 1024 * 1024, "bounded test request");
                    if let Some(end) = request.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                        let headers = std::str::from_utf8(&request[..end]).unwrap();
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.split_once(':')
                                    .filter(|(key, _)| key.eq_ignore_ascii_case("content-length"))
                                    .map(|(_, value)| value.trim().parse::<usize>().unwrap())
                            })
                            .unwrap_or(0);
                        assert!(length <= 2 * 1024 * 1024);
                        break (end + 4, length);
                    }
                };
                if headers_end == 0 {
                    continue;
                }
                while request.len() < headers_end + length {
                    let mut buffer = [0; 8192];
                    let count = incoming.read(&mut buffer).unwrap();
                    assert!(count > 0);
                    request.extend_from_slice(&buffer[..count]);
                }
                let headers = std::str::from_utf8(&request[..headers_end - 4]).unwrap();
                let path = headers
                    .lines()
                    .next()
                    .unwrap()
                    .split_whitespace()
                    .nth(1)
                    .unwrap()
                    .to_owned();
                *worker_counts
                    .lock()
                    .unwrap()
                    .entry(path.clone())
                    .or_default() += 1;
                let mut forwarded = headers
                    .lines()
                    .filter(|line| !line.to_ascii_lowercase().starts_with("connection:"))
                    .collect::<Vec<_>>()
                    .join("\r\n")
                    .into_bytes();
                forwarded.extend_from_slice(b"\r\nConnection: close\r\n\r\n");
                forwarded.extend_from_slice(&request[headers_end..headers_end + length]);
                let mut upstream =
                    TcpStream::connect_timeout(&backend, Duration::from_secs(10)).unwrap();
                upstream
                    .set_read_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                upstream
                    .set_write_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                upstream.write_all(&forwarded).unwrap();
                let mut response = Vec::new();
                upstream.read_to_end(&mut response).unwrap();
                let drop_reply = {
                    let mut selected = worker_drop.lock().unwrap();
                    if selected.as_deref() == Some(&path) {
                        selected.take();
                        true
                    } else {
                        false
                    }
                };
                if drop_reply {
                    assert!(
                        response.starts_with(b"HTTP/1.1 200"),
                        "drop only an actual successful engine response"
                    );
                } else {
                    incoming.write_all(&response).unwrap();
                }
                let _ = incoming.shutdown(Shutdown::Both);
            }
        });
        Self {
            address,
            stop,
            drop_path,
            counts,
            thread: Some(thread),
        }
    }
    pub(super) fn drop_next(&self, path: &str) {
        *self.drop_path.lock().unwrap() = Some(path.into());
    }
    pub(super) fn count(&self, path: &str) -> usize {
        self.counts.lock().unwrap().get(path).copied().unwrap_or(0)
    }
}
impl Drop for ReplyDropper {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(self.address);
        if let Some(thread) = self.thread.take() {
            assert!(thread.join().is_ok(), "reply dropper finished");
        }
    }
}
