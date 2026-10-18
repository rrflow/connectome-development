// Dependency-authority gate (sprint 007, "Merge and publication gate").
//
// It enforces the sprint's authority decisions on the two dependency
// manifests:
//
// 1. A package under the `@rrflow` npm scope is RRFlow-owned. It may not be an
//    `npm:` alias for another publisher's package, and no alias may hide the
//    scope of the package it resolves to, so inherited source keeps its
//    provenance explicit (Authority decision 3, Slice E-6).
// 2. RRFlow Rust crates come only from RRFlow's development repository,
//    pinned to one exact commit, and only the public contract crates the native
//    client is built on. No physical engine crate is linked (Slice D).
// 3. The generated TypeScript SDK (`@rrflow/rrd-client`) comes from the same
//    repository's `sdks/typescript`, pinned to the same exact commit as the
//    crates, so the webview's wire types and the native client's contract are
//    one revision (sprint 008, Slice C).
import { readFile } from "node:fs/promises";
import process from "node:process";

const RRFLOW_SCOPE = "@rrflow/";
const RRFLOW_REPOSITORY = "https://github.com/rrflow/rrflow-development";
const CONTRACT_CRATES = new Set(["rrd-client", "rrd-contract"]);
const SDK_PACKAGE = "@rrflow/rrd-client";
const SDK_SPECIFIER = /^github:rrflow\/rrflow-development#([0-9a-f]{40})&path:sdks\/typescript$/;
const MANIFEST_SECTIONS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
];

/** `@scope/name` → `@scope`; an unscoped name has no scope. */
function scopeOf(name) {
	return name.startsWith("@") ? name.slice(0, name.indexOf("/")) : null;
}

/** The package an `npm:` alias resolves to, without its version range. */
function aliasTarget(spec) {
	const target = spec.slice("npm:".length);
	const versionAt = target.indexOf("@", target.startsWith("@") ? 1 : 0);
	return versionAt === -1 ? target : target.slice(0, versionAt);
}

function npmViolations(manifest) {
	const violations = [];
	for (const section of MANIFEST_SECTIONS) {
		for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
			if (typeof spec !== "string" || !spec.startsWith("npm:")) continue;
			const target = aliasTarget(spec);
			if (name.startsWith(RRFLOW_SCOPE) && !target.startsWith(RRFLOW_SCOPE)) {
				violations.push(
					`package.json ${section}: "${name}" impersonates an RRFlow package; it is ${target}`,
				);
			} else if (scopeOf(name) !== scopeOf(target)) {
				violations.push(
					`package.json ${section}: "${name}" hides the provenance of ${target}`,
				);
			}
		}
	}
	return violations;
}

/** `[[package]]` blocks of a Cargo.lock as `{ name, version, source }`. */
function lockedPackages(lock) {
	return lock
		.split("[[package]]")
		.slice(1)
		.map((block) => {
			const field = (key) => block.match(new RegExp(`^${key} = "([^"]*)"`, "m"))?.[1];
			return { name: field("name"), version: field("version"), source: field("source") };
		});
}

/** The exact commit the SDK dependency names, or a violation. */
function sdkRevision(manifest, violations) {
	const spec = manifest.dependencies?.[SDK_PACKAGE];
	if (typeof spec !== "string") {
		violations.push(`package.json dependencies: "${SDK_PACKAGE}" is missing`);
		return null;
	}
	const match = SDK_SPECIFIER.exec(spec);
	if (!match) {
		violations.push(
			`package.json dependencies: "${SDK_PACKAGE}" must be ${RRFLOW_REPOSITORY}'s sdks/typescript at one exact commit; it is ${spec}`,
		);
		return null;
	}
	return match[1];
}

function cargoViolations(lock) {
	const violations = [];
	const revisions = new Set();
	for (const crate of lockedPackages(lock)) {
		const source = crate.source ?? "";
		if (!/^git\+https:\/\/github\.com\/rrflow\//i.test(source)) continue;
		const label = `Cargo.lock: ${crate.name} ${crate.version}`;
		const [location, resolved] = source.slice("git+".length).split("#");
		const [repository, query = ""] = location.split("?");
		if (repository.toLowerCase() !== RRFLOW_REPOSITORY) {
			violations.push(`${label} comes from ${repository}, not ${RRFLOW_REPOSITORY}`);
		}
		const rev = new URLSearchParams(query).get("rev");
		if (!rev || !/^[0-9a-f]{40}$/.test(rev) || rev !== resolved) {
			violations.push(`${label} is not pinned to one exact commit (${query || "no rev"})`);
		} else {
			revisions.add(rev);
		}
		if (!CONTRACT_CRATES.has(crate.name)) {
			violations.push(
				`${label} is not a public contract crate (${[...CONTRACT_CRATES].join(", ")})`,
			);
		}
	}
	if (revisions.size > 1) {
		violations.push(
			`Cargo.lock: RRFlow crates resolve to ${revisions.size} commits (${[...revisions].join(", ")}); the native client and the engine it targets must share one`,
		);
	}
	return { violations, revisions };
}

function pinViolations(manifest, revisions) {
	const violations = [];
	const sdk = sdkRevision(manifest, violations);
	if (sdk && revisions.size === 1 && !revisions.has(sdk)) {
		violations.push(
			`${SDK_PACKAGE} is pinned to ${sdk} but Cargo.lock pins ${[...revisions][0]}; the webview's wire types and the native contract must be one RRFlow revision`,
		);
	}
	return violations;
}

const manifest = JSON.parse(await readFile("package.json", "utf8"));
const lock = await readFile("src-tauri/Cargo.lock", "utf8");
const cargo = cargoViolations(lock);
const violations = [
	...npmViolations(manifest),
	...cargo.violations,
	...pinViolations(manifest, cargo.revisions),
];

if (violations.length > 0) {
	console.error("Dependency authority violations:");
	for (const violation of violations) console.error(`- ${violation}`);
	process.exitCode = 1;
} else {
	console.log("Dependency authority gate passed.");
}
