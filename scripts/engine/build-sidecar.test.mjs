import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { sha256File, validateBuildReceipt, validateExecutable } from "./build-provenance.mjs";
import { check, pinnedRevision, stage } from "./build-sidecar.mjs";

const roots = new Set();
const REVISION = "91b6c6789e2e7d217e0873cff532bd53aa937581";
const TARGET = "x86_64-pc-windows-msvc";

function tempRoot() {
	const root = mkdtempSync(join(tmpdir(), "connectome-build-sidecar-test-"));
	roots.add(root);
	return root;
}

afterEach(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	roots.clear();
});

function reportFor(binary, overrides = {}) {
	const executableSha256 = sha256File(binary);
	return {
		product: "RRFlow",
		protocol: "rrd",
		build: {
			format_version: 1,
			qualification: "unqualified",
			compiler: { target: TARGET },
			provenance: {
				format_version: 1,
				source_commit: REVISION,
				source_tree: "c89f490e32ba697e8d47a656903206da432fff13",
				source_content_sha256: "1".repeat(64),
				dirty: false,
				cargo_lock_sha256: "2".repeat(64),
				target: TARGET,
				cargo_profile: "dev",
				build_environment_sha256: "3".repeat(64),
				first_party_units: [{ package: "rrflow-cli", target: "rrflow" }],
				...overrides.provenance,
			},
			executable_sha256: overrides.executableSha256 ?? executableSha256,
		},
	};
}

function fixtureBinary(root) {
	const binary = join(root, "rrflow-fixture.bin");
	writeFileSync(binary, Buffer.from("controlled engine fixture", "utf8"));
	return binary;
}

test("accepts a matching clean pinned executable report", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const report = reportFor(binary);
	const result = validateExecutable(
		binary,
		{ revision: REVISION, target: TARGET },
		{ versionReader: () => report },
	);
	assert.equal(result.sha256, sha256File(binary));
	assert.equal(result.report, report);
});

test("rejects absent, malformed, dirty, wrong-revision, wrong-target, wrong-profile and mismatched-byte evidence", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const expected = { revision: REVISION, target: TARGET };
	assert.throws(() => validateExecutable(join(root, "missing"), expected), /absent/);
	for (const [overrides, expectedMessage] of [
		[{ provenance: { dirty: true } }, /dirty/],
		[{ provenance: { source_commit: "a".repeat(40) } }, /source commit/],
		[{ provenance: { target: "aarch64-apple-darwin" } }, /target/],
		[{ executableSha256: "4".repeat(64) }, /digest differs/],
	]) {
		const report = reportFor(binary, overrides);
		assert.throws(
			() => validateExecutable(binary, expected, { versionReader: () => report }),
			expectedMessage,
		);
	}
	const wrongCompilerTarget = reportFor(binary);
	wrongCompilerTarget.build.compiler.target = "aarch64-apple-darwin";
	assert.throws(
		() => validateExecutable(binary, expected, { versionReader: () => wrongCompilerTarget }),
		/target/,
	);
	const wrongProfile = reportFor(binary);
	assert.throws(
		() =>
			validateExecutable(
				binary,
				{ ...expected, profile: "release" },
				{ versionReader: () => wrongProfile },
			),
		/profile/,
	);
	assert.throws(
		() => validateExecutable(binary, expected, { versionReader: () => ({ build: {} }) }),
		/provenance/,
	);
});

test("rejects a missing or mismatched CI receipt against the executable report", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const receiptPath = join(root, "receipt.json");
	const expected = { revision: REVISION, target: TARGET, profile: "dev" };
	const report = reportFor(binary);
	assert.throws(
		() => validateBuildReceipt(receiptPath, binary, expected, { versionReader: () => report }),
		/receipt is missing or malformed/,
	);
	const receipt = { format_version: 1, binary: "builder-output/rrflow", report };
	writeFileSync(receiptPath, JSON.stringify(receipt));
	assert.equal(
		validateBuildReceipt(receiptPath, binary, expected, { versionReader: () => report }).sha256,
		sha256File(binary),
	);
	const mismatched = structuredClone(receipt);
	mismatched.report.build.provenance.source_commit = "a".repeat(40);
	writeFileSync(receiptPath, JSON.stringify(mismatched));
	assert.throws(
		() => validateBuildReceipt(receiptPath, binary, expected, { versionReader: () => report }),
		/receipt report differs/,
	);
});

test("rejects invalid --from evidence before replacing staged bytes or manifest", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const binaries = join(root, "src-tauri", "binaries");
	mkdirSync(binaries, { recursive: true });
	const stagedBinary = join(binaries, "rrflow-x86_64-pc-windows-msvc.exe");
	const manifestPath = join(binaries, "engine.json");
	writeFileSync(stagedBinary, "previous-sidecar");
	writeFileSync(manifestPath, "previous-manifest\n");
	const previousBinary = readFileSync(stagedBinary);
	const previousManifest = readFileSync(manifestPath);
	const invalidReport = reportFor(binary, { provenance: { dirty: true } });
	assert.throws(
		() =>
			stage(binary, REVISION, TARGET, {
				root,
				platform: "win32",
				versionReader: () => invalidReport,
			}),
		/dirty/,
	);
	assert.deepEqual(readFileSync(stagedBinary), previousBinary);
	assert.deepEqual(readFileSync(manifestPath), previousManifest);
});

test("rejects a source changed during inspection without publishing either artifact", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const binaries = join(root, "src-tauri", "binaries");
	mkdirSync(binaries, { recursive: true });
	const stagedBinary = join(binaries, "rrflow-x86_64-pc-windows-msvc.exe");
	const manifestPath = join(binaries, "engine.json");
	writeFileSync(stagedBinary, "previous-sidecar");
	writeFileSync(manifestPath, "previous-manifest\n");
	const previousBinary = readFileSync(stagedBinary);
	const previousManifest = readFileSync(manifestPath);
	const versionReader = (path) => {
		const report = reportFor(path);
		if (path === binary) writeFileSync(binary, "mutated after version report");
		return report;
	};
	assert.throws(
		() => stage(binary, REVISION, TARGET, { root, platform: "win32", versionReader }),
		/changed while it was copied/,
	);
	assert.deepEqual(readFileSync(stagedBinary), previousBinary);
	assert.deepEqual(readFileSync(manifestPath), previousManifest);
});

test("stages and checks a valid executable while preserving manifest byte integrity", () => {
	const root = tempRoot();
	const binary = fixtureBinary(root);
	const versionReader = (path) => reportFor(path);
	const manifest = stage(binary, REVISION, TARGET, {
		root,
		platform: "win32",
		versionReader,
	});
	assert.equal(manifest.revision, REVISION);
	assert.equal(manifest.target, TARGET);
	assert.equal(manifest.sha256, sha256File(join(root, "src-tauri", "binaries", manifest.file)));
	assert.deepEqual(check(REVISION, TARGET, { root, platform: "win32", versionReader }), manifest);
	writeFileSync(join(root, "src-tauri", "binaries", manifest.file), "tampered sidecar");
	assert.throws(
		() => check(REVISION, TARGET, { root, platform: "win32", versionReader }),
		/size differs|hashes to/,
	);
});

test("requires exactly one RRFlow revision in the lock", () => {
	const root = tempRoot();
	mkdirSync(join(root, "src-tauri"), { recursive: true });
	writeFileSync(
		join(root, "src-tauri", "Cargo.lock"),
		`source = "https://github.com/rrflow/rrflow-development?rev=${REVISION}"\n`,
	);
	assert.equal(pinnedRevision(root), REVISION);
	writeFileSync(join(root, "src-tauri", "Cargo.lock"), "no RRFlow source\n");
	assert.throws(() => pinnedRevision(root), /names 0/);
});
