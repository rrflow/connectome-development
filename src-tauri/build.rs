use std::path::Path;

/// Embeds the staged engine sidecar's manifest (`binaries/engine.json`,
/// written by `scripts/engine/build-sidecar.mjs`) so the desktop launches the
/// bundled `rrflow` only when the file still hashes to the digest this build
/// was made with. A build without a staged engine embeds nothing and refuses
/// to run a sidecar; the manifest's revision must be the one `Cargo.lock`
/// pins, or the build fails.
fn embed_engine_manifest() {
    println!("cargo:rerun-if-changed=binaries/engine.json");
    println!("cargo:rerun-if-changed=Cargo.lock");
    let manifest = Path::new("binaries/engine.json");
    if !manifest.is_file() {
        return;
    }
    let text = std::fs::read_to_string(manifest).expect("read binaries/engine.json");
    let manifest: serde_json::Value =
        serde_json::from_str(&text).expect("binaries/engine.json is JSON");
    let revision = manifest["revision"]
        .as_str()
        .expect("engine manifest names its revision");
    let sha256 = manifest["sha256"]
        .as_str()
        .expect("engine manifest names its sha256");
    assert!(
        sha256.len() == 64 && sha256.bytes().all(|byte| byte.is_ascii_hexdigit()),
        "engine manifest sha256 is not hex SHA-256"
    );
    let lock = std::fs::read_to_string("Cargo.lock").expect("read Cargo.lock");
    let pinned = lock
        .split("rrflow-development?rev=")
        .skip(1)
        .map(|rest| &rest[..40])
        .next()
        .expect("Cargo.lock pins an RRFlow revision");
    assert_eq!(
        revision, pinned,
        "the staged engine sidecar was built from {revision}, not the pinned {pinned}; restage it"
    );
    println!("cargo:rustc-env=RRFLOW_SIDECAR_SHA256={sha256}");
    println!("cargo:rustc-env=RRFLOW_SIDECAR_REVISION={revision}");
}

fn main() {
    tauri_build::build();
    embed_engine_manifest();

    // The preview flag chooses the application's data directory
    // (`paths::get_data_directory`), so a change to it must rerun this script;
    // otherwise a preview build silently keeps the release data directory.
    println!("cargo:rerun-if-env-changed=VITE_CONNECTOME_PREVIEW");
    if std::env::var("VITE_CONNECTOME_PREVIEW").is_err() {
        println!("cargo:rustc-env=VITE_CONNECTOME_PREVIEW=false");
    }
}
