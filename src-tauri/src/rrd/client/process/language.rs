//! The golden queries behind Connectome's rrflowQL language
//! (`src/rrflow/rrflowql.ts`): what the pinned engine says about RRFlow's own
//! query vectors and about a corpus of queries it accepts and refuses, asked
//! through the console's own command.
//!
//! `src/rrflow/fixtures/engine-queries.json` must equal what this engine
//! returns. Set `CONNECTOME_WRITE_GOLDEN=1` to rewrite it after the engine pin
//! moves, then format it with `pnpm qa`.

use super::*;
use rrd_contract::QueryValue;
use std::collections::BTreeMap;
use std::path::Path;

const GOLDEN: &str = "../src/rrflow/fixtures/engine-queries.json";
const SCOPE: &str = "FROM record:document AT VALID 100 KNOWN HEAD";
const TRAVERSE: &str = "FROM traverse:depends_on START document:a DIRECTION OUTGOING";

/// Queries the engine accepts, refuses while reading them, and refuses later,
/// named for what each one pins. Every lexical refusal the engine has is here,
/// some after characters wider than one UTF-16 unit.
fn corpus() -> Vec<(&'static str, String)> {
    let within = |rest: &str| format!("{SCOPE} {rest}");
    vec![
        (
            "every_clause",
            within(r#"WHERE status = "open" AND title != "x" PROJECT id, status, title LIMIT 5 EXPLAIN CONTRACT"#),
        ),
        (
            "lowercase_words",
            r#"from RECORD:document at valid 100 known head where status = "open" project *"#.into(),
        ),
        (
            "ascii_whitespace",
            "FROM\trecord:document\nAT VALID 100\r\nKNOWN HEAD\x0cPROJECT *".into(),
        ),
        ("string_escapes", within(r#"WHERE title = "a\"b\\c\n\r\t" PROJECT *"#)),
        ("unicode_string", within(r#"WHERE title = "Open — ünïcødé 𝄞" PROJECT title"#)),
        ("orderings", within(r#"WHERE title < "z" AND title <= "z" AND title > "" AND title >= "" PROJECT id"#)),
        ("scalar_literals", within("WHERE status != null AND status != true AND status != 7 PROJECT id")),
        ("text_match", within(r#"WHERE title MATCH "open" PROJECT id"#)),
        ("traversal", format!("{TRAVERSE} DEPTH 2 AT VALID 100 KNOWN HEAD PROJECT *")),
        (
            "join",
            "FROM record:document JOIN record:document ON id = id AT VALID 100 KNOWN HEAD PROJECT *".into(),
        ),
        ("known_cursor", "FROM record:document AT VALID 100 KNOWN 1 PROJECT *".into()),
        ("explain_analyze", within("PROJECT * EXPLAIN ANALYZE")),
        ("dotted_field", within("PROJECT properties.title")),
        ("unknown_kind", "FROM record:missing AT VALID 100 KNOWN HEAD PROJECT *".into()),
        ("unknown_field", within("PROJECT nope")),
        ("unterminated_string", within(r#"WHERE title = "open PROJECT *"#)),
        ("unterminated_escape", within(r#"WHERE title = "open\"#)),
        ("unsupported_escape", within(r#"WHERE title = "a\x" PROJECT *"#)),
        ("unsupported_escape_after_unicode", within(r#"WHERE title = "é𝄞\é" PROJECT *"#)),
        (
            "integer_at_u64_max",
            "FROM record:document AT VALID 18446744073709551615 KNOWN HEAD PROJECT *".into(),
        ),
        (
            "integer_beyond_u64",
            "FROM record:document AT VALID 18446744073709551616 KNOWN HEAD PROJECT *".into(),
        ),
        ("lone_bang", within(r#"WHERE title ! "a" PROJECT *"#)),
        ("lone_bang_after_unicode", within(r#"WHERE title = "é𝄞" AND status ! "a" PROJECT *"#)),
        ("misspelled_from", "FORM record:document AT VALID 100 KNOWN HEAD PROJECT *".into()),
        ("unknown_family", "FROM table:document AT VALID 100 KNOWN HEAD PROJECT *".into()),
        ("missing_colon", "FROM record document AT VALID 100 KNOWN HEAD PROJECT *".into()),
        ("missing_at", "FROM record:document PROJECT *".into()),
        ("ends_early", "FROM record:document AT VALID 100 KNOWN".into()),
        ("ends_inside_a_wide_word", "FROM é𝄞".into()),
        ("parameter_without_dollar", "FROM record:document AT VALID when KNOWN HEAD PROJECT *".into()),
        ("invalid_field", within(r#"WHERE ti-tle = "a" PROJECT *"#)),
        ("bare_word_value", within("WHERE title = open PROJECT *")),
        ("unknown_comparison", within(r#"WHERE title LIKE "a" PROJECT *"#)),
        ("duplicate_where", within(r#"WHERE title = "a" WHERE title = "b" PROJECT *"#)),
        ("explain_alone", within("PROJECT * EXPLAIN")),
        ("explain_twice", within("PROJECT * EXPLAIN CONTRACT EXPLAIN ANALYZE")),
        ("limit_zero", within("PROJECT * LIMIT 0")),
        ("number_then_word", within("PROJECT * LIMIT 10abc")),
        ("project_nothing", within("PROJECT")),
        ("trailing_word", within("PROJECT * extra")),
        ("depth_zero", format!("{TRAVERSE} DEPTH 0 AT VALID 100 KNOWN HEAD PROJECT *")),
        ("depth_too_deep", format!("{TRAVERSE} DEPTH 33 AT VALID 100 KNOWN HEAD PROJECT *")),
        ("depth_beyond_u16", format!("{TRAVERSE} DEPTH 70000 AT VALID 100 KNOWN HEAD PROJECT *")),
        (
            "unknown_direction",
            "FROM traverse:depends_on START document:a DIRECTION SIDEWAYS DEPTH 2 AT VALID 100 KNOWN HEAD PROJECT *".into(),
        ),
        ("vertical_tab_is_not_space", "FROM\x0brecord:document AT VALID 100 KNOWN HEAD PROJECT *".into()),
    ]
}

/// RRFlow's own query vectors at the pinned revision, read from the engine
/// source Cargo checked out for `rrd-client`.
fn engine_query_vectors() -> Vec<Value> {
    // Only the host's dependencies are on disk; others would be downloaded.
    let rustc = std::process::Command::new(std::env::var_os("RUSTC").unwrap_or("rustc".into()))
        .arg("-vV")
        .output()
        .expect("rustc -vV");
    let host = String::from_utf8(rustc.stdout)
        .expect("rustc output")
        .lines()
        .find_map(|line| line.strip_prefix("host: ").map(str::to_owned))
        .expect("rustc names its host");
    let output = std::process::Command::new(env!("CARGO"))
        .args(["metadata", "--format-version", "1", "--locked", "--offline"])
        .args(["--filter-platform", &host])
        .arg("--manifest-path")
        .arg(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"))
        .output()
        .expect("cargo metadata");
    assert!(
        output.status.success(),
        "cargo metadata: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let metadata: Value = serde_json::from_slice(&output.stdout).expect("metadata JSON");
    let client = metadata["packages"]
        .as_array()
        .expect("packages")
        .iter()
        .find(|package| package["name"] == "rrd-client")
        .expect("rrd-client is a dependency");
    assert!(
        client["source"]
            .as_str()
            .is_some_and(|source| source.ends_with(&format!("#{}", pinned_revision()))),
        "rrd-client comes from the pinned revision"
    );
    // `crates/transport/rrd-client/Cargo.toml` inside the engine checkout.
    let root = Path::new(client["manifest_path"].as_str().expect("manifest path"))
        .ancestors()
        .nth(4)
        .expect("the engine checkout");
    let path = root.join("crates/compute/rrd-query/fixtures/query-vectors.json");
    let text = std::fs::read(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    serde_json::from_slice(&text).expect("query vectors JSON")
}

/// Values for a vector's parameters: a valid time, and the head as the known
/// cursor. A vector that filters by a parameter needs a value added here.
fn parameters(ast: &Value, head: u64) -> BTreeMap<String, QueryValue> {
    let mut values = BTreeMap::new();
    let temporal = &ast["temporal"];
    for (selector, value) in [
        ("valid_at", QueryValue::Unsigned(100)),
        ("known_at", QueryValue::Unsigned(head)),
    ] {
        if temporal[selector]["kind"] == "parameter" {
            let name = temporal[selector]["value"]
                .as_str()
                .expect("parameter name");
            values.insert(name.to_owned(), value);
        }
    }
    for filter in ast["filters"].as_array().expect("filters") {
        assert_ne!(filter["value"]["kind"], "parameter", "{filter}");
    }
    values
}

async fn change(client: &NativeRrdClient, mutations: Value) {
    let preview = client
        .preview_change(
            serde_json::from_value(json!({ "mutations": mutations })).expect("a change"),
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

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn the_rrflowql_golden_matches_the_engine() {
    let vectors = engine_query_vectors();
    let estate = Estate::install_and_serve();
    let golden = tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection");
        let mut registry = serde_json::to_value(
            client
                .schema()
                .await
                .expect("schema")
                .schema
                .expect("an installed registry"),
        )
        .expect("registry");
        registry["revision"] = json!(registry["revision"].as_u64().expect("revision") + 1);
        registry["migration"] = json!("Connectome rrflowQL golden");
        registry["tables"]["document"] = json!({ "model": "relational", "mode": "strict" });
        registry["tables"]["depends_on"] = json!({ "model": "graph_relation", "mode": "strict" });
        registry["records"]["document"] = json!({
            "properties": {
                "status": { "value_type": "string", "required": false },
                "title": { "value_type": "string", "required": false }
            },
            "allow_additional_properties": false,
            "unique_properties": []
        });
        registry["relations"]["depends_on"] = json!({
            "from": ["document"],
            "to": ["document"],
            "properties": {},
            "allow_additional_properties": false,
            "unique_pair": true
        });
        change(
            &client,
            json!([{ "mutation": "put_schema", "registry": registry }]),
        )
        .await;
        let record = |id: &str, status: &str| {
            json!({
                "mutation": "put_record",
                "reference": { "kind": "document", "id": id },
                "valid_from": 1,
                "properties": {
                    "status": { "type": "string", "value": status },
                    "title": { "type": "string", "value": format!("Document {id}") }
                }
            })
        };
        change(
            &client,
            json!([
                record("a", "open"),
                record("b", "closed"),
                {
                    "mutation": "put_relation",
                    "reference": { "kind": "depends_on", "id": "a--b" },
                    "from": { "kind": "document", "id": "a" },
                    "to": { "kind": "document", "id": "b" },
                    "valid_from": 1,
                    "properties": {}
                }
            ]),
        )
        .await;

        // A vector may name a known cursor; the estate is written until its
        // head reaches every one of them.
        let named = vectors
            .iter()
            .filter(|vector| vector["ast"]["temporal"]["known_at"]["kind"] == "literal")
            .filter_map(|vector| vector["ast"]["temporal"]["known_at"]["value"].as_u64())
            .max()
            .unwrap_or(0);
        let mut written = 0;
        let head = loop {
            let head = client
                .query(
                    serde_json::from_value(json!({ "query": format!("{SCOPE} PROJECT *") }))
                        .expect("a query"),
                )
                .await
                .expect("the head")
                .known_at_cursor;
            if head >= named {
                break head;
            }
            written += 1;
            change(&client, json!([record(&format!("c{written}"), "draft")])).await;
        };
        for vector in &vectors {
            let source = vector["source"].as_str().expect("vector source");
            let mut execution =
                execute_query(source, client.scope(), &client.query_budget).expect("query");
            execution.parameters = parameters(&vector["ast"], head);
            let result = client
                .send(false, |session, options| {
                    let client = &client;
                    async move {
                        client
                            .client
                            .execute_query(&session, execution, options)
                            .await
                    }
                })
                .await
                .unwrap_or_else(|error| panic!("the engine runs its own vector {source}: {error}"));
            assert_eq!(result.canonical_query, vector["canonical"], "{source}");
        }

        let mut queries = Vec::new();
        for (name, query) in corpus() {
            let outcome = client
                .query(serde_json::from_value(json!({ "query": query })).expect("a query"))
                .await;
            queries.push(match outcome {
                Ok(result) => json!({
                    "name": name,
                    "query": query,
                    "outcome": "accepted",
                    "canonical": result.canonical_query,
                }),
                Err(RrdError {
                    query: Some(refused),
                    ..
                }) => json!({
                    "name": name,
                    "query": query,
                    "outcome": "refused",
                    "offset": refused.offset,
                    "reason": refused.reason,
                }),
                Err(error) => json!({
                    "name": name,
                    "query": query,
                    "outcome": "unlocated",
                    "message": error.message,
                }),
            });
        }
        client.close().await.expect("close");
        json!({
            "engine": pinned_revision(),
            "vectors": vectors,
            "queries": queries,
        })
    });

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(GOLDEN);
    if std::env::var_os("CONNECTOME_WRITE_GOLDEN").is_some() {
        let mut text = serde_json::to_string_pretty(&golden).expect("golden JSON");
        text.push('\n');
        std::fs::write(&path, text).expect("write the golden queries");
        return;
    }
    let checked_in: Value =
        serde_json::from_slice(&std::fs::read(&path).expect("the golden queries are checked in"))
            .expect("golden JSON");
    assert_eq!(
        checked_in, golden,
        "src/rrflow/fixtures/engine-queries.json differs from what this engine returns"
    );
}
