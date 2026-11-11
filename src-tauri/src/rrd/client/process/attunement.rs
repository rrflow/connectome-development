//! Real installed engine tests. Temporary source files are test fixtures, never learning data.
use super::*;
mod lost_reply;
use crate::rrd::client::attunement::{
    AttunementCommand as Command, AttunementReply as Reply, Control,
};
use crate::rrd::client::tasks::{TaskCommand, TaskReply};
use rrd_client::{ClientConfig, RequestOptions, RrdClient, Session};
use sha2::Digest;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Instant;

async fn read(client: &NativeRrdClient, id: &str) -> Value {
    let Reply::Snapshot { snapshot } = client
        .attunement_command(Command::Read { job_id: id.into() })
        .await
        .unwrap()
    else {
        panic!("stored snapshot")
    };
    snapshot
}

async fn prepare(client: &NativeRrdClient, state: &Value, command: Control) -> (String, String) {
    let Reply::Prepared {
        handle,
        idempotency_key,
        ..
    } = client
        .attunement_command(Command::Prepare {
            job_id: state["status"]["job"]["id"].as_str().unwrap().into(),
            expected_revision: state["status"]["job"]["revision"].as_str().unwrap().into(),
            plan_sha256: state["plan"]["plan_sha256"].as_str().unwrap().into(),
            command,
        })
        .await
        .unwrap()
    else {
        panic!("prepared command")
    };
    (handle, idempotency_key)
}

async fn approve(client: &NativeRrdClient, handle: String) -> Value {
    let reply = client
        .attunement_command(Command::Approve { handle })
        .await
        .unwrap();
    let Reply::Applied { snapshot } = reply else {
        panic!("accepted command: {reply:?}")
    };
    snapshot
}

#[derive(serde::Deserialize)]
struct InstalledOperatorCredential {
    principal_id: String,
    credential: String,
}

async fn control_session(estate: &Estate) -> (RrdClient, Session) {
    let bytes = std::fs::read(&estate.served.view.credential_path)
        .expect("read the isolated installed operator credential");
    let credential: InstalledOperatorCredential =
        serde_json::from_slice(&bytes).expect("installed operator credential document");
    let client = RrdClient::connect_local(
        estate.address,
        rrd_contract::CanonicalId::new(&estate.instance).expect("installed instance ID"),
        ClientConfig {
            max_attempts: 1,
            ..ClientConfig::default()
        },
    )
    .expect("connect the public typed SDK for endpoint configuration");
    let prefix = Uuid::new_v4().simple().to_string();
    let session = client
        .create_session(
            rrd_contract::CanonicalId::new(credential.principal_id)
                .expect("installed operator principal ID"),
            &credential.credential,
            rrd_contract::CreateSession {
                limits: rrd_contract::SessionLimits {
                    idle_timeout_ms: 900_000,
                    absolute_timeout_ms: 3_600_000,
                    max_open_transactions: 1,
                },
            },
            RequestOptions::mutation(
                &format!("connectome-source-profile-session-{prefix}"),
                &format!("connectome-source-profile-session-op-{prefix}"),
                &format!("connectome-source-profile-session-key-{prefix}"),
            )
            .expect("valid session request identity"),
        )
        .await
        .expect("authenticate through the installed public credential");
    (client, session)
}

fn loopback_worker_profile(
    listener: &TcpListener,
    allow_context_export: bool,
    allow_source_export: bool,
) -> rrd_contract::EndpointProfileInput {
    let binding_id = rrd_contract::CanonicalId::new("connectome-loopback-worker").unwrap();
    let service_id = rrd_contract::CanonicalId::new("controlled-loopback-test-service").unwrap();
    let evidence_sha256 = format!(
        "{:x}",
        sha2::Sha256::digest(b"controlled loopback protocol fixture; no model or quality claim")
    );
    let candidate = rrd_contract::EndpointSelectionCandidate {
        binding_id: binding_id.clone(),
        service_id: service_id.clone(),
        manifest_sha256: None,
        effort: rrd_contract::EndpointEffortSupport::Observed {
            evidence_sha256: evidence_sha256.clone(),
            allow_default: true,
            values: Vec::new(),
        },
    };
    rrd_contract::EndpointProfileInput {
        contract_version: rrd_contract::ENDPOINT_PROFILE_CONTRACT_VERSION,
        name: rrd_contract::CanonicalId::new("connectome-source-worker-test").unwrap(),
        bindings: vec![rrd_contract::EndpointBinding {
            id: binding_id.clone(),
            class: rrd_contract::WorkloadClass::LargeModelServing,
            kind: rrd_contract::BindingKind::SelfHosted,
            endpoint: rrd_contract::EndpointLocator::Url {
                url: format!("http://{}/v1", listener.local_addr().unwrap()),
            },
            service_id: service_id.clone(),
            manifest_sha256: None,
            credential: None,
            placement: Some(rrd_contract::CanonicalId::new("test-host").unwrap()),
            footprint: rrd_contract::DeclaredFootprint {
                memory_bytes: 1,
                gpu: rrd_contract::GpuRequirement::None,
            },
            limits: rrd_contract::BindingLimits {
                max_concurrency: 1,
                timeout_ms: 5_000,
                max_input_bytes: 16_384,
            },
        }],
        selection_policy: Some(rrd_contract::EndpointSelectionPolicy {
            contract_version: rrd_contract::ENDPOINT_SELECTION_VERSION,
            purpose: rrd_contract::EndpointSelectionPurpose::ExperimentalProposal,
            allow_unverified_identity: true,
            allow_network: true,
            maximum_concurrent_proposals: 1,
            controller_binding_id: binding_id.clone(),
            workload_class: rrd_contract::WorkloadClass::LargeModelServing,
            limits: rrd_contract::EndpointSelectionLimits {
                maximum_allowance_bytes: 16_384,
                maximum_response_bytes: 65_536,
                maximum_candidates: 1,
                maximum_effort_values: 1,
                maximum_effort_bytes: 65_536,
            },
            candidates: vec![candidate],
            system_prompt: "Select the configured controlled test binding.".into(),
            maximum_output_tokens: 64,
            temperature_milli: 0,
            lfg: None,
        }),
        observation_policy: None,
        assessment_policy: None,
        worker_policy: Some(rrd_contract::EndpointWorkerPolicy {
            contract_version: rrd_contract::ENDPOINT_WORKER_VERSION,
            allow_network: true,
            allow_context_export,
            allow_source_export,
            allow_unverified_identity: true,
            maximum_concurrent_calls: 1,
            bindings: vec![rrd_contract::EndpointWorkerBinding {
                binding_id,
                protocol_evidence_sha256: evidence_sha256,
                adapter: Default::default(),
                system_prompt:
                    "Return one bounded protocol-test draft. Do not change project files.".into(),
                generation: rrd_contract::EndpointGenerationSettings {
                    maximum_output_tokens: 128,
                    token_parameter: rrd_contract::EndpointTokenParameter::MaxTokens,
                    temperature_milli: None,
                    response_format: rrd_contract::EndpointResponseFormat::Text,
                },
                maximum_response_bytes: 16_384,
                effort_values: Default::default(),
                allow_default_effort: true,
            }],
        }),
    }
}

async fn configure_loopback_profile(
    client: &RrdClient,
    session: &Session,
    listener: &TcpListener,
    allow_context_export: bool,
    allow_source_export: bool,
    suffix: &str,
) -> rrd_contract::EndpointConfiguration {
    let current = client
        .read_endpoint_configuration(
            session,
            rrd_contract::ReadEndpointConfiguration {},
            RequestOptions::read(
                &format!("connectome-profile-read-{suffix}"),
                &format!("connectome-profile-read-op-{suffix}"),
            )
            .unwrap(),
        )
        .await
        .expect("read current endpoint configuration");
    let plan = client
        .preview_endpoint_configuration(
            session,
            rrd_contract::PreviewEndpointConfiguration {
                expected_revision: current.revision,
                profile: Some(loopback_worker_profile(
                    listener,
                    allow_context_export,
                    allow_source_export,
                )),
            },
            RequestOptions::mutation(
                &format!("connectome-profile-preview-{suffix}"),
                &format!("connectome-profile-preview-op-{suffix}"),
                &format!("connectome-profile-preview-key-{suffix}"),
            )
            .unwrap(),
        )
        .await
        .expect("preview exact controlled loopback profile");
    client
        .apply_endpoint_configuration(
            session,
            rrd_contract::ApplyEndpointConfiguration {
                approved_plan_sha256: plan.plan_sha256.clone(),
                plan,
            },
            RequestOptions::mutation(
                &format!("connectome-profile-apply-{suffix}"),
                &format!("connectome-profile-apply-op-{suffix}"),
                &format!("connectome-profile-apply-key-{suffix}"),
            )
            .unwrap(),
        )
        .await
        .expect("apply exactly approved loopback profile")
}

async fn review_source_request(
    client: &NativeRrdClient,
    task_id: &str,
    source: rrd_contract::TaskWorkerSourceRequest,
) -> (
    crate::rrd::client::tasks::ProposalSummary,
    crate::rrd::client::tasks::WorkerReview,
    rrd_contract::TaskWorkerSourceRequest,
    String,
) {
    let TaskReply::Prepared {
        task_sha256,
        configuration_sha256,
        unavailable,
        ..
    } = client
        .task_command(TaskCommand::Prepare {
            task_id: task_id.to_owned(),
        })
        .await
        .expect("prepare current task and endpoint configuration")
    else {
        panic!("prepared task")
    };
    assert!(unavailable.is_none(), "controlled endpoint is configured");
    let selection_attempt_id = Uuid::new_v4().simple().to_string();
    let TaskReply::Proposal { proposal } = client
        .task_command(TaskCommand::Propose {
            task_id: task_id.to_owned(),
            attempt_id: selection_attempt_id,
            expected_task_sha256: task_sha256,
            expected_configuration_sha256: configuration_sha256,
        })
        .await
        .expect("request one controlled endpoint proposal")
    else {
        panic!("proposal")
    };
    assert!(matches!(
        proposal.choice,
        rrd_contract::EndpointSelectionChoice::Select { .. }
    ));
    let TaskReply::WorkerPrepared { review } = client
        .task_command(TaskCommand::PrepareWorker {
            task_id: task_id.to_owned(),
            selection_attempt_id: proposal.attempt_id.clone(),
            source: Some(source.clone()),
        })
        .await
        .expect("review exact typed source request")
    else {
        panic!("worker review")
    };
    let worker_attempt_id = Uuid::new_v4().simple().to_string();
    (proposal, review, source, worker_attempt_id)
}

async fn work_reviewed_source(
    client: &NativeRrdClient,
    task_id: &str,
    proposal: &crate::rrd::client::tasks::ProposalSummary,
    review: &crate::rrd::client::tasks::WorkerReview,
    source: rrd_contract::TaskWorkerSourceRequest,
    worker_attempt_id: String,
) -> Result<TaskReply, crate::rrd::error::RrdError> {
    client
        .task_command(TaskCommand::Work {
            task_id: task_id.to_owned(),
            attempt_id: worker_attempt_id,
            selection_attempt_id: proposal.attempt_id.clone(),
            expected_selection_sha256: review.selection_sha256.clone(),
            expected_task_sha256: review.task_sha256.clone(),
            expected_configuration_sha256: review.configuration_sha256.clone(),
            source: Some(source),
        })
        .await
}

async fn read_task_budget(
    client: &NativeRrdClient,
    task_id: &str,
) -> crate::rrd::client::tasks::BudgetSummary {
    let TaskReply::Budget {
        budget: Some(budget),
    } = client
        .task_command(TaskCommand::Budget {
            task_id: task_id.to_owned(),
        })
        .await
        .expect("read engine-owned task budget")
    else {
        panic!("configured task budget")
    };
    budget
}

fn assert_ui_api_error(error: crate::rrd::error::RrdError, expected_prefix: &str) {
    assert!(
        !error.retryable,
        "authorization/precondition errors are not retries"
    );
    assert!(
        error.message.starts_with(expected_prefix),
        "unexpected bounded UI error class: {}",
        error.message
    );
}

fn accept_loopback_chat(listener: &TcpListener) -> (TcpStream, Value) {
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
    assert!(header.starts_with("POST /v1/chat/completions HTTP/1.1"));
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
        serde_json::from_slice(&body).expect("chat request JSON"),
    )
}

fn reply_loopback_chat(socket: &mut TcpStream, model: &str, content: &str) {
    let body = serde_json::to_vec(&serde_json::json!({
        "model": model,
        "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": content}}]
    }))
    .unwrap();
    write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).unwrap();
    socket.write_all(&body).unwrap();
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_recover_expired_lease_and_record_cancellation() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("page")
        };
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        let (discarded, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "10000".into(),
            },
        )
        .await;
        assert!(matches!(
            client
                .attunement_command(Command::Discard {
                    handle: discarded.clone()
                })
                .await
                .unwrap(),
            Reply::Discarded
        ));
        assert!(client
            .attunement_command(Command::Approve { handle: discarded })
            .await
            .is_err());
        assert_eq!(
            read(&client, id).await["status"]["job"],
            initial["status"]["job"]
        );
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "10000".into(),
            },
        )
        .await;
        let started = approve(&client, handle).await;
        // Expiry is an actual engine wall-clock transition, not an invented state.
        let expires: u64 = started["status"]["job"]["lease"]["expires_at_unix_ms"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap();
        let wait_ms = expires
            .saturating_sub(now_unix_ms().unwrap())
            .saturating_add(20);
        assert!(wait_ms <= 10_020);
        std::thread::sleep(Duration::from_millis(wait_ms));
        let (handle, _) = prepare(&client, &started, Control::RecoverExpired).await;
        let recovered = approve(&client, handle).await;
        assert_eq!(recovered["status"]["job"]["state"], "paused");
        assert!(recovered["status"]["job"]["lease"].is_null());
        assert!(
            client
                .attunement_command(Command::Prepare {
                    job_id: id.into(),
                    expected_revision: initial["status"]["job"]["revision"]
                        .as_str()
                        .unwrap()
                        .into(),
                    plan_sha256: initial["plan"]["plan_sha256"].as_str().unwrap().into(),
                    command: Control::Cancel {
                        reason: "Close the temporary process-test job".into()
                    },
                })
                .await
                .is_err(),
            "stale displayed revision is never silently upgraded"
        );
        let (handle, key) = prepare(
            &client,
            &recovered,
            Control::Cancel {
                reason: "Close the temporary process-test job".into(),
            },
        )
        .await;
        let cancelled = approve(&client, handle).await;
        assert_eq!(cancelled["status"]["job"]["state"], "cancel_requested");
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = client
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: false,
            })
            .await
            .unwrap()
        else {
            panic!("cancellation receipt")
        };
        assert_eq!(receipt["status"]["job"], cancelled["status"]["job"]);
        client.close().await.unwrap();
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_discover_replan_and_recover_without_client_identity_derivation() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("job page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 1);
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        assert_eq!(initial["status"]["job"]["state"], "pending");
        assert_eq!(initial["source_verification"], "not_checked");
        assert!(client
            .attunement_command(Command::Read {
                job_id: "foreign-job".into()
            })
            .await
            .is_err());
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        assert!(client
            .attunement_command(Command::Approve {
                handle: "unreviewed-handle".into()
            })
            .await
            .is_err());
        assert_eq!(
            read(&client, id).await["status"]["job"],
            initial["status"]["job"],
            "preparation and invalid approval cannot advance the job"
        );
        client.refresh_now(true).await.unwrap();
        assert!(
            matches!(
                client
                    .attunement_command(Command::Approve { handle })
                    .await
                    .unwrap(),
                Reply::Denied { .. }
            ),
            "a different session cannot approve the preview"
        );
        let (handle, key) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let started = approve(&client, handle.clone()).await;
        assert_eq!(started["status"]["job"]["state"], "running");
        assert!(
            client
                .attunement_command(Command::Approve { handle })
                .await
                .is_err(),
            "consumed approval cannot advance twice"
        );
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = client
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: false,
            })
            .await
            .unwrap()
        else {
            panic!("start receipt")
        };
        assert_eq!(receipt["status"]["job"], started["status"]["job"]);

        let (handle, _) = prepare(&client, &started, Control::Step).await;
        let connected = approve(&client, handle).await;
        assert_eq!(
            connected["status"]["job"]["checkpoints"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        let (handle, _) = prepare(&client, &connected, Control::Pause).await;
        let paused = approve(&client, handle).await;
        assert_eq!(paused["status"]["job"]["state"], "paused");
        let (handle, _) = prepare(
            &client,
            &paused,
            Control::Resume {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let resumed = approve(&client, handle).await;
        assert_eq!(
            resumed["status"]["job"]["checkpoints"],
            connected["status"]["job"]["checkpoints"]
        );

        let source = PathBuf::from(&estate.served.view.project).join("plan-control-fixture.txt");
        std::fs::write(
            &source,
            "Ordinary source edit used only by this installed-process test.\n",
        )
        .unwrap();
        let changed = read(&client, id).await;
        assert_eq!(
            changed["plan"], initial["plan"],
            "stored reads do not silently replan"
        );
        let (stale_handle, _) = prepare(&client, &changed, Control::Replan).await;
        std::fs::write(
            &source,
            "A second edit invalidates the pending source preview.\n",
        )
        .unwrap();
        let rejected = client
            .attunement_command(Command::Approve {
                handle: stale_handle,
            })
            .await
            .unwrap();
        assert!(
            matches!(rejected, Reply::Denied { .. }),
            "stale source must be denied: {rejected:?}"
        );
        assert_eq!(
            read(&client, id).await["status"]["job"],
            resumed["status"]["job"]
        );
        let (handle, key) = prepare(&client, &changed, Control::Replan).await;
        let successor = approve(&client, handle).await;
        let successor_id = successor["status"]["job"]["id"].as_str().unwrap();
        assert_ne!(successor_id, id);
        assert_ne!(
            successor["plan"]["source_sha256"],
            initial["plan"]["source_sha256"]
        );
        assert_eq!(successor["status"]["job"]["state"], "pending");
        assert_eq!(
            read(&client, id).await["status"]["job"]["state"],
            "cancel_requested"
        );
        client.close().await.unwrap();

        let reopened = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = reopened
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("reopened page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 2);
        assert_eq!(page["jobs"][1]["job_id"], successor_id);
        let Reply::Page { page } = reopened
            .attunement_command(Command::List {
                after_job_id: Some(id.into()),
            })
            .await
            .unwrap()
        else {
            panic!("continuation page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 1);
        assert_eq!(page["jobs"][0]["job_id"], successor_id);
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
            panic!("replan receipt after reconnect")
        };
        assert_eq!(receipt["status"]["job"], successor["status"]["job"]);
        assert_eq!(
            read(&reopened, successor_id).await["status"]["job"],
            successor["status"]["job"]
        );
        reopened.close().await.unwrap();
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn selected_source_query_projects_typed_inventory_from_installed_engine() {
    let content = "Public typed source query fixture; not training data.\n";
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connect to installed engine");
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .expect("list installed project job")
        else {
            panic!("job page")
        };
        let job_id = page["jobs"][0]["job_id"].as_str().expect("job id");
        let initial = read(&client, job_id).await;
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let started = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &started, Control::Step).await;
        let connected = approve(&client, handle).await;
        assert_eq!(
            connected["status"]["job"]["checkpoints"]
                .as_array()
                .expect("connect checkpoint")
                .len(),
            1
        );

        let source_path =
            PathBuf::from(&estate.served.view.project).join("source-query-fixture.txt");
        std::fs::write(&source_path, content).expect("temporary project source fixture");
        let changed = read(&client, job_id).await;
        let (handle, _) = prepare(&client, &changed, Control::Replan).await;
        let successor = approve(&client, handle).await;
        let successor_id = successor["status"]["job"]["id"]
            .as_str()
            .expect("replan successor ID");
        assert_ne!(successor_id, job_id);
        assert_ne!(
            successor["plan"]["source_sha256"],
            initial["plan"]["source_sha256"]
        );
        assert_eq!(successor["status"]["job"]["state"], "pending");

        let (handle, _) = prepare(
            &client,
            &successor,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let successor_started = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &successor_started, Control::Step).await;
        let successor_connected = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &successor_connected, Control::Step).await;
        let inventoried = approve(&client, handle).await;
        assert_eq!(inventoried["status"]["job"]["state"], "running");
        assert_eq!(
            inventoried["status"]["job"]["checkpoints"]
                .as_array()
                .expect("source inventory checkpoint")
                .len(),
            2
        );

        let TaskReply::Task { task } = client
            .task_command(TaskCommand::Open {
                title: "Read typed source metadata".into(),
                goal: "Verify the installed engine's public QueryExecute projection without dispatching a provider.".into(),
            })
            .await
            .expect("open scoped task")
        else {
            panic!("task")
        };
        let TaskReply::Sources { inventory } = client
            .task_command(TaskCommand::Sources { task_id: task.id })
            .await
            .expect("typed public source inventory query")
        else {
            panic!("source inventory")
        };
        let expected_sha256 = format!("{:x}", sha2::Sha256::digest(content.as_bytes()));
        let selected = inventory
            .entries
            .iter()
            .find(|entry| entry.path == "source-query-fixture.txt")
            .expect("installed query returned the temporary source fixture");
        assert_eq!(selected.content_sha256, expected_sha256);
        assert_eq!(selected.bytes, content.len().to_string());
        assert!(inventory.read_cursor.parse::<u64>().is_ok());
        assert_eq!(inventory.read_manifest_sha256.len(), 64);
        assert!(!inventory.truncated);
        assert_eq!(inventory.incomplete_rows, 0);
        assert_eq!(inventory.oversized_rows, 0);
        client.close().await.expect("close native session");
    });
}

#[test]
#[ignore = "drives a real RRD process and controlled loopback fixture: set RRFLOW_BIN and run with --ignored"]
fn selected_source_worker_roundtrips_through_installed_ui_adapter() {
    let source_content = "Isolated source-worker protocol fixture; not training data.\n";
    let changed_source_content =
        "Changed after review to prove stale selected content is refused.\n";
    let mut estate = Estate::install_source_read_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connect the installed source-readable estate");
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .expect("list installed attunement job")
        else {
            panic!("attunement page")
        };
        assert_eq!(page["jobs"].as_array().expect("jobs").len(), 1);
        let job_id = page["jobs"][0]["job_id"]
            .as_str()
            .expect("installed job ID");
        let initial = read(&client, job_id).await;
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let started = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &started, Control::Step).await;
        let connected = approve(&client, handle).await;
        assert_eq!(
            connected["status"]["job"]["checkpoints"]
                .as_array()
                .expect("Connect checkpoint")
                .len(),
            1
        );

        let source_path =
            PathBuf::from(&estate.served.view.project).join("source-query-fixture.txt");
        std::fs::write(&source_path, source_content).expect("write owned source fixture");
        let changed = read(&client, job_id).await;
        let (handle, _) = prepare(&client, &changed, Control::Replan).await;
        let successor = approve(&client, handle).await;
        let successor_id = successor["status"]["job"]["id"]
            .as_str()
            .expect("replanned successor ID")
            .to_owned();
        assert_ne!(successor_id, job_id);
        assert_ne!(
            successor["plan"]["source_sha256"],
            initial["plan"]["source_sha256"]
        );
        assert_eq!(successor["status"]["job"]["state"], "pending");

        let (handle, _) = prepare(
            &client,
            &successor,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let successor_started = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &successor_started, Control::Step).await;
        let successor_connected = approve(&client, handle).await;
        let (handle, _) = prepare(&client, &successor_connected, Control::Step).await;
        let inventoried = approve(&client, handle).await;
        assert_eq!(inventoried["status"]["job"]["state"], "running");
        assert_eq!(
            inventoried["status"]["job"]["checkpoints"]
                .as_array()
                .expect("Connect and Inventory checkpoints")
                .len(),
            2
        );

        let TaskReply::Task { task } = client
            .task_command(TaskCommand::Open {
                title: "Review one selected source".into(),
                goal: "Read one bounded source file through the installed UI adapter and preserve its engine provenance.".into(),
            })
            .await
            .expect("open task through the native UI adapter")
        else {
            panic!("opened task")
        };
        let task_id = task.id;
        let limits = client
            .capabilities()
            .await
            .expect("read installed capability budget")
            .configuration
            .reasoning;
        let TaskReply::Budget {
            budget: Some(initial_budget),
        } = client
            .task_command(TaskCommand::Configure {
                task_id: task_id.clone(),
                limits,
            })
            .await
            .expect("configure existing task budget")
        else {
            panic!("configured task budget")
        };
        let TaskReply::Sources { inventory } = client
            .task_command(TaskCommand::Sources {
                task_id: task_id.clone(),
            })
            .await
            .expect("run actual typed QueryExecute source inventory")
        else {
            panic!("source inventory")
        };
        assert_eq!(inventory.result_identity_version, 2);
        assert!(inventory.read_cursor.parse::<u64>().is_ok());
        assert_eq!(inventory.read_manifest_sha256.len(), 64);
        assert!(!inventory.truncated);
        assert_eq!(inventory.incomplete_rows, 0);
        assert_eq!(inventory.oversized_rows, 0);
        eprintln!(
            "typed installed source inventory: unavailable_rows={} (unselectable ambiguous rows)",
            inventory.unavailable_rows
        );
        let content_sha256 = format!("{:x}", sha2::Sha256::digest(source_content.as_bytes()));
        let selected = inventory
            .entries
            .iter()
            .find(|entry| entry.path == "source-query-fixture.txt")
            .expect("installed public query returns the selected source file");
        assert_eq!(selected.content_sha256, content_sha256);
        assert_eq!(selected.bytes, source_content.len().to_string());
        assert_eq!(selected.entry_identity.len(), 64);
        let source_request = rrd_contract::TaskWorkerSourceRequest {
            contract_version: rrd_contract::TASK_WORKER_SOURCE_VERSION,
            entry_identity: selected.entry_identity.clone(),
            expected_content_sha256: selected.content_sha256.clone(),
            maximum_input_bytes: 16_384,
        };

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind controlled loopback only");
        let server_listener = listener.try_clone().expect("clone controlled listener");
        let expected_source = source_content.to_owned();
        let selected_entry_identity = selected.entry_identity.clone();
        let expected_content_sha256 = selected.content_sha256.clone();
        let server = std::thread::spawn(move || {
            let expected = ["selector", "selector", "selector", "worker", "selector"];
            let mut observed = Vec::new();
            for expected_kind in expected {
                let (mut socket, request) = accept_loopback_chat(&server_listener);
                let model = request["model"].as_str().expect("bounded model alias");
                let message_content = request["messages"][1]["content"]
                    .as_str()
                    .expect("chat message content");
                let packet = serde_json::from_str::<Value>(message_content).ok();
                let kind = if packet
                    .as_ref()
                    .is_some_and(|value| value.get("source").is_some())
                {
                    "worker"
                } else {
                    "selector"
                };
                assert_eq!(
                    kind, expected_kind,
                    "provider call order and denial boundary"
                );
                observed.push(kind);
                if kind == "worker" {
                    let packet = packet.expect("worker packet is typed JSON");
                    assert_eq!(packet["source"]["content"], expected_source);
                    let provenance: rrd_contract::TaskWorkerSourceProvenance =
                        serde_json::from_value(packet["source"]["provenance"].clone())
                            .expect("worker packet source provenance uses the public contract");
                    provenance
                        .validate()
                        .expect("worker packet source provenance validates");
                    assert_eq!(
                        provenance.contract_version,
                        rrd_contract::TASK_WORKER_SOURCE_VERSION
                    );
                    assert_eq!(provenance.entry_identity, selected_entry_identity);
                    assert_eq!(provenance.content_sha256, expected_content_sha256);
                    assert_eq!(
                        provenance.path_sha256,
                        format!("{:x}", sha2::Sha256::digest(b"source-query-fixture.txt"))
                    );
                    reply_loopback_chat(
                        &mut socket,
                        model,
                        "Returned one controlled source draft.",
                    );
                } else {
                    let choice = serde_json::json!({
                        "kind": "select",
                        "binding_id": "connectome-loopback-worker",
                        "effort": null,
                    });
                    reply_loopback_chat(&mut socket, model, &choice.to_string());
                }
            }
            std::thread::sleep(Duration::from_millis(250));
            server_listener.set_nonblocking(true).unwrap();
            assert!(
                matches!(
                    server_listener.accept(),
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock
                ),
                "denied or stale worker attempt must not issue another loopback call"
            );
            observed
        });

        let (control_client, control_session_handle) = control_session(&estate).await;
        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            true,
            false,
            "deny-source-export",
        )
        .await;
        let (proposal, review, source, worker_attempt_id) =
            review_source_request(&client, &task_id, source_request.clone()).await;
        let reviewed_source = review
            .source
            .as_ref()
            .expect("typed selected-source review");
        assert_eq!(
            reviewed_source.request.entry_identity,
            selected.entry_identity
        );
        assert_eq!(reviewed_source.path, "source-query-fixture.txt");
        assert_eq!(
            reviewed_source.request.expected_content_sha256,
            content_sha256
        );
        assert_eq!(reviewed_source.bytes, source_content.len().to_string());
        let budget_before_source_denial = read_task_budget(&client, &task_id).await;
        let denied = work_reviewed_source(
            &client,
            &task_id,
            &proposal,
            &review,
            source,
            worker_attempt_id.clone(),
        )
        .await;
        let error = match denied {
            Err(error) => error,
            Ok(TaskReply::Worker { .. }) => panic!("source export revocation dispatched worker"),
            Ok(_) => panic!("source export denial was not the engine's API refusal"),
        };
        assert_ui_api_error(error, "RRD API 403 Forbidden: PermissionDenied: ");
        let after_source_denial = read_task_budget(&client, &task_id).await;
        assert_eq!(after_source_denial, budget_before_source_denial);
        let TaskReply::Attempt {
            status,
            worker: denied_worker,
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id,
            })
            .await
            .expect("read source-export denied attempt")
        else {
            panic!("attempt")
        };
        assert_eq!(status, None);
        assert!(denied_worker.is_none());

        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            false,
            true,
            "deny-context-export",
        )
        .await;
        let (proposal, review, source, worker_attempt_id) =
            review_source_request(&client, &task_id, source_request.clone()).await;
        let budget_before_context_denial = read_task_budget(&client, &task_id).await;
        let denied = work_reviewed_source(
            &client,
            &task_id,
            &proposal,
            &review,
            source,
            worker_attempt_id.clone(),
        )
        .await;
        let error = match denied {
            Err(error) => error,
            Ok(TaskReply::Worker { .. }) => panic!("context export revocation dispatched worker"),
            Ok(_) => panic!("context export denial was not the engine's API refusal"),
        };
        assert_ui_api_error(error, "RRD API 403 Forbidden: PermissionDenied: ");
        let after_context_denial = read_task_budget(&client, &task_id).await;
        assert_eq!(after_context_denial, budget_before_context_denial);
        let TaskReply::Attempt {
            status,
            worker: denied_worker,
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id,
            })
            .await
            .expect("read context-export denied attempt")
        else {
            panic!("attempt")
        };
        assert_eq!(status, None);
        assert!(denied_worker.is_none());

        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            true,
            true,
            "allow-source-worker",
        )
        .await;
        let (proposal, review, source, worker_attempt_id) =
            review_source_request(&client, &task_id, source_request.clone()).await;
        let budget_before_worker = read_task_budget(&client, &task_id).await;
        let TaskReply::Worker { worker } = work_reviewed_source(
            &client,
            &task_id,
            &proposal,
            &review,
            source,
            worker_attempt_id.clone(),
        )
        .await
        .expect("one controlled loopback source-worker call") else {
            panic!("worker")
        };
        assert_eq!(worker.content, "Returned one controlled source draft.");
        let provenance = worker.source.as_ref().expect("source provenance retained");
        assert_eq!(provenance.entry_identity, selected.entry_identity);
        assert_eq!(provenance.content_sha256, content_sha256);
        assert_eq!(provenance.contract_version, 1);
        assert_eq!(provenance.captured_snapshot_sha256.len(), 64);
        assert_eq!(provenance.validated_snapshot_sha256.len(), 64);

        let after_worker = read_task_budget(&client, &task_id).await;
        let elapsed_before: u64 = budget_before_worker.charged_elapsed_ms.parse().unwrap();
        let elapsed_after: u64 = after_worker.charged_elapsed_ms.parse().unwrap();
        assert!(
            elapsed_after >= elapsed_before,
            "accepted worker preserves charged elapsed budget"
        );
        let steps_before: u64 = budget_before_worker.reserved_steps.parse().unwrap();
        let steps_after: u64 = after_worker.reserved_steps.parse().unwrap();
        assert_eq!(
            steps_after,
            steps_before + 1,
            "accepted Work reserves one step"
        );
        assert_eq!(after_worker.max_steps, initial_budget.max_steps);
        let TaskReply::Attempt {
            status,
            worker: Some(readback),
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id.clone(),
            })
            .await
            .expect("read accepted worker attempt")
        else {
            panic!("accepted worker attempt")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        assert_eq!(readback.content, worker.content);
        assert_eq!(
            readback
                .source
                .as_ref()
                .expect("source attempt provenance")
                .content_sha256,
            content_sha256
        );

        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            true,
            false,
            "readback-source-export-revoked",
        )
        .await;
        let TaskReply::Attempt {
            status,
            proposal: _,
            worker: withheld,
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id.clone(),
            })
            .await
            .expect("read retained attempt under source-export revocation")
        else {
            panic!("retained attempt metadata")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        assert!(
            withheld.is_none(),
            "source-derived output is withheld by current policy"
        );

        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            false,
            true,
            "readback-context-export-revoked",
        )
        .await;
        let TaskReply::Attempt {
            status,
            proposal: _,
            worker: withheld,
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id.clone(),
            })
            .await
            .expect("read retained attempt under context-export revocation")
        else {
            panic!("retained attempt metadata")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        assert!(
            withheld.is_none(),
            "source-derived output requires context export too"
        );

        let _ = configure_loopback_profile(
            &control_client,
            &control_session_handle,
            &listener,
            true,
            true,
            "readback-export-restored",
        )
        .await;
        let TaskReply::Attempt {
            status,
            worker: restored,
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id.clone(),
            })
            .await
            .expect("read retained attempt after export restoration")
        else {
            panic!("restored retained attempt")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        let restored = restored.expect("authorized historical worker output");
        assert_eq!(restored.content, worker.content);
        assert_eq!(
            restored
                .source
                .as_ref()
                .expect("restored source provenance")
                .content_sha256,
            content_sha256
        );

        std::fs::write(&source_path, changed_source_content)
            .expect("mutate only the isolated source after its review");
        let (proposal, review, source, stale_attempt_id) =
            review_source_request(&client, &task_id, source_request.clone()).await;
        assert_eq!(
            review
                .source
                .as_ref()
                .expect("old stored source review")
                .request
                .expected_content_sha256,
            content_sha256
        );
        let budget_before_stale_work = read_task_budget(&client, &task_id).await;
        let stale = work_reviewed_source(
            &client,
            &task_id,
            &proposal,
            &review,
            source,
            stale_attempt_id.clone(),
        )
        .await;
        let error = match stale {
            Err(error) => error,
            Ok(TaskReply::Worker { .. }) => panic!("stale source bytes reached worker dispatch"),
            Ok(_) => panic!("stale source was not refused by the engine API"),
        };
        assert_ui_api_error(
            error,
            "RRD API 412 Precondition Failed: FailedPrecondition: ",
        );
        let after_stale_denial = read_task_budget(&client, &task_id).await;
        assert_eq!(after_stale_denial, budget_before_stale_work);
        let TaskReply::Attempt {
            status,
            worker: stale_worker,
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: stale_attempt_id,
            })
            .await
            .expect("read stale-source denied attempt")
        else {
            panic!("attempt")
        };
        assert_eq!(status, None);
        assert!(stale_worker.is_none());
        let TaskReply::Attempt {
            status,
            worker: historical_output,
            ..
        } = client
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id.clone(),
            })
            .await
            .expect("read retained output after ordinary source-byte edit")
        else {
            panic!("historical worker attempt")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        assert_eq!(
            historical_output
                .as_ref()
                .expect("still-authorized historical output")
                .content,
            worker.content
        );
        assert_eq!(
            server.join().expect("controlled loopback transcript"),
            ["selector", "selector", "selector", "worker", "selector"]
        );

        let closed_control_session = control_client
            .close_session(
                &control_session_handle,
                rrd_contract::CloseSession {},
                RequestOptions::mutation(
                    "connectome-close-control-session-before-restart",
                    "connectome-close-control-session-before-restart-op",
                    "connectome-close-control-session-before-restart-key",
                )
                .unwrap(),
            )
            .await
            .expect("close the old control session through the public SDK");
        assert_eq!(
            closed_control_session.state,
            rrd_contract::SessionEndState::Closed
        );
        assert_eq!(
            closed_control_session.session_id,
            control_session_handle.session_id().clone()
        );
        client
            .close()
            .await
            .expect("close active UI-adapter session before process restart");
        estate.stop_and_reopen();
        let new_address_client = RrdClient::connect_local(
            estate.address,
            rrd_contract::CanonicalId::new(&estate.instance).expect("reopened instance ID"),
            ClientConfig {
                max_attempts: 1,
                ..ClientConfig::default()
            },
        )
        .expect("connect to the new process address for stale-session probe");
        let stale_configuration_session = new_address_client
            .read_endpoint_configuration(
                &control_session_handle,
                rrd_contract::ReadEndpointConfiguration {},
                RequestOptions::read(
                    "connectome-stale-control-session-read",
                    "connectome-stale-control-session-read-op",
                )
                .unwrap(),
            )
            .await;
        match stale_configuration_session {
            Err(rrd_client::Error::Api { status, error }) => {
                assert_eq!(status.as_u16(), 412);
                assert_eq!(error.code, rrd_contract::ErrorCode::FailedPrecondition);
            }
            _ => panic!("explicitly closed pre-restart session remained usable"),
        }
        let (fresh_control_client, fresh_control_session) = control_session(&estate).await;
        let reopened_configuration = fresh_control_client
            .read_endpoint_configuration(
                &fresh_control_session,
                rrd_contract::ReadEndpointConfiguration {},
                RequestOptions::read(
                    "connectome-fresh-control-session-read",
                    "connectome-fresh-control-session-read-op",
                )
                .unwrap(),
            )
            .await
            .expect("fresh public SDK session works after restart");
        assert_eq!(
            reopened_configuration.identity.instance_id.as_str(),
            estate.instance
        );
        let reopened = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("reauthenticate after real installed-process restart");
        let TaskReply::Budget {
            budget: Some(reopened_budget),
        } = reopened
            .task_command(TaskCommand::Budget {
                task_id: task_id.clone(),
            })
            .await
            .expect("read persisted budget after restart")
        else {
            panic!("reopened budget")
        };
        assert_eq!(reopened_budget, after_stale_denial);
        let TaskReply::Attempt {
            status,
            worker: Some(reopened_attempt),
            ..
        } = reopened
            .task_command(TaskCommand::Attempt {
                task_id: task_id.clone(),
                attempt_id: worker_attempt_id,
            })
            .await
            .expect("read accepted attempt after restart")
        else {
            panic!("reopened accepted attempt")
        };
        assert_eq!(status, Some(rrd_contract::TaskAttemptStatus::Accepted));
        assert_eq!(reopened_attempt.content, worker.content);
        assert_eq!(
            reopened_attempt
                .source
                .as_ref()
                .expect("reopened source provenance")
                .entry_identity,
            selected.entry_identity
        );
        assert_eq!(
            reopened_attempt
                .source
                .as_ref()
                .expect("reopened source provenance")
                .content_sha256,
            content_sha256
        );
        reopened
            .close()
            .await
            .expect("close reauthenticated session");
    });
}
