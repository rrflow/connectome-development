import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Architecture gate. Code flows one way: shared code, then features, then the
 * composition root that routes between them. A feature keeps its own files
 * together and does not reach into another feature. `src/features/GOVERNANCE.md`
 * owns the rules this enforces.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The only files allowed to name a feature from outside `src/features`. */
const compositionRoots = new Set(["src/screens/connectome/index.tsx"]);

/** A folder past this has stopped grouping anything; split it by what the code does. */
const maxSourceFilesPerFolder = 12;

const isSource = (name) => extname(name) === ".ts" || extname(name) === ".tsx";
const repoPath = (path) => relative(root, path).split(sep).join("/");

function sources(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return sources(path);
		return isSource(name) ? [path] : [];
	});
}

function targetOf(file, specifier) {
	if (specifier.startsWith("~/")) return `src/${specifier.slice(2)}`;
	if (specifier.startsWith("."))
		return posix.normalize(posix.join(posix.dirname(file), specifier));
	return null;
}

const featureOf = (path) => path.match(/^src\/features\/([^/]+)/)?.[1] ?? null;

const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
const problems = [];
const files = sources(join(root, "src"));

for (const path of files) {
	const file = repoPath(path);
	const owner = featureOf(file);
	for (const match of readFileSync(path, "utf8").matchAll(importPattern)) {
		const target = targetOf(file, match[1]);
		const reached = target && featureOf(target);
		if (!reached || reached === owner) continue;
		if (owner) {
			problems.push(`${file}: feature "${owner}" imports feature "${reached}" (${match[1]})`);
		} else if (!compositionRoots.has(file)) {
			problems.push(`${file}: shared code imports feature "${reached}" (${match[1]})`);
		}
	}
}

const counts = new Map();
for (const path of files) {
	const file = repoPath(path);
	if (!featureOf(file)) continue;
	const folder = posix.dirname(file);
	counts.set(folder, (counts.get(folder) ?? 0) + 1);
}
for (const [folder, count] of counts) {
	if (count > maxSourceFilesPerFolder) {
		problems.push(`${folder}: ${count} source files, more than ${maxSourceFilesPerFolder}`);
	}
}

if (problems.length > 0) {
	console.error(`Architecture gate failed:\n  ${problems.join("\n  ")}`);
	process.exit(1);
}
console.log(`Architecture holds: ${files.length} source files, ${counts.size} feature folders.`);
