//! Which `rrflow` executable the desktop runs, and the proof that it is the
//! one this build was contracted to.
//!
//! Three sources, in order: an explicit executable the operator configured;
//! the engine bundled beside the application as a Tauri sidecar, which runs
//! only when the file still hashes to the SHA-256 embedded at build time from
//! `binaries/engine.json` (itself written for the revision `Cargo.lock` pins);
//! and, last, an `rrflow` on `PATH`. A sidecar that does not match its digest
//! is refused outright — nothing falls back past a tampered or stale engine.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::ffi::OsStr;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use super::error::RrdError;

/// The sidecar's file name beside the application executable, as Tauri
/// installs `bundle.externalBin` entries.
const SIDECAR_NAME: &str = "rrflow";

/// The SHA-256 of the staged sidecar, embedded by `build.rs` when the engine
/// manifest was present; `None` in a build made without a staged engine.
const SIDECAR_SHA256: Option<&str> = option_env!("RRFLOW_SIDECAR_SHA256");
/// The RRFlow revision the staged sidecar was built from.
const SIDECAR_REVISION: Option<&str> = option_env!("RRFLOW_SIDECAR_REVISION");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineSource {
    /// The executable the operator configured in the serving settings.
    Override,
    /// The engine bundled with this build, verified against its digest.
    Sidecar,
    /// An `rrflow` found on `PATH`.
    Path,
}

/// The engine the desktop will run: where it is, how it was chosen, what it
/// hashes to, and — for the sidecar — the revision it was built from.
#[derive(Debug, Clone, Serialize)]
pub struct EngineBinding {
    pub path: PathBuf,
    pub source: EngineSource,
    pub sha256: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
}

/// Resolves the engine for this process: the configured override, else the
/// verified sidecar beside the running executable, else `PATH`.
pub fn resolve_engine(configured: &str) -> Result<EngineBinding, RrdError> {
    let sidecar_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf));
    resolve_engine_with(
        configured,
        sidecar_dir.as_deref(),
        SIDECAR_SHA256,
        SIDECAR_REVISION,
        std::env::var_os("PATH").as_deref(),
    )
}

/// The resolution with every input explicit, so tests can drive it.
pub fn resolve_engine_with(
    configured: &str,
    sidecar_dir: Option<&Path>,
    sidecar_sha256: Option<&str>,
    sidecar_revision: Option<&str>,
    path: Option<&OsStr>,
) -> Result<EngineBinding, RrdError> {
    let configured = configured.trim();
    if !configured.is_empty() {
        let path = PathBuf::from(configured);
        if !path.is_absolute() {
            return Err("the configured rrflow executable must be an absolute path".into());
        }
        let path = std::fs::canonicalize(&path)
            .map_err(|error| format!("the configured rrflow executable is unreadable: {error}"))?;
        if !path.is_file() {
            return Err("the configured rrflow executable is not a file".into());
        }
        return Ok(EngineBinding {
            sha256: sha256_file(&path)?,
            path,
            source: EngineSource::Override,
            revision: None,
        });
    }

    if let Some(directory) = sidecar_dir {
        let sidecar = directory.join(format!("{SIDECAR_NAME}{}", std::env::consts::EXE_SUFFIX));
        if sidecar.is_file() {
            let Some(expected) = sidecar_sha256 else {
                return Err(
                    "an rrflow sidecar is present but this build carries no engine manifest, so it cannot be verified; restage the engine and rebuild"
                        .into(),
                );
            };
            let actual = sha256_file(&sidecar)?;
            if actual != expected {
                return Err(format!(
                    "the bundled rrflow engine does not match this build's manifest (expected sha256 {expected}, found {actual}); it will not be run"
                )
                .into());
            }
            return Ok(EngineBinding {
                path: sidecar,
                source: EngineSource::Sidecar,
                sha256: actual,
                revision: sidecar_revision.map(str::to_owned),
            });
        }
    }

    let name = format!("{SIDECAR_NAME}{}", std::env::consts::EXE_SUFFIX);
    let found = path
        .map(|path| {
            std::env::split_paths(path)
                .map(|dir| dir.join(&name))
                .find(|p| p.is_file())
        })
        .unwrap_or(None);
    match found {
        Some(path) => Ok(EngineBinding {
            sha256: sha256_file(&path)?,
            path,
            source: EngineSource::Path,
            revision: None,
        }),
        None => Err(
            "no rrflow engine is available: this build has no bundled engine, no executable is configured in Settings → Serving, and none is on PATH"
                .into(),
        ),
    }
}

fn sha256_file(path: &Path) -> Result<String, RrdError> {
    let mut file =
        File::open(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh directory per test under the system temporary directory,
    /// removed on drop; the crate keeps no temporary-directory dependency.
    struct Scratch(PathBuf);

    impl Scratch {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "connectome-engine-{label}-{}",
                uuid::Uuid::new_v4().simple()
            ));
            std::fs::create_dir_all(&path).expect("create scratch directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn engine_file(directory: &Path, name: &str, contents: &[u8]) -> PathBuf {
        let path = directory.join(format!("{name}{}", std::env::consts::EXE_SUFFIX));
        std::fs::write(&path, contents).expect("write engine fixture");
        path
    }

    fn digest(contents: &[u8]) -> String {
        Sha256::digest(contents)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    #[test]
    fn the_configured_executable_wins_and_reports_its_digest() {
        let temporary = Scratch::new("case");
        let configured = engine_file(temporary.path(), "custom", b"configured engine");
        let sidecar_dir = temporary.path().join("app");
        std::fs::create_dir(&sidecar_dir).unwrap();
        engine_file(&sidecar_dir, SIDECAR_NAME, b"sidecar engine");

        let binding = resolve_engine_with(
            configured.to_str().unwrap(),
            Some(&sidecar_dir),
            Some(&digest(b"sidecar engine")),
            Some("abc"),
            None,
        )
        .unwrap();

        assert_eq!(binding.source, EngineSource::Override);
        assert_eq!(binding.sha256, digest(b"configured engine"));
        assert_eq!(binding.revision, None);
    }

    #[test]
    fn the_sidecar_runs_only_when_it_hashes_to_the_embedded_digest() {
        let temporary = Scratch::new("case");
        let sidecar = engine_file(temporary.path(), SIDECAR_NAME, b"sidecar engine");
        let expected = digest(b"sidecar engine");

        let binding = resolve_engine_with(
            "",
            Some(temporary.path()),
            Some(&expected),
            Some("4705941"),
            None,
        )
        .unwrap();
        assert_eq!(binding.source, EngineSource::Sidecar);
        assert_eq!(binding.path, sidecar);
        assert_eq!(binding.sha256, expected);
        assert_eq!(binding.revision.as_deref(), Some("4705941"));

        // Tampered: refused, and no fallback to PATH even when PATH has one.
        std::fs::write(&sidecar, b"something else").unwrap();
        let on_path = temporary.path().join("bin");
        std::fs::create_dir(&on_path).unwrap();
        engine_file(&on_path, SIDECAR_NAME, b"path engine");
        let error = resolve_engine_with(
            "",
            Some(temporary.path()),
            Some(&expected),
            None,
            Some(on_path.as_os_str()),
        )
        .unwrap_err();
        assert!(
            error
                .message
                .contains("does not match this build's manifest"),
            "{}",
            error.message
        );
    }

    #[test]
    fn a_sidecar_without_an_embedded_manifest_is_refused() {
        let temporary = Scratch::new("case");
        engine_file(temporary.path(), SIDECAR_NAME, b"sidecar engine");

        let error = resolve_engine_with("", Some(temporary.path()), None, None, None).unwrap_err();

        assert!(
            error.message.contains("no engine manifest"),
            "{}",
            error.message
        );
    }

    #[test]
    fn path_is_the_last_resort_and_absence_is_an_error() {
        let temporary = Scratch::new("case");
        let empty_app = temporary.path().join("app");
        std::fs::create_dir(&empty_app).unwrap();
        let on_path = temporary.path().join("bin");
        std::fs::create_dir(&on_path).unwrap();
        let found = engine_file(&on_path, SIDECAR_NAME, b"path engine");

        let binding = resolve_engine_with(
            "",
            Some(&empty_app),
            Some(&digest(b"unused")),
            None,
            Some(on_path.as_os_str()),
        )
        .unwrap();
        assert_eq!(binding.source, EngineSource::Path);
        assert_eq!(binding.path, found);
        assert_eq!(binding.sha256, digest(b"path engine"));

        let error = resolve_engine_with("", Some(&empty_app), None, None, Some(OsStr::new("")))
            .unwrap_err();
        assert!(
            error.message.contains("no rrflow engine is available"),
            "{}",
            error.message
        );
    }
}
