//! Live policy reads and exact native-held project approvals.
use super::projection::{definitive_denial, projection, unsigned};
use super::*;
use rrd_contract::{
    ApplyProjectConfiguration, ConfigurationChange, ConfigurationSetting, CorrelationId,
    EffectiveConfiguration, NumericConfiguration, PreviewProjectConfiguration,
    ProjectConfigurationPlan, ReadEffectiveConfiguration, ReadProjectConfiguration, RecallLimits,
};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NumericInput {
    minimum: Option<String>,
    maximum: Option<String>,
    preference: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum ConfigurationCommand {
    Read,
    Pending,
    Prepare {
        expected_revision: String,
        settings: BTreeMap<ConfigurationSetting, NumericInput>,
    },
    Approve {
        handle: String,
    },
    Discard {
        handle: String,
    },
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ConfigurationReply {
    Snapshot {
        project: Value,
        effective: Option<Value>,
        effective_error: Option<String>,
    },
    Pending {
        prepared: Option<Value>,
    },
    Prepared {
        handle: String,
        plan: Value,
        uncertain: bool,
    },
    Applied {
        project: Value,
    },
    Discarded,
    Denied {
        message: String,
    },
    Uncertain {
        message: String,
    },
}

pub(super) struct PendingConfiguration {
    handle: String,
    session_id: CorrelationId,
    plan: ProjectConfigurationPlan,
    options: RequestOptions,
    uncertain: bool,
}

impl PendingConfiguration {
    fn view(&self) -> Result<ConfigurationReply, RrdError> {
        Ok(ConfigurationReply::Prepared {
            handle: self.handle.clone(),
            plan: projection(&self.plan)?,
            uncertain: self.uncertain,
        })
    }
}

impl NativeRrdClient {
    pub(super) async fn effective_configuration(&self) -> Result<EffectiveConfiguration, RrdError> {
        self.send(false, |session, options| async move {
            self.client
                .read_effective_configuration(
                    &session,
                    ReadEffectiveConfiguration::default(),
                    options,
                )
                .await
        })
        .await
    }

    pub(super) async fn effective_query_budget(&self) -> Result<QueryBudget, RrdError> {
        use ConfigurationSetting::*;
        let policy = self.effective_configuration().await?;
        let value = |setting| policy.values[&setting].value;
        Ok(QueryBudget {
            max_storage_keys: value(QueryStorageKeys),
            max_rows: value(QueryRows),
            max_output_bytes: value(QueryOutputBytes),
            max_batch_rows: value(QueryBatchRows),
            max_memory_bytes: value(QueryMemoryBytes),
            max_spill_bytes: value(QuerySpillBytes),
            max_elapsed_ms: value(QueryElapsedMs),
        })
    }

    pub(super) async fn effective_recall_budget(&self) -> Result<RecallLimits, RrdError> {
        use ConfigurationSetting::*;
        let policy = self.effective_configuration().await?;
        let value = |setting| policy.values[&setting].value;
        Ok(RecallLimits {
            max_graph_depth: value(RecallGraphDepth)
                .try_into()
                .map_err(|_| "recall depth exceeds native range")?,
            max_items: value(RecallItems),
            max_output_bytes: value(RecallOutputBytes),
            max_storage_keys: value(RecallStorageKeys),
        })
    }

    pub async fn configuration_command(
        &self,
        request: ConfigurationCommand,
    ) -> Result<ConfigurationReply, RrdError> {
        match request {
            ConfigurationCommand::Read => {
                let project = self
                    .send(false, |session, options| async move {
                        self.client
                            .read_project_configuration(
                                &session,
                                ReadProjectConfiguration {},
                                options,
                            )
                            .await
                    })
                    .await?;
                {
                    let mut pending = self.pending_configuration.lock().await;
                    if pending.as_ref().is_some_and(|p| {
                        p.uncertain
                            && project
                                .head
                                .as_ref()
                                .is_some_and(|head| head.applied_plan_sha256 == p.plan.plan_sha256)
                    }) {
                        *pending = None;
                    }
                }
                // A composition conflict must not hide the project rules needed to repair it.
                let (effective, effective_error) = match self.effective_configuration().await {
                    Ok(value) => (Some(projection(&value)?), None),
                    Err(error) => (None, Some(error.message)),
                };
                Ok(ConfigurationReply::Snapshot {
                    project: projection(&project)?,
                    effective,
                    effective_error,
                })
            }
            ConfigurationCommand::Pending => {
                let pending = self.pending_configuration.lock().await;
                Ok(ConfigurationReply::Pending {
                    prepared: pending
                        .as_ref()
                        .map(|p| p.view().and_then(|v| projection(&v)))
                        .transpose()?,
                })
            }
            ConfigurationCommand::Prepare {
                expected_revision,
                settings,
            } => {
                let mut pending = self.pending_configuration.lock().await;
                if pending.as_ref().is_some_and(|p| p.uncertain) {
                    return Err("the earlier approval has an unknown outcome; retry the same approval or inspect its recorded plan digest".into());
                }
                *pending = None;
                let settings = settings
                    .into_iter()
                    .map(|(key, value)| {
                        Ok((
                            key,
                            NumericConfiguration {
                                minimum: value.minimum.as_deref().map(unsigned).transpose()?,
                                maximum: value.maximum.as_deref().map(unsigned).transpose()?,
                                preference: value
                                    .preference
                                    .as_deref()
                                    .map(unsigned)
                                    .transpose()?,
                            },
                        ))
                    })
                    .collect::<Result<_, RrdError>>()?;
                let request = PreviewProjectConfiguration {
                    expected_revision: unsigned(&expected_revision)?,
                    change: ConfigurationChange {
                        valid_from_unix_ms: now_unix_ms()?,
                        valid_to_unix_ms: None,
                        settings,
                    },
                };
                let lease = self.lease().await?;
                let plan = self
                    .client
                    .preview_project_configuration(&lease.session, request, self.ids.next(false)?)
                    .await
                    .map_err(RrdError::sdk)?;
                let prepared = PendingConfiguration {
                    handle: format!("policy-{}", Uuid::new_v4().simple()),
                    session_id: lease.session.session_id().clone(),
                    plan,
                    options: self.ids.next(true)?,
                    uncertain: false,
                };
                let view = prepared.view()?;
                *pending = Some(prepared);
                Ok(view)
            }
            ConfigurationCommand::Discard { handle } => {
                let mut pending = self.pending_configuration.lock().await;
                let prepared = pending
                    .as_ref()
                    .filter(|p| p.handle == handle)
                    .ok_or("preview no longer pending")?;
                if prepared.uncertain {
                    return Err("cannot discard an approval with unknown outcome".into());
                }
                *pending = None;
                Ok(ConfigurationReply::Discarded)
            }
            ConfigurationCommand::Approve { handle } => self.approve_configuration(&handle).await,
        }
    }

    async fn approve_configuration(&self, handle: &str) -> Result<ConfigurationReply, RrdError> {
        let mut pending = self.pending_configuration.lock().await;
        let change = pending
            .as_mut()
            .filter(|p| p.handle == handle)
            .ok_or("preview no longer pending")?;
        let lease = self.lease().await?;
        // A current stored head can prove success even after a lost response/session expiry.
        if change.uncertain {
            let read = self
                .client
                .read_project_configuration(
                    &lease.session,
                    ReadProjectConfiguration {},
                    self.ids.next(false)?,
                )
                .await
                .map_err(RrdError::sdk)?;
            if read
                .head
                .as_ref()
                .is_some_and(|head| head.applied_plan_sha256 == change.plan.plan_sha256)
            {
                *pending = None;
                return Ok(ConfigurationReply::Applied {
                    project: projection(&read)?,
                });
            }
        }
        if lease.session.session_id() != &change.session_id {
            if change.uncertain {
                return Ok(ConfigurationReply::Uncertain { message: "preview session ended; inspect the original plan digest in stored history before further changes".into() });
            }
            *pending = None;
            return Ok(ConfigurationReply::Denied {
                message: "preview session ended; no command was sent; prepare again".into(),
            });
        }
        let mut options = change.options.clone();
        options.deadline_unix_ms = Some(now_unix_ms()? + REQUEST_TIMEOUT.as_millis() as u64);
        let request = ApplyProjectConfiguration {
            plan: change.plan.clone(),
            approved_plan_sha256: change.plan.plan_sha256.clone(),
        };
        let result = self
            .client
            .apply_project_configuration(&lease.session, request, options)
            .await;
        match result {
            Ok(project) => {
                *pending = None;
                Ok(ConfigurationReply::Applied {
                    project: projection(&project)?,
                })
            }
            // A project CAS/plan conflict is an explicit pre-publication denial.
            // Retryable means prepare again, not an unknown commit. After a lost
            // reply, however, even a later conflict cannot disprove the first write.
            Err(error)
                if !change.uncertain
                    && (definitive_denial(&error)
                        || matches!(&error, rrd_client::Error::Api { error, .. } if error.code == rrd_contract::ErrorCode::Conflict)) =>
            {
                *pending = None;
                Ok(ConfigurationReply::Denied {
                    message: RrdError::sdk(error).message,
                })
            }
            Err(error) => {
                change.uncertain = true;
                Ok(ConfigurationReply::Uncertain {
                    message: RrdError::sdk(error).message,
                })
            }
        }
    }
}
