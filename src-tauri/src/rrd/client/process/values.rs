//! The golden values behind Connectome's value model
//! (`src/rrflow/model.ts`): one record holding every kind of value the
//! contract has, written to and read back from a real RRD process, with the
//! display the native views render for each value.
//!
//! `src/rrflow/fixtures/engine-values.json` must equal what this engine
//! returns. Set `CONNECTOME_WRITE_GOLDEN=1` to rewrite it after the engine pin
//! moves, then format it with `pnpm qa`.

use super::*;
use rrd_contract::QueryValue;
use std::collections::BTreeMap;

const GOLDEN: &str = "../src/rrflow/fixtures/engine-values.json";

/// Every value kind, with the edges the webview must handle: integers past
/// what a JavaScript number holds exactly, text past the display bound, and
/// map keys whose byte order differs from JavaScript's own key order.
fn samples() -> BTreeMap<String, QueryValue> {
    let digest = "0123456789abcdef".repeat(4);
    BTreeMap::from([
        ("a_null".into(), QueryValue::Null),
        ("b_bool".into(), QueryValue::Bool(true)),
        (
            "c_integer".into(),
            QueryValue::Integer(-9_007_199_254_740_991),
        ),
        (
            "d_integer_beyond_exact".into(),
            QueryValue::Integer(i64::MIN),
        ),
        ("e_unsigned".into(), QueryValue::Unsigned(17)),
        (
            "f_unsigned_beyond_exact".into(),
            QueryValue::Unsigned(u64::MAX),
        ),
        ("g_decimal".into(), QueryValue::Decimal("12.50".into())),
        (
            "h_string".into(),
            QueryValue::String("Connectome — ünïcødé ✓".into()),
        ),
        ("i_string_long".into(), QueryValue::String("é".repeat(1100))),
        ("j_digest".into(), QueryValue::Digest(digest)),
        (
            "k_list".into(),
            QueryValue::List(vec![
                QueryValue::String("a".into()),
                QueryValue::Integer(2),
                QueryValue::List(vec![QueryValue::Bool(false)]),
            ]),
        ),
        (
            "l_map".into(),
            QueryValue::Map(BTreeMap::from([
                ("10".into(), QueryValue::Unsigned(1)),
                ("2".into(), QueryValue::Unsigned(2)),
                ("B".into(), QueryValue::Null),
                ("a".into(), QueryValue::String("x".into())),
            ])),
        ),
    ])
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn the_value_model_golden_matches_the_engine() {
    let estate = Estate::install_and_serve();
    let golden = tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection");
        let current = client.schema().await.expect("schema").schema;
        let mut registry = current
            .map(|registry| serde_json::to_value(registry).expect("registry"))
            .expect("an installed registry");
        registry["revision"] = json!(registry["revision"].as_u64().expect("revision") + 1);
        registry["migration"] = json!("Connectome value model golden");
        registry["tables"]["sample"] = json!({ "model": "relational", "mode": "strict" });
        registry["records"]["sample"] = json!({
            "properties": {},
            "allow_additional_properties": true,
            "unique_properties": []
        });
        for change in [
            json!([{ "mutation": "put_schema", "registry": registry }]),
            json!([{
                "mutation": "put_record",
                "reference": { "kind": "sample", "id": "every" },
                "valid_from": 1,
                "properties": samples(),
            }]),
        ] {
            let preview = client
                .preview_change(
                    serde_json::from_value(json!({ "mutations": change })).expect("a change"),
                )
                .await
                .expect("preview");
            client
                .commit_change(
                    serde_json::from_value(json!({
                        "handle": preview.handle,
                        "operation_sha256": preview.operation_sha256,
                    }))
                    .expect("a commit"),
                )
                .await
                .expect("commit");
        }

        let query = execute_query(
            "FROM record:sample AT VALID 100 KNOWN HEAD PROJECT *",
            client.scope(),
            &client.query_budget,
        )
        .expect("query");
        let result = client
            .send(false, |session, options| {
                let client = &client;
                async move { client.client.execute_query(&session, query, options).await }
            })
            .await
            .expect("read back");
        assert_eq!(result.rows.len(), 1);
        let values = &result.rows[0].values;
        let samples = samples();
        let entries: Vec<Value> = samples
            .iter()
            .map(|(name, written)| {
                let read = values
                    .get(name)
                    .unwrap_or_else(|| panic!("{name} is read back"));
                assert_eq!(read, written, "{name} round-trips through the engine");
                json!({
                    "name": name,
                    "value": read,
                    "display": view::display_value(read),
                })
            })
            .collect();
        client.close().await.expect("close");
        json!({
            "engine": pinned_revision(),
            "values": entries,
        })
    });

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(GOLDEN);
    if std::env::var_os("CONNECTOME_WRITE_GOLDEN").is_some() {
        let mut text = serde_json::to_string_pretty(&golden).expect("golden JSON");
        text.push('\n');
        std::fs::write(&path, text).expect("write the golden values");
        return;
    }
    let checked_in: Value =
        serde_json::from_slice(&std::fs::read(&path).expect("the golden values are checked in"))
            .expect("golden JSON");
    assert_eq!(
        checked_in, golden,
        "src/rrflow/fixtures/engine-values.json differs from what this engine returns"
    );
}
