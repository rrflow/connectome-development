//! Governed effects through the native client against a real RRD process:
//! a change commits exactly as previewed, exports and backups round-trip,
//! effects fail closed across an engine restart, and every refusal holds.
//!
//! Like the lens tests they install and serve a fresh estate through the
//! product's serve path, load the lens fixture, and are run by CI's RRD
//! process job with `--ignored`.

use super::*;
use crate::rrd::client::artifact::write_artifact;
use crate::rrd::client::{
    RrdAuditExportRequest, RrdAuditRequest, RrdBackupCreateRequest, RrdBackupRestoreRequest,
    RrdBackupsRequest, RrdChangeCommitRequest, RrdChangePreviewRequest, RrdChangesRequest,
    RrdQueryExportRequest,
};
use crate::rrd::view::history::AuditRecordView;
use crate::rrd::RrdClientState;

/// A new document in the fixture's strict `document` kind.
fn document_change(id: &str) -> RrdChangePreviewRequest {
    serde_json::from_value(json!({
        "mutations": [{
            "mutation": "put_record",
            "reference": { "kind": "document", "id": id },
            "valid_from": 1,
            "properties": {
                "title": { "type": "string", "value": format!("Document {id}") },
                "group": { "type": "string", "value": "c" }
            }
        }]
    }))
    .expect("a contract change")
}

async fn documents(client: &NativeRrdClient) -> Vec<String> {
    let at = now_unix_ms().expect("clock");
    let rows = client
        .query(RrdQueryRequest {
            query: format!("FROM record:document AT VALID {at} KNOWN HEAD PROJECT * LIMIT 50"),
        })
        .await
        .expect("documents");
    rows.rows.into_iter().map(|row| row.identity).collect()
}

fn has(documents: &[String], id: &str) -> bool {
    documents
        .iter()
        .any(|identity| identity.ends_with(&format!(":{id}")))
}

/// The audit chain from its start, read forward one page at a time. Every
/// read is itself audited, so the chain is never exhausted: the trail ends at
/// the first page that is not full.
async fn audit_trail(client: &NativeRrdClient) -> (Vec<AuditRecordView>, Option<String>) {
    const PAGE: u16 = 512;
    let mut records = Vec::new();
    let mut after_sequence = 0;
    loop {
        let page = client
            .audit(RrdAuditRequest {
                after_sequence,
                limit: PAGE,
            })
            .await
            .expect("audit page");
        let full = page.records.len() == usize::from(PAGE);
        after_sequence = page.through_sequence;
        records.extend(page.records);
        if !full {
            let head = records.last().map(|record| record.audit_sha256.clone());
            return (records, head);
        }
    }
}

fn count(records: &[AuditRecordView], action: &str) -> usize {
    records
        .iter()
        .filter(|record| {
            record.action == action && record.phase == "completed" && record.decision == "allowed"
        })
        .count()
}

impl Estate {
    /// Stops the engine and serves the same installed estate again. The kernel
    /// picks a new port, so earlier connections lose their endpoint.
    pub(super) fn restart(&mut self) {
        let _ = self.served.server.kill();
        let _ = self.served.server.wait();
        let mut reopen = EstateServeRequest {
            project: self.served.view.project.clone(),
            mode: InstallMode::Fresh,
            executable: rrflow().to_string_lossy().into_owned(),
            accepted_plan_sha256: None,
            installation_identity: None,
        };
        let preview = preview_estate(&reopen).expect("reopen preview");
        assert!(
            preview.installation.is_none(),
            "an installed estate reopens without a new installation plan"
        );
        reopen.installation_identity = preview.installation_identity;
        let observer = Arc::new(RecordingObserver::default());
        let served = serve_estate(reopen, observer.clone()).unwrap_or_else(|error| {
            panic!(
                "reopening the estate failed: {error:?}\n{}",
                observer.lines.lock().expect("observer").join("\n")
            )
        });
        assert!(
            !served.view.installed,
            "a restart reopens the installed estate"
        );
        assert_eq!(served.view.instance, self.instance);
        self.address = served
            .view
            .endpoint
            .strip_prefix("http://")
            .and_then(|address| address.parse().ok())
            .expect("the reopened estate names a loopback HTTP address");
        self.served = served;
    }
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn a_change_commits_exactly_as_previewed() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection");
        let (audited, _) = audit_trail(&client).await;
        let before = client
            .changes(RrdChangesRequest {
                after_cursor: 0,
                limit: 1,
            })
            .await
            .expect("changefeed head")
            .head_cursor;

        // The preview shows what the change writes and holds it pending.
        let replaced = client
            .preview_change(document_change("c1"))
            .await
            .expect("preview c1");
        assert_eq!(replaced.mutations.len(), 1);
        let shown = &replaced.mutations[0];
        assert_eq!(shown.operation, "put_record");
        assert_eq!(shown.target, "document:c1");
        assert_eq!(shown.properties["title"], "Document c1");
        assert_eq!(
            replaced.prospective.known_at_cursor,
            replaced.read_cursor + 1,
            "the prospective snapshot covers the read cursor and the mutation"
        );
        let refused = client
            .commit_change(RrdChangeCommitRequest {
                handle: replaced.handle.clone(),
                operation_sha256: "0".repeat(64),
            })
            .await
            .expect_err("a digest the operator was not shown");
        assert!(refused.message.contains("approved digest"), "{refused}");

        // A newer preview replaces it; the replaced handle commits nothing.
        let change = client
            .preview_change(document_change("c2"))
            .await
            .expect("preview c2");
        let superseded = client
            .commit_change(RrdChangeCommitRequest {
                handle: replaced.handle.clone(),
                operation_sha256: replaced.operation_sha256.clone(),
            })
            .await
            .expect_err("a replaced preview");
        assert!(
            superseded.message.contains("no longer pending"),
            "{superseded}"
        );

        let receipt = client
            .commit_change(RrdChangeCommitRequest {
                handle: change.handle.clone(),
                operation_sha256: change.operation_sha256.clone(),
            })
            .await
            .expect("commit c2");
        assert_eq!(receipt.operation_sha256, change.operation_sha256);
        assert_eq!(receipt.mutation_count, 1);
        assert!(!receipt.idempotent_replay);
        let committed_at = receipt
            .last_runtime_cursor
            .expect("a data commit has a runtime cursor");
        client
            .commit_change(RrdChangeCommitRequest {
                handle: change.handle.clone(),
                operation_sha256: change.operation_sha256.clone(),
            })
            .await
            .expect_err("a committed change is no longer pending");

        // A discarded preview commits nothing, and discarding is final.
        let discarded = client
            .preview_change(document_change("c3"))
            .await
            .expect("preview c3");
        client
            .discard_change(&discarded.handle)
            .await
            .expect("discard c3");
        client
            .discard_change(&discarded.handle)
            .await
            .expect_err("nothing left to discard");

        let documents = documents(&client).await;
        assert_eq!(documents.len(), DOCUMENTS + 1);
        assert!(has(&documents, "c2"));
        assert!(!has(&documents, "c1") && !has(&documents, "c3"));

        // The changefeed holds the one committed mutation and nothing else.
        let changes = client
            .changes(RrdChangesRequest {
                after_cursor: before,
                limit: 256,
            })
            .await
            .expect("changes since the fixture");
        let written: Vec<_> = changes
            .changes
            .iter()
            .filter(|change| change.mutation.target.starts_with("document:"))
            .map(|change| (change.cursor, change.mutation.target.as_str()))
            .collect();
        assert_eq!(written, [(committed_at, "document:c2")]);
        for pair in changes.changes.windows(2) {
            assert_eq!(
                pair[1].previous_change_sha256.as_deref(),
                Some(pair[0].change_sha256.as_str())
            );
        }

        // The audit chain gained this commit and the two discarded
        // transactions (the replaced preview and the discarded one).
        let (trail, _) = audit_trail(&client).await;
        assert_eq!(
            count(&trail, "transaction_commit") - count(&audited, "transaction_commit"),
            1
        );
        assert_eq!(
            count(&trail, "transaction_abort") - count(&audited, "transaction_abort"),
            2
        );
        // Audit sequences only increase (they are not contiguous); the chain
        // links each record to the one before it by digest.
        for pair in trail.windows(2) {
            assert!(pair[1].sequence > pair[0].sequence);
            assert_eq!(
                pair[1].previous_audit_sha256.as_deref(),
                Some(pair[0].audit_sha256.as_str())
            );
        }
        client.close().await.expect("close");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn exports_and_backups_round_trip_through_the_native_process() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection");

        // A query exports as a verified Parquet file the native process holds.
        let at = now_unix_ms().expect("clock");
        let export = client
            .export_query(RrdQueryExportRequest {
                query: format!(
                    "FROM record:document AT VALID {at} KNOWN HEAD PROJECT id, title LIMIT 50"
                ),
            })
            .await
            .expect("Parquet export");
        assert_eq!(export.rows, DOCUMENTS as u64);
        assert_eq!(export.artifact.media_type, "application/vnd.apache.parquet");
        assert!(export.artifact.file_name.ends_with(".parquet"));
        let held = client
            .artifacts
            .get(&export.artifact.handle)
            .expect("the export is held");
        let directory =
            std::env::temp_dir().join(format!("connectome-export-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&directory).expect("export directory");
        let path = directory.join(&export.artifact.file_name);
        let saved = write_artifact(&path, &held.sha256, &held.bytes).expect("save");
        let file = std::fs::read(&path).expect("saved file");
        assert!(file.starts_with(b"PAR1") && file.ends_with(b"PAR1"));
        assert_eq!(saved.sha256, export.artifact.sha256);
        assert_eq!(file.len() as u64, export.artifact.bytes);
        std::fs::remove_dir_all(&directory).expect("remove export directory");

        // An audit page exports as JSON lines with its chain coordinates.
        let audit = client
            .export_audit(RrdAuditExportRequest {
                after_sequence: 0,
                limit: 16,
            })
            .await
            .expect("audit export");
        assert_eq!(audit.record_count, 16);
        let lines = client
            .artifacts
            .get(&audit.artifact.handle)
            .expect("the audit export is held");
        let text = String::from_utf8(lines.bytes.to_vec()).expect("JSON lines");
        assert_eq!(text.lines().count(), 16);
        assert!(audit.chain_head_sha256.is_some());

        // A backup is catalogued, verified, and restored into its own root.
        let head = client
            .changes(RrdChangesRequest {
                after_cursor: 0,
                limit: 1,
            })
            .await
            .expect("changefeed head")
            .head_cursor;
        let created = client
            .create_backup(RrdBackupCreateRequest {
                label: "before-change".into(),
            })
            .await
            .expect("backup");
        assert!(created.backup.application_complete);
        assert_eq!(created.backup.archive.runtime_cursor, head);
        let catalogue = client
            .backups(RrdBackupsRequest {
                verify_archives: true,
            })
            .await
            .expect("verified catalogue");
        assert!(catalogue.archives_verified);
        assert!(catalogue
            .backups
            .iter()
            .any(|backup| backup.backup_sha256 == created.backup.backup_sha256));
        let restored = client
            .restore_backup(RrdBackupRestoreRequest {
                backup_sha256: created.backup.backup_sha256.clone(),
            })
            .await
            .expect("restore");
        assert_eq!(
            restored.restore_id,
            format!("restore-{}", &created.backup.backup_sha256[..16])
        );
        assert_eq!(
            restored.inventory.archive_sha256,
            created.backup.archive.archive_sha256
        );
        assert_eq!(restored.inventory.runtime_cursor, head);
        assert!(restored.reopened);
        let again = client
            .restore_backup(RrdBackupRestoreRequest {
                backup_sha256: created.backup.backup_sha256.clone(),
            })
            .await
            .expect("restoring the same backup again");
        assert_eq!(again.restore_id, restored.restore_id);
        assert!(
            again.idempotent_replay,
            "the staged root is verified, not staged twice"
        );

        // The engine refuses a backup it never catalogued; the native layer
        // refuses a label the contract could never accept.
        client
            .restore_backup(RrdBackupRestoreRequest {
                backup_sha256: "f".repeat(64),
            })
            .await
            .expect_err("an uncatalogued backup");
        client
            .create_backup(RrdBackupCreateRequest {
                label: "not a label".into(),
            })
            .await
            .expect_err("an invalid label");
        client.close().await.expect("close");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn effects_fail_closed_across_an_engine_restart() {
    let mut estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
    });
    let (before, pending, backup, last_change, audit_head) =
        tauri::async_runtime::block_on(async {
            let before = NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection before the restart");
            let pending = before
                .preview_change(document_change("lost"))
                .await
                .expect("a change left pending");
            let backup = before
                .create_backup(RrdBackupCreateRequest {
                    label: "before-restart".into(),
                })
                .await
                .expect("backup")
                .backup
                .backup_sha256;
            let head = before
                .changes(RrdChangesRequest {
                    after_cursor: 0,
                    limit: 1,
                })
                .await
                .expect("head")
                .head_cursor;
            let last_change = before
                .changes(RrdChangesRequest {
                    after_cursor: head - 1,
                    limit: 1,
                })
                .await
                .expect("the last change")
                .changes
                .remove(0);
            let (trail, audit_head) = audit_trail(&before).await;
            assert!(!trail.is_empty());
            (before, pending, backup, last_change, audit_head)
        });

    estate.restart();
    tauri::async_runtime::block_on(async {
        // The old connection's endpoint is gone: its pending change cannot be
        // committed and its reads fail rather than reach another process.
        before
            .commit_change(RrdChangeCommitRequest {
                handle: pending.handle.clone(),
                operation_sha256: pending.operation_sha256.clone(),
            })
            .await
            .expect_err("a commit to the stopped engine");
        before
            .changes(RrdChangesRequest {
                after_cursor: 0,
                limit: 1,
            })
            .await
            .expect_err("a read from the stopped engine");

        let after = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection after the restart");
        assert!(
            !has(&documents(&after).await, "lost"),
            "the uncommitted change never landed"
        );
        let catalogue = after
            .backups(RrdBackupsRequest {
                verify_archives: true,
            })
            .await
            .expect("catalogue after the restart");
        assert!(catalogue
            .backups
            .iter()
            .any(|entry| entry.backup_sha256 == backup));

        // History continues: the last change before the restart is the same
        // change after it, and the audit chain resumes from its old head.
        let resumed = after
            .changes(RrdChangesRequest {
                after_cursor: last_change.cursor - 1,
                limit: 1,
            })
            .await
            .expect("history after the restart");
        assert_eq!(resumed.changes[0].change_sha256, last_change.change_sha256);
        let (trail, _) = audit_trail(&after).await;
        let resumed_from = trail
            .iter()
            .position(|record| Some(&record.audit_sha256) == audit_head.as_ref())
            .expect("the old audit head is still in the chain");
        assert!(
            trail.len() > resumed_from + 1,
            "the restarted engine audits into the same chain"
        );
        for pair in trail.windows(2) {
            assert_eq!(
                pair[1].previous_audit_sha256.as_deref(),
                Some(pair[0].audit_sha256.as_str())
            );
        }

        // And a change previewed after the restart commits.
        let change = after
            .preview_change(document_change("after"))
            .await
            .expect("preview after the restart");
        after
            .commit_change(RrdChangeCommitRequest {
                handle: change.handle,
                operation_sha256: change.operation_sha256,
            })
            .await
            .expect("commit after the restart");
        assert!(has(&documents(&after).await, "after"));
        after.close().await.expect("close");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn the_engine_and_the_native_layer_refuse_what_they_must() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;

        // The engine refuses a credential it never issued.
        let directory =
            std::env::temp_dir().join(format!("connectome-forged-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&directory).expect("forged credential directory");
        let installed: Value = serde_json::from_slice(
            &std::fs::read(&estate.served.view.credential_path).expect("installed credential"),
        )
        .expect("credential JSON");
        let mut forged = installed.clone();
        forged["credential"] = json!("not-the-issued-credential");
        let forged_path = directory.join("local-operator.json");
        std::fs::write(&forged_path, serde_json::to_vec(&forged).expect("JSON"))
            .expect("write forged credential");
        let mut request = estate.connect_request();
        request.credential_path = forged_path.to_string_lossy().into_owned();
        assert!(
            NativeRrdClient::connect(request).await.is_err(),
            "a forged credential opens no session"
        );
        std::fs::remove_dir_all(&directory).expect("remove forged credential");

        // A change the strict kind refuses never lands, and its transaction is
        // released: the next preview is not over the one-transaction quota.
        let sessions = RrdClientState::default();
        sessions
            .connect("project-a".into(), estate.connect_request())
            .await
            .expect("first connection");
        sessions
            .connect("project-b".into(), estate.connect_request())
            .await
            .expect("second connection");
        let a = sessions.client("project-a").await.expect("a");
        let b = sessions.client("project-b").await.expect("b");
        let mut invalid = document_change("untitled");
        let TransactionMutation::PutRecord { properties, .. } = &mut invalid.mutations[0] else {
            unreachable!("a put_record change");
        };
        properties.remove("title");
        // The engine's preview does not check a strict kind's required
        // properties; the commit is where the kind refuses the record.
        let untitled = a
            .preview_change(invalid)
            .await
            .expect("the preview does not check required properties");
        let refused = a
            .commit_change(RrdChangeCommitRequest {
                handle: untitled.handle.clone(),
                operation_sha256: untitled.operation_sha256.clone(),
            })
            .await
            .expect_err("the strict kind requires a title");
        assert!(!refused.retryable, "{refused}");
        a.commit_change(RrdChangeCommitRequest {
            handle: untitled.handle,
            operation_sha256: untitled.operation_sha256,
        })
        .await
        .expect_err("a refused change is no longer pending");
        assert!(!has(&documents(&a).await, "untitled"));

        // A handle names a change on its own connection only.
        let change = a
            .preview_change(document_change("owned"))
            .await
            .expect("preview after a refused one");
        let foreign = RrdChangeCommitRequest {
            handle: change.handle.clone(),
            operation_sha256: change.operation_sha256.clone(),
        };
        b.commit_change(foreign)
            .await
            .expect_err("another connection's handle");
        b.discard_change(&change.handle)
            .await
            .expect_err("another connection's handle");
        a.commit_change(RrdChangeCommitRequest {
            handle: change.handle,
            operation_sha256: change.operation_sha256,
        })
        .await
        .expect("the owning connection commits");
        assert!(has(&documents(&b).await, "owned"));

        // A closed session ends its pending change and refuses new ones.
        let left = b
            .preview_change(document_change("left"))
            .await
            .expect("preview left pending");
        sessions
            .disconnect("project-b")
            .await
            .expect("disconnect b");
        let closed = b
            .commit_change(RrdChangeCommitRequest {
                handle: left.handle,
                operation_sha256: left.operation_sha256,
            })
            .await
            .expect_err("the session closed");
        assert!(closed.message.contains("no longer pending"), "{closed}");
        b.preview_change(document_change("late"))
            .await
            .expect_err("a closed session previews nothing");
        assert!(!has(&documents(&a).await, "left"));
        sessions
            .disconnect("project-a")
            .await
            .expect("disconnect a");
    });
}
