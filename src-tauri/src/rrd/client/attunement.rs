//! Public engine plans and explicit native-held commands. No client lifecycle owner.
use super::*;
use rrd_contract::{
    AcceptAttunementReplan, AttunementPlan, AttunementReadResult, AttunementReplanPreview,
    CancelAttunement, CorrelationId, ListAttunementJobs, PauseAttunement, PreviewAttunementReplan,
    ReadAttunement, ReadAttunementReceipt, RecoverExpiredAttunement, ResumeAttunement,
    ResumeAttunementWithLease, StartAttunement, StepAttunement, ATTUNEMENT_CONTRACT_VERSION,
    MAX_ATTUNEMENT_JOB_PAGE,
};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum AttunementCommand {
    Pending,
    List {
        after_job_id: Option<String>,
    },
    Read {
        job_id: String,
    },
    Prepare {
        job_id: String,
        expected_revision: String,
        plan_sha256: String,
        command: Control,
    },
    Approve {
        handle: String,
    },
    Discard {
        handle: String,
    },
    Receipt {
        job_id: String,
        idempotency_key: String,
        replan: bool,
    },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Control {
    Start { lease_ms: String },
    Step,
    Pause,
    Resume { lease_ms: String },
    RecoverExpired,
    Cancel { reason: String },
    Replan,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AttunementReply {
    Pending {
        prepared: Option<Value>,
    },
    Page {
        page: Value,
    },
    Snapshot {
        snapshot: Value,
    },
    Prepared {
        handle: String,
        job_id: String,
        idempotency_key: String,
        replan: bool,
        snapshot: Value,
        command: Value,
    },
    Applied {
        snapshot: Value,
    },
    Receipt {
        snapshot: Option<Value>,
    },
    Discarded,
    Denied {
        message: String,
    },
    Uncertain {
        message: String,
    },
}

/// These are SDK contract commands, retained exactly as shown for approval.
#[derive(Serialize)]
#[serde(tag = "kind", content = "request", rename_all = "snake_case")]
enum PreparedControl {
    Start(StartAttunement),
    Step(StepAttunement),
    Pause(PauseAttunement),
    Resume(ResumeAttunementWithLease),
    RecoverExpired(RecoverExpiredAttunement),
    Cancel(CancelAttunement),
    Replan(Box<AcceptAttunementReplan>),
}

pub(super) struct PendingAttunement {
    handle: String,
    session_id: CorrelationId,
    job_id: CanonicalId,
    plan: AttunementPlan,
    command: PreparedControl,
    options: RequestOptions,
    uncertain: bool,
    view: Value,
}

/// Serialize validated contract objects without rounding u64 in the webview.
fn projection(value: &impl Serialize) -> Result<Value, RrdError> {
    fn decimal(value: &mut Value) {
        match value {
            Value::Number(number) => *value = Value::String(number.to_string()),
            Value::Array(values) => values.iter_mut().for_each(decimal),
            Value::Object(values) => values.values_mut().for_each(decimal),
            _ => {}
        }
    }
    let mut value = serde_json::to_value(value).map_err(|error| error.to_string())?;
    decimal(&mut value);
    Ok(value)
}

// Only explicit pre-commit denials release a newly submitted command. Storage,
// internal, cancellation and availability failures may follow durable effects.
fn definitive_denial(error: &rrd_client::Error) -> bool {
    use rrd_contract::ErrorCode;
    matches!(error, rrd_client::Error::Api { error, .. } if !error.retryable && matches!(error.code,
        ErrorCode::InvalidArgument | ErrorCode::NotFound | ErrorCode::AlreadyExists |
        ErrorCode::Conflict | ErrorCode::FailedPrecondition | ErrorCode::Unauthenticated |
        ErrorCode::PermissionDenied | ErrorCode::ResourceExhausted | ErrorCode::DeadlineExceeded |
        ErrorCode::UnsupportedVersion))
}

fn unsigned(value: &str) -> Result<u64, RrdError> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("expected an unsigned decimal integer".into());
    }
    value
        .parse()
        .map_err(|_| "integer exceeds the native range".into())
}

fn snapshot(
    plan: &AttunementPlan,
    status: &rrd_contract::AttunementStatus,
) -> Result<Value, RrdError> {
    status.validate(plan).map_err(|error| error.to_string())?;
    projection(&AttunementReadResult {
        plan: plan.clone(),
        status: status.clone(),
        source_verification: rrd_contract::AttunementSourceVerification::NotChecked,
    })
}

impl NativeRrdClient {
    async fn attunement_read(&self, job_id: CanonicalId) -> Result<AttunementReadResult, RrdError> {
        self.send(false, |session, options| async move {
            self.client
                .read_attunement(
                    &session,
                    ReadAttunement {
                        contract_version: ATTUNEMENT_CONTRACT_VERSION,
                        job_id,
                    },
                    options,
                )
                .await
        })
        .await
    }

    pub async fn attunement_command(
        &self,
        request: AttunementCommand,
    ) -> Result<AttunementReply, RrdError> {
        match request {
            AttunementCommand::Pending => Ok(AttunementReply::Pending {
                prepared: self
                    .pending_attunement
                    .lock()
                    .await
                    .as_ref()
                    .map(|p| p.view.clone()),
            }),
            AttunementCommand::List { after_job_id } => {
                let request = ListAttunementJobs {
                    contract_version: ATTUNEMENT_CONTRACT_VERSION,
                    after_job_id: after_job_id.map(|id| canonical(&id, "job")).transpose()?,
                    limit: MAX_ATTUNEMENT_JOB_PAGE,
                };
                let page = self
                    .send(false, |session, options| async move {
                        self.client
                            .list_attunement_jobs(&session, request, options)
                            .await
                    })
                    .await?;
                Ok(AttunementReply::Page {
                    page: projection(&page)?,
                })
            }
            AttunementCommand::Read { job_id } => {
                let read = self.attunement_read(canonical(&job_id, "job")?).await?;
                Ok(AttunementReply::Snapshot {
                    snapshot: projection(&read)?,
                })
            }
            AttunementCommand::Prepare {
                job_id,
                expected_revision,
                plan_sha256,
                command,
            } => {
                self.prepare_attunement(
                    canonical(&job_id, "job")?,
                    unsigned(&expected_revision)?,
                    plan_sha256,
                    command,
                )
                .await
            }
            AttunementCommand::Approve { handle } => self.approve_attunement(&handle).await,
            AttunementCommand::Discard { handle } => {
                let mut pending = self.pending_attunement.lock().await;
                let change = pending
                    .as_ref()
                    .filter(|p| p.handle == handle)
                    .ok_or("preview no longer pending")?;
                if change.uncertain {
                    return Err("read the receipt or retry the same approval before discarding an uncertain command".into());
                }
                *pending = None;
                Ok(AttunementReply::Discarded)
            }
            AttunementCommand::Receipt {
                job_id,
                idempotency_key,
                replan,
            } => {
                let request = ReadAttunementReceipt {
                    contract_version: ATTUNEMENT_CONTRACT_VERSION,
                    job_id: canonical(&job_id, "job")?,
                    idempotency_key: CorrelationId::new(&idempotency_key)
                        .map_err(|error| error.to_string())?,
                };
                let mut pending = self.pending_attunement.lock().await;
                let result = if replan {
                    let read = self
                        .send(false, |session, options| async move {
                            self.client
                                .read_attunement_replan_receipt(&session, request, options)
                                .await
                        })
                        .await?;
                    read.receipt
                        .map(|receipt| snapshot(&receipt.result.plan, &receipt.result.successor))
                        .transpose()?
                } else {
                    let read = self
                        .send(false, |session, options| async move {
                            self.client
                                .read_attunement_receipt(&session, request, options)
                                .await
                        })
                        .await?;
                    read.receipt
                        .map(|receipt| snapshot(&receipt.plan, &receipt.status))
                        .transpose()?
                };
                if result.is_some()
                    && pending.as_ref().is_some_and(|p| {
                        p.job_id.as_str() == job_id
                            && p.options
                                .idempotency_key
                                .as_ref()
                                .is_some_and(|key| key.as_str() == idempotency_key)
                            && matches!(p.command, PreparedControl::Replan(_)) == replan
                    })
                {
                    *pending = None;
                }
                Ok(AttunementReply::Receipt { snapshot: result })
            }
        }
    }

    async fn prepare_attunement(
        &self,
        job_id: CanonicalId,
        revision: u64,
        plan_sha256: String,
        command: Control,
    ) -> Result<AttunementReply, RrdError> {
        let mut pending = self.pending_attunement.lock().await;
        if pending.as_ref().is_some_and(|p| p.uncertain) {
            return Err("an earlier command has an uncertain outcome; read its receipt or retry that exact approval".into());
        }
        // A failed new preparation also invalidates the old preview.
        *pending = None;
        let read = self.attunement_read(job_id.clone()).await?;
        let job = &read.status.job;
        if job.revision != revision || read.plan.plan_sha256 != plan_sha256 {
            return Err("the job changed since it was displayed; refresh its stored plan".into());
        }
        let contract_version = ATTUNEMENT_CONTRACT_VERSION;
        let last_checkpoint_sha256 = job
            .checkpoints
            .last()
            .map(|checkpoint| checkpoint.checkpoint_sha256.clone());
        let lease_generation = || {
            job.lease
                .as_ref()
                .map(|lease| lease.generation)
                .ok_or("the stored job has no lease")
        };
        let lease = self.lease().await?;
        let command = match command {
            Control::Start { lease_ms } => PreparedControl::Start(StartAttunement {
                contract_version,
                job_id: job_id.clone(),
                plan_sha256,
                expected_revision: revision,
                lease_ms: unsigned(&lease_ms)?,
            }),
            Control::Step => PreparedControl::Step(StepAttunement {
                contract_version,
                job_id: job_id.clone(),
                expected_revision: revision,
                lease_generation: lease_generation()?,
            }),
            Control::Pause => PreparedControl::Pause(PauseAttunement {
                contract_version,
                job_id: job_id.clone(),
                expected_revision: revision,
                lease_generation: lease_generation()?,
            }),
            Control::RecoverExpired => PreparedControl::RecoverExpired(RecoverExpiredAttunement {
                contract_version,
                job_id: job_id.clone(),
                expected_revision: revision,
            }),
            Control::Resume { lease_ms } => PreparedControl::Resume(ResumeAttunementWithLease {
                request: ResumeAttunement {
                    contract_version,
                    job_id: job_id.clone(),
                    plan_sha256,
                    expected_job_revision: revision,
                    last_checkpoint_sha256,
                    resume_from_phase: job
                        .next_phase(&read.plan)
                        .ok_or("the stored job has no next phase")?,
                    requested_at_unix_ms: now_unix_ms()?,
                },
                lease_ms: unsigned(&lease_ms)?,
            }),
            Control::Cancel { reason } => PreparedControl::Cancel(CancelAttunement {
                contract_version,
                job_id: job_id.clone(),
                plan_sha256,
                expected_job_revision: revision,
                last_checkpoint_sha256,
                reason,
                requested_at_unix_ms: now_unix_ms()?,
            }),
            Control::Replan => {
                let preview: AttunementReplanPreview = self
                    .client
                    .preview_attunement_replan(
                        &lease.session,
                        PreviewAttunementReplan {
                            contract_version,
                            job_id: job_id.clone(),
                            expected_revision: revision,
                        },
                        &read.plan,
                        self.ids.next(false)?,
                    )
                    .await
                    .map_err(RrdError::sdk)?;
                PreparedControl::Replan(Box::new(AcceptAttunementReplan {
                    contract_version,
                    proposal_sha256: preview.proposal_sha256.clone(),
                    preview,
                }))
            }
        };
        let options = self.ids.next(true)?;
        let handle = format!("plan-{}", Uuid::new_v4().simple());
        let reply = AttunementReply::Prepared {
            handle: handle.clone(),
            job_id: job_id.to_string(),
            idempotency_key: options
                .idempotency_key
                .as_ref()
                .ok_or("mutation identity is absent")?
                .as_str()
                .to_owned(),
            replan: matches!(command, PreparedControl::Replan(_)),
            snapshot: projection(&read)?,
            command: projection(&command)?,
        };
        let view = projection(&reply)?;
        *pending = Some(PendingAttunement {
            handle,
            session_id: lease.session.session_id().clone(),
            job_id,
            plan: read.plan,
            command,
            options,
            uncertain: false,
            view,
        });
        Ok(reply)
    }

    async fn approve_attunement(&self, handle: &str) -> Result<AttunementReply, RrdError> {
        let mut pending = self.pending_attunement.lock().await;
        let change = pending
            .as_mut()
            .filter(|p| p.handle == handle)
            .ok_or("preview no longer pending")?;
        let lease = match self.lease().await {
            Ok(lease) => lease,
            Err(error) => {
                if change.uncertain {
                    return Ok(AttunementReply::Uncertain {
                        message: error.message,
                    });
                }
                *pending = None;
                return Ok(AttunementReply::Denied {
                    message: format!("The command was not sent: {}", error.message),
                });
            }
        };
        if lease.session.session_id() != &change.session_id {
            if change.uncertain {
                return Ok(AttunementReply::Uncertain { message: "the preview session ended; reconcile the original receipt before further changes".into() });
            }
            *pending = None;
            return Ok(AttunementReply::Denied {
                message: "the preview session ended; no command was sent; prepare again".into(),
            });
        }
        // Retries are explicit and use the original command and idempotency key.
        let mut options = change.options.clone();
        options.deadline_unix_ms = Some(now_unix_ms()? + REQUEST_TIMEOUT.as_millis() as u64);
        let session = &lease.session;
        let plan = &change.plan;
        let result = match &change.command {
            PreparedControl::Start(request) => self
                .client
                .start_attunement(session, request.clone(), plan, options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::Step(request) => self
                .client
                .step_attunement(session, request.clone(), plan, options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::Pause(request) => self
                .client
                .pause_attunement(session, request.clone(), plan, options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::RecoverExpired(request) => self
                .client
                .recover_expired_attunement(session, request.clone(), plan, options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::Resume(request) => self
                .client
                .resume_attunement(session, request.clone(), plan, options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::Cancel(request) => self
                .client
                .cancel_attunement(session, request.clone(), options)
                .await
                .map(|r| (plan.clone(), r.status)),
            PreparedControl::Replan(request) => self
                .client
                .accept_attunement_replan(session, (**request).clone(), plan, options)
                .await
                .map(|r| (r.plan, r.successor)),
        };
        match result {
            Ok((plan, status)) => {
                let view = match snapshot(&plan, &status) {
                    Ok(view) => view,
                    Err(error) => {
                        change.uncertain = true;
                        return Err(error);
                    }
                };
                *pending = None;
                Ok(AttunementReply::Applied { snapshot: view })
            }
            Err(error) => {
                // A definitive API denial can release this command. Transport,
                // timeout and response validation errors may follow a commit.
                let uncertain = !definitive_denial(&error);
                if uncertain || change.uncertain {
                    change.uncertain = true;
                    Ok(AttunementReply::Uncertain {
                        message: RrdError::sdk(error).message,
                    })
                } else {
                    *pending = None;
                    Ok(AttunementReply::Denied {
                        message: RrdError::sdk(error).message,
                    })
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn projection_keeps_full_integer_precision_and_rejects_invalid_inputs() {
        let value =
            projection(&serde_json::json!({"revision":u64::MAX,"nested":[1,2],"id":"x"})).unwrap();
        assert_eq!(value["revision"], u64::MAX.to_string());
        assert_eq!(value["nested"][0], "1");
        assert_eq!(unsigned(&u64::MAX.to_string()).unwrap(), u64::MAX);
        for invalid in ["", "+1", "-1", "1.0", "18446744073709551616"] {
            assert!(unsigned(invalid).is_err());
        }
        assert!(serde_json::from_value::<AttunementCommand>(
            serde_json::json!({"action":"approve","handle":"x","request":{}})
        )
        .is_err());
    }
}
