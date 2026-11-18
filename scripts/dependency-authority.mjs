// Dependency-authority rules (sprint 007, "Merge and publication gate").
// `check-dependency-authority.mjs` runs them; `test-dependency-authority.mjs`
// proves each one refuses what it must.
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
// 4. Nothing else may sit under the `@rrflow` scope: not a local path, link or
//    workspace entry in the manifest, and not a path alias in tsconfig.json or
//    vite.config.ts. Local source is imported by its real relative path.
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

export function npmViolations(manifest) {
	const violations = [];
	for (const section of MANIFEST_SECTIONS) {
		for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
			if (typeof spec !== "string") continue;
			const alias = spec.startsWith("npm:") ? aliasTarget(spec) : null;
			if (name.startsWith(RRFLOW_SCOPE)) {
				if (alias !== null && !alias.startsWith(RRFLOW_SCOPE)) {
					violations.push(
						`package.json ${section}: "${name}" impersonates an RRFlow package; it is ${alias}`,
					);
				} else if (name !== SDK_PACKAGE) {
					// A local path, link or workspace entry under the scope would let
					// source in this repository pass as a published RRFlow package.
					violations.push(
						`package.json ${section}: "${name}" is not a package RRFlow publishes; the ${RRFLOW_SCOPE} scope holds only ${SDK_PACKAGE} (it is ${spec})`,
					);
				} else if (section !== "dependencies") {
					violations.push(
						`package.json ${section}: "${SDK_PACKAGE}" belongs in dependencies, where its pin is checked`,
					);
				}
			} else if (alias !== null && scopeOf(name) !== scopeOf(alias)) {
				violations.push(
					`package.json ${section}: "${name}" hides the provenance of ${alias}`,
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

export function cargoViolations(lock) {
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

export function pinViolations(manifest, revisions) {
	const violations = [];
	const sdk = sdkRevision(manifest, violations);
	if (sdk && revisions.size === 1 && !revisions.has(sdk)) {
		violations.push(
			`${SDK_PACKAGE} is pinned to ${sdk} but Cargo.lock pins ${[...revisions][0]}; the webview's wire types and the native contract must be one RRFlow revision`,
		);
	}
	return violations;
}

/**
 * Path aliases can make a folder in this repository resolve as an `@rrflow`
 * package without any manifest entry. `tsconfig` is the parsed tsconfig.json;
 * `viteSource` is the text of vite.config.ts.
 */
export function aliasViolations(tsconfig, viteSource) {
	const violations = [];
	for (const key of Object.keys(tsconfig?.compilerOptions?.paths ?? {})) {
		if (key.startsWith(RRFLOW_SCOPE)) {
			violations.push(
				`tsconfig.json paths: "${key}" aliases local source as an RRFlow package`,
			);
		}
	}
	for (const match of viteSource.matchAll(/["'](@rrflow\/[^"']*)["']\s*:/g)) {
		violations.push(
			`vite.config.ts alias: "${match[1]}" aliases local source as an RRFlow package`,
		);
	}
	return violations;
}
