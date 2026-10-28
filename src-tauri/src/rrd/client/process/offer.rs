//! The golden offer behind Connectome's view registry (`src/rrflow/views.ts`):
//! what one installed instance of the pinned engine serves, read through its
//! public capability and catalogue operations.
//!
//! `src/rrflow/fixtures/engine-offer.json` must equal what this engine
//! returns: every operation in its catalogue, and every capability it declares
//! with its status and stated limitation. Set `CONNECTOME_WRITE_GOLDEN=1` to
//! rewrite it after the engine pin moves, then format it with `pnpm qa`.

use super::*;

const GOLDEN: &str = "../src/rrflow/fixtures/engine-offer.json";

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn the_view_registry_golden_matches_the_engine() {
    let estate = Estate::install_and_serve();
    let golden = tauri::async_runtime::block_on(async {
        let client = RrdClient::connect_local(
            estate.address,
            CanonicalId::new(&estate.instance).expect("instance"),
            ClientConfig::default(),
        )
        .expect("public client");
        let capabilities = client.capabilities().await.expect("capabilities");
        let catalogue = client.endpoint_catalogue().await.expect("catalogue");
        let mut operations: Vec<String> = catalogue
            .endpoints
            .iter()
            .map(|endpoint| endpoint.operation.as_str().to_owned())
            .collect();
        operations.sort();
        let mut websocket: Vec<String> = catalogue
            .websocket_endpoints
            .iter()
            .map(|endpoint| endpoint.operation.as_str().to_owned())
            .collect();
        websocket.sort();
        let declared: Vec<Value> = capabilities
            .capabilities
            .iter()
            .map(|capability| {
                json!({
                    "name": capability.name.as_str(),
                    "status": capability.status,
                    "limitation": capability.limitation,
                })
            })
            .collect();
        json!({
            "engine": pinned_revision(),
            "operations": operations,
            "websocket_operations": websocket,
            "capabilities": declared,
        })
    });

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(GOLDEN);
    if std::env::var_os("CONNECTOME_WRITE_GOLDEN").is_some() {
        let mut text = serde_json::to_string_pretty(&golden).expect("golden JSON");
        text.push('\n');
        std::fs::write(&path, text).expect("write the golden offer");
        return;
    }
    let checked_in: Value =
        serde_json::from_slice(&std::fs::read(&path).expect("the golden offer is checked in"))
            .expect("golden JSON");
    assert_eq!(
        checked_in, golden,
        "src/rrflow/fixtures/engine-offer.json differs from what this engine offers"
    );
}
