//! Drop an actual engine reply after receiving it. No generated response or model data.
use super::*;
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;

struct ReplyDropper {
    address: SocketAddr,
    stop: Arc<AtomicBool>,
    drop_path: Arc<Mutex<Option<String>>>,
    counts: Arc<Mutex<BTreeMap<String, usize>>>,
    thread: Option<JoinHandle<()>>,
}

impl ReplyDropper {
    fn new(backend: SocketAddr) -> Self {
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
    fn drop_next(&self, path: &str) {
        *self.drop_path.lock().unwrap() = Some(path.into());
    }
    fn count(&self, path: &str) -> usize {
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

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_reconcile_lost_replies_without_duplicate_effects() {
    let estate = Estate::install_and_serve();
    let proxy = ReplyDropper::new(estate.address);
    tauri::async_runtime::block_on(async {
        let request = || {
            let mut request = estate.connect_request();
            request.endpoint = format!("http://{}", proxy.address);
            request
        };
        let client = NativeRrdClient::connect(request()).await.unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("page")
        };
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        let (handle, key) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let start_path = "/v1/attunement/start";
        proxy.drop_next(start_path);
        assert!(matches!(
            client
                .attunement_command(Command::Approve {
                    handle: handle.clone()
                })
                .await
                .unwrap(),
            Reply::Uncertain { .. }
        ));
        assert_eq!(proxy.count(start_path), 1, "no automatic retry");
        let Reply::Pending {
            prepared: Some(pending),
        } = client.attunement_command(Command::Pending).await.unwrap()
        else {
            panic!("native recovery preview")
        };
        assert_eq!(pending["handle"], handle);
        assert_eq!(pending["idempotency_key"], key);
        assert!(client
            .attunement_command(Command::Discard {
                handle: handle.clone()
            })
            .await
            .is_err());
        assert!(
            client
                .attunement_command(Command::Prepare {
                    job_id: id.into(),
                    expected_revision: "1".into(),
                    plan_sha256: initial["plan"]["plan_sha256"].as_str().unwrap().into(),
                    command: Control::Replan,
                })
                .await
                .is_err(),
            "unresolved commands cannot be overwritten"
        );
        let started = approve(&client, handle).await;
        assert_eq!(proxy.count(start_path), 2, "only explicit same-key retry");
        assert_eq!(
            started["status"]["job"]["revision"], "2",
            "replay did not transition twice"
        );
        assert_eq!(
            read(&client, id).await["status"]["job"],
            started["status"]["job"]
        );
        std::fs::write(
            PathBuf::from(&estate.served.view.project).join("lost-reply-fixture.txt"),
            "Source change in a temporary integration-test project.\n",
        )
        .unwrap();
        let (handle, key) = prepare(&client, &started, Control::Replan).await;
        let accept_path = "/v1/attunement/replan/accept";
        proxy.drop_next(accept_path);
        assert!(matches!(
            client
                .attunement_command(Command::Approve { handle })
                .await
                .unwrap(),
            Reply::Uncertain { .. }
        ));
        assert_eq!(proxy.count(accept_path), 1);
        client.close().await.unwrap();
        let reopened = NativeRrdClient::connect(request()).await.unwrap();
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = reopened
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: true,
            })
            .await
            .unwrap()
        else {
            panic!("recover committed replan")
        };
        let successor_id = receipt["status"]["job"]["id"].as_str().unwrap();
        assert_ne!(successor_id, id);
        assert_eq!(receipt["status"]["job"]["state"], "pending");
        assert_eq!(
            read(&reopened, successor_id).await["status"]["job"],
            receipt["status"]["job"]
        );
        assert_eq!(
            proxy.count(accept_path),
            1,
            "receipt recovery never resubmits acceptance"
        );
        reopened.close().await.unwrap();
    });
}
