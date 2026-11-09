//! Estate backups: the catalogue, a new backup, and a verified restore.
//!
//! A restore stages the backup into its own root beside the estate and
//! verifies it; the serving estate is not replaced. Each backup has one
//! restore identity, derived from its digest, so restoring it again (or
//! retrying a restore whose reply was lost) re-verifies the root already
//! staged instead of staging another copy.

use super::*;
use crate::rrd::view::effect::{self, BackupCreatedView, BackupsView, RestoreView};
use rrd_contract::{CreateInstanceBackup, ListInstanceBackups, RestoreInstanceBackup};

const MAX_BACKUP_LABEL_BYTES: usize = 96;
/// Digest characters that name a backup's restore root.
const RESTORE_ID_DIGEST_CHARS: usize = 16;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdBackupsRequest {
    /// Ask the engine to re-verify every archive for this read.
    #[serde(default)]
    pub verify_archives: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdBackupCreateRequest {
    pub label: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdBackupRestoreRequest {
    pub backup_sha256: String,
}

fn backup_label(label: &str) -> Result<String, RrdError> {
    let valid = !label.is_empty()
        && label.len() <= MAX_BACKUP_LABEL_BYTES
        && label
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
    if !valid {
        return Err(format!(
            "a backup label is 1..={MAX_BACKUP_LABEL_BYTES} ASCII letters, digits, '.', '-' or '_'"
        )
        .into());
    }
    Ok(label.to_owned())
}

/// The one restore identity of the backup `backup_sha256` names.
fn restore_id(backup_sha256: &str) -> Result<CanonicalId, RrdError> {
    let digest = backup_sha256.len() == 64
        && backup_sha256
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
    if !digest {
        return Err("a backup is named by its lowercase SHA-256 digest".into());
    }
    Ok(canonical(
        &format!("restore-{}", &backup_sha256[..RESTORE_ID_DIGEST_CHARS]),
        "restore",
    )?)
}

impl NativeRrdClient {
    pub async fn backups(&self, request: RrdBackupsRequest) -> Result<BackupsView, RrdError> {
        let list = ListInstanceBackups {
            verify_archives: request.verify_archives,
        };
        let catalogue = self
            .send(false, |session, options| async move {
                self.client.list_backups(&session, list, options).await
            })
            .await?;
        Ok(effect::backups(&catalogue))
    }

    pub async fn create_backup(
        &self,
        request: RrdBackupCreateRequest,
    ) -> Result<BackupCreatedView, RrdError> {
        let create = CreateInstanceBackup {
            label: backup_label(&request.label)?,
            created_at_unix_ms: now_unix_ms()?,
        };
        let created = self
            .send(true, |session, options| async move {
                self.client.create_backup(&session, create, options).await
            })
            .await?;
        Ok(effect::backup_created(&created))
    }

    pub async fn restore_backup(
        &self,
        request: RrdBackupRestoreRequest,
    ) -> Result<RestoreView, RrdError> {
        let restore = RestoreInstanceBackup {
            restore_id: restore_id(&request.backup_sha256)?,
            backup_sha256: request.backup_sha256,
            restored_at_unix_ms: now_unix_ms()?,
        };
        let restored = self
            .send(true, |session, options| async move {
                self.client.restore_backup(&session, restore, options).await
            })
            .await?;
        Ok(effect::restore(&restored))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_labels_and_restore_identities_fail_closed() {
        assert!(backup_label("before-import.2026").is_ok());
        assert!(backup_label("").is_err());
        assert!(backup_label("with space").is_err());
        assert!(backup_label(&"a".repeat(MAX_BACKUP_LABEL_BYTES + 1)).is_err());
        let digest = "ab".repeat(32);
        let id = restore_id(&digest).expect("restore id");
        assert_eq!(id.as_str(), "restore-abababababababab");
        assert_eq!(restore_id(&digest).expect("stable"), id);
        assert!(restore_id(&"AB".repeat(32)).is_err());
        assert!(restore_id("abc").is_err());
    }
}
