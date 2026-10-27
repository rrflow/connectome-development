//! Export artifacts: a query's Parquet file and an audit page's JSON lines.
//!
//! The SDK verifies each artifact's framing and digest. The bytes stay in this
//! process under an opaque handle until the operator saves them through the
//! native save dialog, so the webview never carries the file and never names
//! where it is written.

use super::history::audit_page;
use super::*;
use crate::rrd::view::effect::{
    self, ArtifactView, AuditExportView, QueryExportView, SavedArtifactView,
};
use rrd_contract::{ExportAudit, ExportQuery, MAX_PARQUET_EXPORT_BYTES};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::io::Write;
use std::path::PathBuf;

/// Artifacts held at once per connection; the oldest is released first.
const MAX_HELD_ARTIFACTS: usize = 4;
const NO_ARTIFACT: &str = "this export is no longer held; export it again";

#[derive(Clone)]
pub(super) struct HeldArtifact {
    handle: String,
    pub(super) file_name: String,
    pub(super) sha256: String,
    pub(super) bytes: Arc<Vec<u8>>,
}

/// The verified exports one connection holds, newest last.
#[derive(Default)]
pub(super) struct Artifacts(std::sync::Mutex<VecDeque<HeldArtifact>>);

impl Artifacts {
    fn hold(
        &self,
        file_name: String,
        media_type: &str,
        sha256: String,
        bytes: Vec<u8>,
    ) -> ArtifactView {
        let handle = format!("artifact-{}", Uuid::new_v4().simple());
        let view = ArtifactView {
            handle: handle.clone(),
            media_type: media_type.into(),
            file_name: file_name.clone(),
            bytes: bytes.len() as u64,
            sha256: sha256.clone(),
        };
        let mut held = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        while held.len() >= MAX_HELD_ARTIFACTS {
            held.pop_front();
        }
        held.push_back(HeldArtifact {
            handle,
            file_name,
            sha256,
            bytes: Arc::new(bytes),
        });
        view
    }

    pub(super) fn clear(&self) {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clear();
    }

    pub(super) fn get(&self, handle: &str) -> Result<HeldArtifact, RrdError> {
        let held = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        held.iter()
            .find(|artifact| artifact.handle == handle)
            .cloned()
            .ok_or_else(|| NO_ARTIFACT.into())
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdQueryExportRequest {
    pub query: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdAuditExportRequest {
    pub after_sequence: u64,
    pub limit: u16,
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Writes `bytes` to `path` whole or not at all: into a sibling file first,
/// then renamed over the destination once flushed.
pub(super) fn write_artifact(
    path: &Path,
    sha256: &str,
    bytes: &[u8],
) -> Result<SavedArtifactView, RrdError> {
    if sha256_hex(bytes) != sha256 {
        return Err("the held export no longer matches its digest".into());
    }
    let name = path
        .file_name()
        .ok_or("the save destination names no file")?
        .to_string_lossy()
        .into_owned();
    let partial = path.with_file_name(format!(".{name}.connectome-partial"));
    let written = (|| {
        let mut file = std::fs::File::create(&partial)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&partial, path)
    })();
    if let Err(error) = written {
        let _ = std::fs::remove_file(&partial);
        return Err(format!("cannot save the export: {error}").into());
    }
    Ok(SavedArtifactView {
        path: path.to_string_lossy().into_owned(),
        bytes: bytes.len() as u64,
        sha256: sha256.into(),
    })
}

impl NativeRrdClient {
    /// Runs `request.query` as a Parquet export within the estate's query
    /// budget and holds the verified file.
    pub async fn export_query(
        &self,
        request: RrdQueryExportRequest,
    ) -> Result<QueryExportView, RrdError> {
        let query = execute_query(&request.query, self.scope(), &self.query_budget)?;
        let export = ExportQuery {
            max_output_bytes: (MAX_PARQUET_EXPORT_BYTES as u64).min(query.budget.max_output_bytes),
            query,
        };
        let exported = self
            .send(false, |session, options| async move {
                self.client.export_query(&session, export, options).await
            })
            .await?;
        let bytes = exported
            .decode_artifact()
            .map_err(|error| error.to_string())?;
        let artifact = self.artifacts.hold(
            format!("rrflow-query-{}.parquet", exported.source.known_at_cursor),
            &exported.media_type,
            exported.artifact_sha256.clone(),
            bytes,
        );
        Ok(effect::query_export(artifact, &exported))
    }

    /// Exports one audit page as JSON lines and holds the verified file.
    pub async fn export_audit(
        &self,
        request: RrdAuditExportRequest,
    ) -> Result<AuditExportView, RrdError> {
        let page = audit_page(request.after_sequence, request.limit)?;
        let export = ExportAudit {
            after_sequence: page.after_sequence,
            limit: page.limit,
        };
        let exported = self
            .send(false, |session, options| async move {
                self.client.export_audit(&session, export, options).await
            })
            .await?;
        let bytes = exported.json_lines.clone().into_bytes();
        if sha256_hex(&bytes) != exported.content_sha256 {
            return Err("the audit export does not match its digest".into());
        }
        let artifact = self.artifacts.hold(
            format!(
                "rrflow-audit-{}-{}.jsonl",
                exported.requested_after_sequence + 1,
                exported.through_sequence
            ),
            &exported.media_type,
            exported.content_sha256.clone(),
            bytes,
        );
        Ok(effect::audit_export(artifact, &exported))
    }
}

/// Saves the held artifact `handle` names where the operator chooses in the
/// native save dialog; `None` when the operator cancels.
pub async fn save_artifact<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    client: &NativeRrdClient,
    handle: &str,
) -> Result<Option<SavedArtifactView>, RrdError> {
    use tauri_plugin_dialog::DialogExt;
    let artifact = client.artifacts.get(handle)?;
    let (chosen, picked) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&artifact.file_name)
        .save_file(move |path| {
            let _ = chosen.send(path);
        });
    let Some(path) = picked.await.ok().flatten() else {
        return Ok(None);
    };
    let path: PathBuf = path
        .into_path()
        .map_err(|error| format!("the save destination is not a file path: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || {
        write_artifact(&path, &artifact.sha256, &artifact.bytes)
    })
    .await
    .map_err(|error| format!("the save task failed: {error}"))?
    .map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "connectome-artifact-{name}-{}",
            Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&directory).expect("scratch directory");
        directory
    }

    #[test]
    fn held_artifacts_are_bounded_and_released_oldest_first() {
        let artifacts = Artifacts::default();
        let views: Vec<_> = (0..MAX_HELD_ARTIFACTS + 1)
            .map(|index| {
                let bytes = vec![index as u8; 4];
                artifacts.hold(
                    format!("file-{index}"),
                    "application/octet-stream",
                    sha256_hex(&bytes),
                    bytes,
                )
            })
            .collect();
        assert!(
            artifacts.get(&views[0].handle).is_err(),
            "the oldest is released"
        );
        for view in &views[1..] {
            let held = artifacts.get(&view.handle).expect("held");
            assert_eq!(held.sha256, view.sha256);
            assert_eq!(held.file_name, view.file_name);
            assert_eq!(held.bytes.len() as u64, view.bytes);
        }
        assert!(artifacts.get("artifact-unknown").is_err());
    }

    #[test]
    fn an_artifact_is_written_whole_and_only_with_its_digest() {
        let directory = scratch("write");
        let path = directory.join("export.parquet");
        let bytes = b"PAR1-fixture-PAR1".to_vec();
        let digest = sha256_hex(&bytes);
        std::fs::write(&path, b"older file").expect("existing file");
        let saved = write_artifact(&path, &digest, &bytes).expect("saved");
        assert_eq!(std::fs::read(&path).expect("read back"), bytes);
        assert_eq!(saved.sha256, digest);
        assert_eq!(saved.bytes, bytes.len() as u64);
        assert!(write_artifact(&path, &"0".repeat(64), &bytes).is_err());
        assert_eq!(
            std::fs::read(&path).expect("unchanged"),
            bytes,
            "a refused write leaves the saved file as it was"
        );
        let leftovers = std::fs::read_dir(&directory)
            .expect("list")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with("partial"))
            .count();
        assert_eq!(leftovers, 0);
        std::fs::remove_dir_all(directory).expect("remove scratch");
    }
}
