#!/usr/bin/env node
// Stage the pinned RRFlow engine as Connectome's Tauri sidecar.
//
// `src-tauri/Cargo.lock` is the one owner of the RRFlow revision Connectome is
// contracted to. This script builds `rrflow` from exactly that revision (or
// takes a binary CI already built from it with `--from`), places it where
// Tauri's `bundle.externalBin` expects a sidecar — `src-tauri/binaries/
// rrflow-<target-triple>` — and writes `src-tauri/binaries/engine.json` with
// the revision, target, size, and SHA-256. The native build embeds that
// digest; at run time the desktop launches the sidecar only when the file
// still hashes to it. `--check` verifies the staged sidecar against its
// manifest and the lock without building anything.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOCK = join(ROOT, "src-tauri", "Cargo.lock");
const BINARIES = join(ROOT, "src-tauri", "binaries");
const MANIFEST = join(BINARIES, "engine.json");
const REPOSITORY = "https://github.com/rrflow/rrflow-development";

/** The one RRFlow revision Cargo.lock pins for the contract crates. */
function pinnedRevision() {
	const lock = readFileSync(LOCK, "utf8");
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
	const result = spawnSync(command, args, { stdio: "inherit", ...options });
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
}

function capture(command, args, options = {}) {
	const result = spawnSync(command, args, { encoding: "utf8", ...options });
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
	return result.stdout;
}

/** The Rust host triple, which names the sidecar file Tauri looks for. */
function hostTriple() {
	const host = capture("rustc", ["-vV"]).match(/^host: (\S+)$/m)?.[1];
	if (!host) throw new Error("rustc -vV did not report a host triple");
	return host;
}

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Builds rrflow at the pinned revision in a per-revision cache checkout. */
function buildEngine(revision) {
	const checkout = join(homedir(), ".cache", "connectome", "rrflow-engine", revision);
	if (!existsSync(join(checkout, "Cargo.toml"))) {
		mkdirSync(checkout, { recursive: true });
		run("git", ["init", "-q"], { cwd: checkout });
		run("git", ["fetch", "-q", "--depth", "1", REPOSITORY, revision], { cwd: checkout });
		run("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: checkout });
	}
	// The engine's own toolchain file and lockfile decide how it builds.
	run("cargo", ["build", "--locked", "--release", "--package", "rrflow-cli", "--bin", "rrflow"], {
		cwd: checkout,
	});
	const suffix = process.platform === "win32" ? ".exe" : "";
	return join(checkout, "target", "release", `rrflow${suffix}`);
}

function stage(source, revision, target) {
	const suffix = process.platform === "win32" ? ".exe" : "";
	mkdirSync(BINARIES, { recursive: true });
	const sidecar = join(BINARIES, `rrflow-${target}${suffix}`);
	copyFileSync(source, sidecar);
	if (process.platform !== "win32") chmodSync(sidecar, 0o755);
	const manifest = {
		revision,
		target,
		file: `rrflow-${target}${suffix}`,
		size: statSync(sidecar).size,
		sha256: sha256(sidecar),
	};
	writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, "\t")}\n`);
	return manifest;
}

function check(revision, target) {
	if (!existsSync(MANIFEST))
		throw new Error("src-tauri/binaries/engine.json is absent; stage the engine first");
	const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	const sidecar = join(BINARIES, manifest.file);
	const problems = [];
	if (manifest.revision !== revision)
		problems.push(`manifest revision ${manifest.revision} is not the lock's ${revision}`);
	if (manifest.target !== target)
		problems.push(`manifest target ${manifest.target} is not this host's ${target}`);
	if (!existsSync(sidecar)) problems.push(`${manifest.file} is absent`);
	else {
		const digest = sha256(sidecar);
		if (digest !== manifest.sha256)
			problems.push(
				`${manifest.file} hashes to ${digest}, not the manifest's ${manifest.sha256}`,
			);
	}
	if (problems.length > 0)
		throw new Error(`staged engine does not match: ${problems.join("; ")}`);
	return manifest;
}

const args = process.argv.slice(2);
const revision = pinnedRevision();
const target = hostTriple();
if (args.includes("--check")) {
	const manifest = check(revision, target);
	console.log(
		`engine sidecar: ${manifest.file} at ${manifest.revision.slice(0, 7)}, sha256 ${manifest.sha256}`,
	);
} else {
	const fromIndex = args.indexOf("--from");
	const source = fromIndex === -1 ? buildEngine(revision) : resolve(args[fromIndex + 1] ?? "");
	if (!existsSync(source)) throw new Error(`engine binary is absent: ${source}`);
	const manifest = stage(source, revision, target);
	console.log(
		`engine sidecar: staged ${manifest.file} (${manifest.size} bytes) at ${manifest.revision.slice(0, 7)}, sha256 ${manifest.sha256}`,
	);
}
