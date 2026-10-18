import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

/**
 * Two identity gates run over the authored tree.
 *
 * 1. Retired pre-release query identities (the vocabulary that preceded
 *    RRFlowQL) may not appear anywhere.
 * 2. The inherited vendor's name may appear only as the identifier of a
 *    dependency that `package.json` still declares (its import specifier, its
 *    manifest entry, its bundler configuration, its license-report row) or in
 *    the notices that preserve its copyright. Prose, UI text, symbols, asset
 *    names, and configuration may not carry it. The allowed set is derived from
 *    the declared dependencies, so it shrinks to nothing as sprint 009 replaces
 *    them.
 */

const roots = ["src", "src-tauri", "docs", "scripts"];
const files = [
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"GOVERNANCE.md",
	"README.md",
	"REVIEW.md",
	"index.html",
	"package.json",
	"vite.config.ts",
];
const textExtensions = new Set([
	".css",
	".html",
	".json",
	".md",
	".mjs",
	".rs",
	".scss",
	".svg",
	".toml",
	".ts",
	".tsx",
]);

const retired = /vyrm(?:ql|ml)/i;
const vendor = /surreal/i;

/**
 * Files whose purpose is to preserve or report third-party provenance, plus
 * this gate, which must spell the name it forbids.
 */
const noticeFiles = new Set([
	"LICENSE",
	"NOTICE",
	"src/shared/assets/data/license-report.json",
	"scripts/check-retired-identities.mjs",
]);

/**
 * The one declared seam where the inherited client and editor are re-exported
 * under RRFlow-facing names. Its files must name the vendor so that a reader
 * of the seam, at least, is told the truth; sprint 009 Slice D deletes it.
 */
const seamDirectory = "src/vendor/";

/** Files that may name a declared dependency outside an import specifier. */
const manifestFiles = new Set(["package.json", "vite.config.ts"]);

async function collect(path) {
	const entries = await readdir(path, { withFileTypes: true });
	for (const entry of entries) {
		const target = join(path, entry.name);
		if (entry.isDirectory()) {
			if (
				entry.name === "node_modules" ||
				entry.name === "target" ||
				entry.name === "binaries"
			) {
				continue;
			}
			await collect(target);
		} else if (entry.isFile() && textExtensions.has(extname(entry.name))) {
			files.push(target);
		}
	}
}

for (const root of roots) {
	await collect(root);
}

const manifest = JSON.parse(await readFile("package.json", "utf8"));
const declared = Object.keys({
	...manifest.dependencies,
	...manifest.devDependencies,
	...manifest.optionalDependencies,
}).filter((name) => vendor.test(name));

function escapePattern(text) {
	return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Removes every occurrence of a declared dependency's identifier — the bare
 * package name and any subpath or query it is imported with — so that only
 * other uses of the vendor's name remain to be tested.
 */
function withoutDeclaredIdentifiers(content) {
	let rest = content;
	for (const name of declared) {
		rest = rest.replace(new RegExp(`${escapePattern(name)}(?:/[A-Za-z0-9_./?=-]*)?`, "g"), "");
	}
	return rest;
}

function manifestResidue(content) {
	// A manifest may also carry the vendor's name in an alias target
	// ("npm:@vendor/package@version"); strip those for the declared aliases.
	let rest = withoutDeclaredIdentifiers(content);
	for (const name of declared) {
		const target = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name] ?? "";
		if (target.startsWith("npm:")) {
			rest = rest.replace(new RegExp(escapePattern(target), "g"), "");
		}
	}
	return rest;
}

const retiredViolations = [];
const vendorViolations = [];
for (const file of files) {
	const path = relative(process.cwd(), file);
	const content = await readFile(file, "utf8");
	if (retired.test(path) || retired.test(content)) {
		retiredViolations.push(path);
	}
	if (noticeFiles.has(path)) {
		continue;
	}
	if (path.startsWith(seamDirectory)) {
		// The import specifier alone does not count: the file must say, in its
		// own words, whose code it re-exports.
		if (!vendor.test(withoutDeclaredIdentifiers(content))) {
			vendorViolations.push(`${path} (seam file does not name the vendor it re-exports)`);
		}
		continue;
	}
	if (vendor.test(path)) {
		vendorViolations.push(`${path} (path)`);
		continue;
	}
	const residue = manifestFiles.has(path)
		? manifestResidue(content)
		: withoutDeclaredIdentifiers(content);
	if (vendor.test(residue)) {
		const line = residue.split("\n").findIndex((text) => vendor.test(text)) + 1;
		vendorViolations.push(`${path}:${line}`);
	}
}

if (retiredViolations.length > 0) {
	console.error("Retired pre-release query identities remain:");
	for (const violation of retiredViolations.sort()) {
		console.error(`- ${violation}`);
	}
	process.exitCode = 1;
}

if (vendorViolations.length > 0) {
	console.error(
		"The inherited vendor's name appears outside a declared dependency identifier or the notices:",
	);
	for (const violation of vendorViolations.sort()) {
		console.error(`- ${violation}`);
	}
	process.exitCode = 1;
}

if (process.exitCode !== 1) {
	console.log(
		`Identity gate passed across ${files.length} files; ${declared.length} inherited vendor dependencies remain declared.`,
	);
}
