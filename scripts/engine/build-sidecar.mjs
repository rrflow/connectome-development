#!/usr/bin/env node
// Stage only an engine whose embedded build coordinates match its bytes and
// the single RRFlow revision in src-tauri/Cargo.lock.
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmdirSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	canonicalJson,
	readEngineVersion,
	sha256File,
	validateBuildReceipt,
	validateExecutable,
	validateVersionReport,
} from "./build-provenance.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPOSITORY = "https://github.com/rrflow/rrflow-development";

/** The one RRFlow revision Cargo.lock pins for the contract crates. */
export function pinnedRevision(root = ROOT) {
	const lock = readFileSync(join(root, "src-tauri", "Cargo.lock"), "utf8");
	const revisions = new Set(
		[...lock.matchAll(/rrflow-development\?rev=([0-9a-f]{40})/g)].map((match) => match[1]),
	);
	if (revisions.size !== 1) {
		throw new Error(
			`src-tauri/Cargo.lock must pin RRFlow to one revision; it names ${revisions.size}`,
		);
	}
	return [...revisions][0];
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true, ...options });
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
}

function capture(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		windowsHide: true,
		maxBuffer: 1024 * 1024,
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
	return result.stdout;
}

/** The Rust host triple, which names the sidecar file Tauri looks for. */
export function hostTriple() {
	const host = capture("rustc", ["-vV"]).match(/^host: (\S+)$/m)?.[1];
	if (!host) throw new Error("rustc -vV did not report a host triple");
	return host;
}

function sidecarName(target, platform = process.platform) {
	if (!/^[A-Za-z0-9_-]+$/.test(target)) throw new Error("host target triple is malformed");
	return `rrflow-${target}${platform === "win32" ? ".exe" : ""}`;
}

function assertCleanPinnedCheckout(checkout, revision) {
	const head = capture("git", ["rev-parse", "HEAD"], { cwd: checkout }).trim();
	if (head !== revision)
		throw new Error(`RRFlow build checkout is at ${head}, not pinned ${revision}`);
	const status = capture("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
		cwd: checkout,
	});
	if (status.length !== 0) throw new Error("RRFlow build checkout is dirty");
}

function pythonCommand() {
	return process.platform === "win32" ? "python" : "python3";
}

function assertOwnedTemporaryDirectory(directory, parent, prefix) {
	const resolvedParent = realpathSync(parent);
	const resolvedDirectory = realpathSync(directory);
	if (
		resolve(dirname(resolvedDirectory)) !== resolve(resolvedParent) ||
		resolve(dirname(directory)) !== resolve(parent) ||
		!directory.split(/[\\/]/).at(-1).startsWith(prefix)
	) {
		throw new Error(`refusing to clean a temporary directory outside ${parent}`);
	}
}

/** Builds release rrflow with the pinned checkout's canonical provenance builder. */
export function buildEngine(revision, target) {
	const checkout = join(homedir(), ".cache", "connectome", "rrflow-engine", revision);
	if (!existsSync(checkout)) {
		mkdirSync(checkout, { recursive: true });
		run("git", ["init", "-q"], { cwd: checkout });
		run("git", ["fetch", "-q", "--depth", "1", REPOSITORY, revision], { cwd: checkout });
		run("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: checkout });
	}
	if (!existsSync(join(checkout, "Cargo.toml"))) {
		throw new Error("RRFlow build checkout is incomplete; inspect it before retrying");
	}
	assertCleanPinnedCheckout(checkout, revision);

	const receiptDirectory = mkdtempSync(join(tmpdir(), "connectome-rrflow-build-"));
	const receiptPath = join(receiptDirectory, "rrflow-build-receipt.json");
	assertOwnedTemporaryDirectory(receiptDirectory, tmpdir(), "connectome-rrflow-build-");
	let binary;
	let operationError;
	try {
		run(
			pythonCommand(),
			["scripts/build_rrflow.py", "--profile", "release", "--output", receiptPath],
			{ cwd: checkout },
		);
		const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
		if (typeof receipt.binary !== "string" || !existsSync(receipt.binary)) {
			throw new Error("canonical RRFlow builder receipt names no executable");
		}
		validateBuildReceipt(receiptPath, receipt.binary, { revision, target, profile: "release" });
		assertCleanPinnedCheckout(checkout, revision);
		binary = receipt.binary;
	} catch (error) {
		operationError = error;
	}
	let cleanupError;
	try {
		assertOwnedTemporaryDirectory(receiptDirectory, tmpdir(), "connectome-rrflow-build-");
		if (existsSync(receiptPath)) unlinkSync(receiptPath);
		rmdirSync(receiptDirectory);
	} catch (error) {
		cleanupError = error;
	}
	if (operationError && cleanupError) throw new AggregateError([operationError, cleanupError]);
	if (cleanupError) throw cleanupError;
	if (operationError) throw operationError;
	return binary;
}

/** Validate the selected executable before touching the sidecar or manifest. */
export function stage(
	source,
	revision,
	target,
	{ root = ROOT, platform = process.platform, versionReader } = {},
) {
	const verified = validateExecutable(source, { revision, target }, { versionReader });
	const binaries = join(root, "src-tauri", "binaries");
	const file = sidecarName(target, platform);
	const sidecar = join(binaries, file);
	const manifestPath = join(binaries, "engine.json");
	mkdirSync(binaries, { recursive: true });
	const stageDirectory = mkdtempSync(join(binaries, ".rrflow-stage-"));
	assertOwnedTemporaryDirectory(stageDirectory, binaries, ".rrflow-stage-");
	const stagedBinary = join(stageDirectory, file);
	const stagedManifest = join(stageDirectory, "engine.json");
	const previousBinary = join(stageDirectory, "previous-sidecar");
	const hadPreviousBinary = existsSync(sidecar);
	const previousManifest = existsSync(manifestPath) ? readFileSync(manifestPath) : undefined;
	let destinationTouched = false;
	let manifest;
	let operationError;
	try {
		copyFileSync(verified.binary, stagedBinary);
		const stagedDigest = sha256File(stagedBinary);
		if (stagedDigest !== verified.sha256) {
			throw new Error("source executable changed while it was copied to staging");
		}
		const stagedReport = (versionReader ?? readEngineVersion)(stagedBinary);
		validateVersionReport(stagedReport, { revision, target, executableSha256: stagedDigest });
		if (canonicalJson(stagedReport) !== canonicalJson(verified.report)) {
			throw new Error("staged executable version report changed before publication");
		}
		if (hadPreviousBinary) copyFileSync(sidecar, previousBinary);
		manifest = {
			revision,
			target,
			file,
			size: statSync(stagedBinary).size,
			sha256: stagedDigest,
		};
		writeFileSync(stagedManifest, `${JSON.stringify(manifest, null, "\t")}\n`);
		destinationTouched = true;
		copyFileSync(stagedBinary, sidecar);
		if (platform !== "win32") chmodSync(sidecar, 0o755);
		if (statSync(sidecar).size !== manifest.size || sha256File(sidecar) !== manifest.sha256) {
			throw new Error("published sidecar bytes differ from the verified staged executable");
		}
		renameSync(stagedManifest, manifestPath);
	} catch (error) {
		let failure = error;
		try {
			if (destinationTouched) {
				if (hadPreviousBinary && existsSync(previousBinary))
					copyFileSync(previousBinary, sidecar);
				else if (!hadPreviousBinary && existsSync(sidecar)) unlinkSync(sidecar);
				if (previousManifest !== undefined) writeFileSync(manifestPath, previousManifest);
				else if (existsSync(manifestPath)) unlinkSync(manifestPath);
			}
		} catch (rollbackError) {
			failure = new AggregateError([error, rollbackError]);
		}
		operationError = failure;
	}
	let cleanupError;
	try {
		assertOwnedTemporaryDirectory(stageDirectory, binaries, ".rrflow-stage-");
		for (const path of [stagedBinary, stagedManifest, previousBinary]) {
			if (existsSync(path)) unlinkSync(path);
		}
		rmdirSync(stageDirectory);
	} catch (error) {
		cleanupError = error;
	}
	if (operationError && cleanupError) throw new AggregateError([operationError, cleanupError]);
	if (cleanupError) throw cleanupError;
	if (operationError) throw operationError;
	return manifest;
}

export function check(
	revision,
	target,
	{ root = ROOT, platform = process.platform, versionReader } = {},
) {
	const manifestPath = join(root, "src-tauri", "binaries", "engine.json");
	if (!existsSync(manifestPath))
		throw new Error("src-tauri/binaries/engine.json is absent; stage the engine first");
	let manifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch (error) {
		throw new Error(`src-tauri/binaries/engine.json is malformed: ${error.message}`);
	}
	if (manifest.revision !== revision)
		throw new Error(`manifest revision ${manifest.revision} is not the lock's ${revision}`);
	if (manifest.target !== target)
		throw new Error(`manifest target ${manifest.target} is not this host's ${target}`);
	const file = sidecarName(target, platform);
	if (manifest.file !== file)
		throw new Error(`manifest file ${manifest.file} is not the host sidecar ${file}`);
	if (!Number.isSafeInteger(manifest.size) || manifest.size < 1)
		throw new Error("manifest size is invalid");
	if (!/^[0-9a-f]{64}$/.test(manifest.sha256 ?? ""))
		throw new Error("manifest SHA-256 is invalid");
	const sidecar = join(root, "src-tauri", "binaries", file);
	if (!existsSync(sidecar)) throw new Error(`${file} is absent`);
	const stat = statSync(sidecar);
	if (!stat.isFile()) throw new Error(`${file} is not a regular file`);
	if (stat.size !== manifest.size) throw new Error(`${file} size differs from the manifest`);
	const digest = sha256File(sidecar);
	if (digest !== manifest.sha256)
		throw new Error(`${file} hashes to ${digest}, not the manifest's ${manifest.sha256}`);
	validateExecutable(sidecar, { revision, target }, { versionReader });
	return manifest;
}

function verifyReceiptMode(args, revision, target) {
	if (
		args.length !== 6 ||
		args[0] !== "--verify-receipt" ||
		args[2] !== "--binary" ||
		args[4] !== "--profile"
	) {
		throw new Error(
			"usage: --verify-receipt <receipt.json> --binary <rrflow> --profile <dev|release|diagnostic>",
		);
	}
	const verified = validateBuildReceipt(args[1], resolve(args[3]), {
		revision,
		target,
		profile: args[5],
	});
	console.log(
		`engine build receipt verified: ${verified.report.build.provenance.source_commit.slice(0, 7)}, ${verified.report.build.provenance.cargo_profile}, sha256 ${verified.sha256}`,
	);
}

function main(args = process.argv.slice(2)) {
	const revision = pinnedRevision();
	const target = hostTriple();
	if (args.length === 1 && args[0] === "--check") {
		const manifest = check(revision, target);
		console.log(
			`engine sidecar: ${manifest.file} at ${manifest.revision.slice(0, 7)}, sha256 ${manifest.sha256}`,
		);
		return;
	}
	if (args[0] === "--verify-receipt") {
		verifyReceiptMode(args, revision, target);
		return;
	}
	let source;
	if (args.length === 2 && args[0] === "--from") {
		source = resolve(args[1]);
	} else if (args.length === 0) {
		source = buildEngine(revision, target);
	} else {
		throw new Error(
			"usage: [--from <binary>] | --check | --verify-receipt <receipt.json> --binary <rrflow> --profile <profile>",
		);
	}
	const manifest = stage(source, revision, target);
	console.log(
		`engine sidecar: staged ${manifest.file} (${manifest.size} bytes) at ${manifest.revision.slice(0, 7)}, sha256 ${manifest.sha256}`,
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
