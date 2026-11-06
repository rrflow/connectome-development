#!/usr/bin/env node
/**
 * Checks Connectome's rrflowQL language (`src/rrflow/rrflowql.ts`) against
 * what the pinned engine said about RRFlow's own query vectors and a corpus
 * of queries (`src/rrflow/fixtures/engine-queries.json`, written and verified
 * by the RRD process test `rrd::client::process::language`).
 *
 *   node --experimental-strip-types scripts/check-rrflowql.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const language = await import(
	`file://${join(root, "src/rrflow/rrflowql.ts").replaceAll("\\", "/")}`
);
const golden = JSON.parse(
	readFileSync(join(root, "src/rrflow/fixtures/engine-queries.json"), "utf8"),
);
const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
const pinned = lock.match(/rrflow-development\?rev=([0-9a-f]{40})/)?.[1];
assert.equal(golden.engine, pinned, "the golden queries come from the pinned engine");

const { scan, classify, refusalRange, LEXICAL_REASONS } = language;
const lexical = new Set(LEXICAL_REASONS);

let checks = 0;
const check = (name, test) => {
	try {
		test();
		checks++;
	} catch (error) {
		console.error(`rrflowQL: ${name}`);
		throw error;
	}
};
const words = (source, role) =>
	classify(source)
		.tokens.filter((token) => token.role === role)
		.map((token) => source.slice(token.from, token.to));
const roles = (source) =>
	classify(source)
		.tokens.map((token) => token.role)
		.join(" ");
// The parser quotes a word with Rust's `{:?}`.
const unquote = (text) =>
	text.replace(/\\(u\{([0-9a-f]+)\}|.)/g, (_, escaped, hex) =>
		hex
			? String.fromCodePoint(Number.parseInt(hex, 16))
			: ({ n: "\n", r: "\r", t: "\t", 0: "\0" }[escaped] ?? escaped),
	);

// The engine tokenizes a whole query before it parses any of it, so a query
// it refused for any other reason, or accepted, passed its tokenizer.
const refusedFor = new Set();
for (const entry of golden.queries) {
	check(`${entry.name} tokenizes as the engine's tokenizer does`, () => {
		const { refusal } = scan(entry.query);
		if (entry.outcome === "refused" && lexical.has(entry.reason)) {
			refusedFor.add(entry.reason);
			assert.deepEqual(refusal, { offset: entry.offset, reason: entry.reason });
		} else {
			assert.equal(refusal, null);
		}
	});
	if (entry.outcome === "accepted") {
		check(`${entry.name} reads like its canonical form`, () => {
			assert.equal(roles(entry.query), roles(entry.canonical));
		});
	}
	if (entry.outcome === "refused") {
		check(`${entry.name}'s refusal is placed where the engine put it`, () => {
			const { from, to } = refusalRange(entry.query, entry.offset);
			assert.ok(0 <= from && from <= entry.offset && entry.offset <= to, `${from}..${to}`);
			assert.ok(to <= entry.query.length && (from < to || entry.query.length === 0));
		});
		// A parse refusal that quotes a word quotes the token it stopped at.
		const quoted = entry.reason.match(/(?<!string )"((?:[^"\\]|\\.)*)"$/)?.[1];
		if (quoted !== undefined) {
			check(`${entry.name} stops at the token the engine names`, () => {
				const token = scan(entry.query).tokens.find((token) => token.from === entry.offset);
				assert.ok(token, `a token starts at ${entry.offset}`);
				assert.equal(entry.query.slice(token.from, token.to), unquote(quoted));
			});
		}
	}
}
check("the golden holds every refusal the engine's tokenizer makes", () => {
	assert.deepEqual([...refusedFor].sort(), [...lexical].sort());
});

// RRFlow's own vectors: each word is read in the place the engine's parse of
// it puts it.
for (const vector of golden.vectors) {
	const { source: query, canonical, ast } = vector;
	check(`vector ${query} reads as the engine parsed it`, () => {
		assert.equal(scan(query).refusal, null);
		assert.equal(roles(query), roles(canonical));
		const source = ast.source;
		assert.deepEqual(
			words(query, "family").map((word) => word.toLowerCase()),
			[source.family, ...(ast.join ? [ast.join.source.family] : [])],
		);
		const kind = (of) => of.kind ?? of.relation ?? of.predicate;
		assert.deepEqual(
			words(query, "kind"),
			[source, ...(ast.join ? [ast.join.source] : [])].map(kind).filter(Boolean),
		);
		assert.deepEqual(
			words(query, "reference"),
			source.start ? [source.start.kind, source.start.id] : [],
		);
		const fields = [
			...(ast.join ? [ast.join.left_field, ast.join.right_field] : []),
			...ast.filters.map((filter) => filter.field),
			...(ast.projection.kind === "fields" ? ast.projection.fields : []),
		];
		assert.deepEqual(words(query, "field").sort(), fields.sort());
		const parameters = [
			ast.temporal.valid_at,
			ast.temporal.known_at,
			...ast.filters.map((f) => f.value),
		]
			.filter((expression) => expression.kind === "parameter")
			.map((expression) => `$${expression.value}`);
		assert.deepEqual(words(query, "parameter").sort(), parameters.sort());
	});
}

check("traversals, joins and values are read in place", () => {
	const traversal =
		'FROM traverse:depends_on START document:a DIRECTION BOTH DEPTH 3 AT VALID $t KNOWN HEAD WHERE done = true AND note != null AND title MATCH "a" PROJECT id, from';
	assert.deepEqual(words(traversal, "family"), ["traverse"]);
	assert.deepEqual(words(traversal, "kind"), ["depends_on"]);
	assert.deepEqual(words(traversal, "reference"), ["document", "a"]);
	assert.deepEqual(words(traversal, "field"), ["done", "note", "title", "id", "from"]);
	assert.deepEqual(words(traversal, "bool"), ["true"]);
	assert.deepEqual(words(traversal, "null"), ["null"]);
	assert.deepEqual(words(traversal, "operator"), ["=", "!=", "MATCH"]);
	const join = "FROM record:a JOIN record:b ON left = right AT VALID 1 KNOWN 2 PROJECT *";
	assert.deepEqual(words(join, "field"), ["left", "right"]);
	assert.deepEqual(words(join, "kind"), ["a", "b"]);
	assert.deepEqual(words(join, "number"), ["1", "2"]);
});
check("highlighting continues past a refusal", () => {
	const query = 'FROM record:a AT VALID 1 KNOWN HEAD WHERE x ! "a\\q" PROJECT y';
	const { tokens, refusal } = scan(query);
	assert.deepEqual(refusal, {
		offset: query.indexOf("!"),
		reason: "unsupported query character",
	});
	assert.deepEqual(
		tokens.filter((token) => token.invalid).map((token) => query.slice(token.from, token.to)),
		["!", '"a\\q"'],
	);
	assert.deepEqual(words(query, "field"), ["x", "y"]);
});

console.log(
	`rrflowQL holds: ${golden.queries.length} engine queries and ${golden.vectors.length} RRFlow vectors at ${pinned.slice(0, 8)}, ${checks} checks.`,
);
