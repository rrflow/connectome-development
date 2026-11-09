import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const TARGET = /^[A-Za-z0-9_-]+$/;
const PROFILES = new Set(["dev", "release", "diagnostic"]);
const MAX_VERSION_BYTES = 1024 * 1024;

function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireField(condition, message) {
	if (!condition) throw new Error(`engine build provenance rejected: ${message}`);
}

export function sha256File(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (record(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

export function readEngineVersion(binary) {
	const result = spawnSync(binary, ["--json", "version"], {
		encoding: "utf8",
		timeout: 20_000,
		maxBuffer: MAX_VERSION_BYTES,
		windowsHide: true,
	});
	if (result.error) throw new Error(`cannot read engine version: ${result.error.message}`);
	if (result.status !== 0) {
		throw new Error(`engine --json version exited with ${result.status}`);
	}
	let report;
	try {
		report = JSON.parse(result.stdout);
	} catch (error) {
		throw new Error(`engine --json version returned malformed JSON: ${error.message}`);
	}
	return report;
}

export function validateVersionReport(report, { revision, target, profile, executableSha256 }) {
	requireField(record(report), "version report must be a JSON object");
	requireField(record(report.build), "version report has no build identity");
	const build = report.build;
	requireField(record(build.compiler), "version report has no compiler target");
	requireField(record(build.provenance), "version report has no source provenance");
	const provenance = build.provenance;
	requireField(COMMIT.test(revision ?? ""), "expected source revision is invalid");
	requireField(TARGET.test(target ?? ""), "expected target triple is invalid");
	requireField(provenance.format_version === 1, "unsupported provenance format");
	requireField(
		COMMIT.test(provenance.source_commit ?? ""),
		"source commit is missing or malformed",
	);
	requireField(provenance.source_commit === revision, "source commit differs from the lock pin");
	requireField(provenance.dirty === false, "source tree is dirty or dirty state is unknown");
	requireField(provenance.target === target, "provenance target differs from this host");
	requireField(build.compiler.target === target, "compiler target differs from this host");
	requireField(PROFILES.has(provenance.cargo_profile), "Cargo profile is missing or unsupported");
	if (profile !== undefined) {
		requireField(
			provenance.cargo_profile === profile,
			"Cargo profile differs from the requested profile",
		);
	}
	requireField(
		SHA256.test(build.executable_sha256 ?? ""),
		"reported executable digest is missing or malformed",
	);
	requireField(
		build.executable_sha256 === executableSha256,
		"reported executable digest differs from the file bytes",
	);
	for (const [name, value] of [
		["source content digest", provenance.source_content_sha256],
		["Cargo lock digest", provenance.cargo_lock_sha256],
		["build environment digest", provenance.build_environment_sha256],
	]) {
		requireField(SHA256.test(value ?? ""), `${name} is missing or malformed`);
	}
	requireField(COMMIT.test(provenance.source_tree ?? ""), "source tree is missing or malformed");
	requireField(
		Array.isArray(provenance.first_party_units) && provenance.first_party_units.length > 0,
		"first-party compilation units are missing",
	);
	return report;
}

export function validateExecutable(binary, expected, { versionReader = readEngineVersion } = {}) {
	let stat;
	try {
		stat = statSync(binary);
	} catch {
		throw new Error(`engine executable is absent: ${binary}`);
	}
	requireField(stat.isFile(), "engine path is not a regular file");
	const executableSha256 = sha256File(binary);
	const report = versionReader(binary);
	validateVersionReport(report, { ...expected, executableSha256 });
	return { binary, size: stat.size, sha256: executableSha256, report };
}

export function validateBuildReceipt(
	receiptPath,
	binary,
	expected,
	{ versionReader = readEngineVersion } = {},
) {
	let receipt;
	try {
		receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
	} catch (error) {
		throw new Error(`engine build receipt is missing or malformed: ${error.message}`);
	}
	requireField(record(receipt), "build receipt must be a JSON object");
	requireField(receipt.format_version === 1, "unsupported build receipt format");
	requireField(
		typeof receipt.binary === "string" && receipt.binary.length > 0,
		"build receipt has no builder-reported binary path",
	);
	requireField(record(receipt.report), "build receipt has no version report");
	const executable = validateExecutable(binary, expected, { versionReader });
	requireField(
		canonicalJson(receipt.report) === canonicalJson(executable.report),
		"receipt report differs from the executable's version report",
	);
	return { ...executable, receipt };
}
