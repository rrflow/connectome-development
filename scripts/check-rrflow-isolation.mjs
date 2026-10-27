import { readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * RRFlow isolation gate (sprint 009, Slice D0).
 *
 * The RRFlow-native surfaces of Connectome must not load the inherited
 * vendor client. This gate walks the static import graph from each declared
 * RRFlow entry module and fails when any path reaches the inherited seam
 * (`src/vendor/`), the inherited connection module, or an inherited vendor
 * package. Dynamic `import()` edges are code-split boundaries and are not
 * followed: a lazily loaded inherited view does not load with an RRFlow page.
 * Statement-level `import type` and `export type` edges are erased by the
 * compiler and load nothing, so they are not followed either; the inherited
 * types they name disappear with the client in Slice D8, where `tsc` enforces
 * their removal.
 *
 * Slice D8 deletes the inherited client; the forbidden set then names files
 * and packages that no longer exist, and the gate keeps them from returning.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** RRFlow-native entry modules. */
export const entries = [
	"src/rrflow/runtime.ts",
	"src/rrflow/session.ts",
	"src/rrflow/diagnostics.ts",
	"src/rrflow/control-plane.ts",
	"src/screens/connectome/pages/ControlPlane/index.tsx",
	"src/screens/connectome/pages/CreateConnection/index.tsx",
	"src/screens/connectome/pages/Overview/index.tsx",
	"src/screens/connectome/pages/RuntimeConnection/index.tsx",
	"src/screens/connectome/pages/RuntimeDiagnostics/index.tsx",
];

const forbiddenFiles = ["src/screens/connectome/connection/connection.tsx"];
const forbiddenDirectories = ["src/vendor/"];
const forbiddenPackage = /^(?:surrealdb|@surrealdb\/[^/]+)(?:\/|$)/;

const extensions = [".ts", ".tsx", ".mjs", ".js"];
const staticImport =
	/(?:^|[\s;])(?:import|export)\s+(type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;

async function exists(path) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

async function resolveSpecifier(from, specifier) {
	let base;
	if (specifier.startsWith("~/")) {
		base = join(root, "src", specifier.slice(2));
	} else if (specifier.startsWith(".")) {
		base = resolve(dirname(from), specifier);
	} else {
		return { package: specifier.split("?")[0] };
	}
	const clean = base.split("?")[0];
	const candidates = [
		clean,
		...extensions.map((extension) => clean + extension),
		...extensions.map((extension) => join(clean, `index${extension}`)),
	];
	for (const candidate of candidates) {
		if (await exists(candidate)) {
			return { file: candidate };
		}
	}
	return { asset: clean };
}

function isForbidden(node) {
	if (node.package) {
		return forbiddenPackage.test(node.package);
	}
	if (!node.file) {
		return false;
	}
	const path = relative(root, node.file).replaceAll("\\", "/");
	return (
		forbiddenFiles.includes(path) ||
		forbiddenDirectories.some((directory) => path.startsWith(directory))
	);
}

const label = (node) => node.package ?? relative(root, node.file).replaceAll("\\", "/");

/** Breadth-first search, so the reported path is a shortest one. */
async function firstViolation(entry) {
	const start = { file: join(root, entry) };
	const parents = new Map([[start.file, null]]);
	const queue = [start];
	while (queue.length > 0) {
		const node = queue.shift();
		if (!/\.(?:ts|tsx|mjs|js)$/.test(node.file)) {
			continue;
		}
		const source = await readFile(node.file, "utf8");
		for (const match of source.matchAll(staticImport)) {
			if (match[1]) {
				continue;
			}
			const target = await resolveSpecifier(node.file, match[2]);
			const key = target.file ?? target.package ?? target.asset;
			if (parents.has(key)) {
				continue;
			}
			parents.set(key, node);
			if (isForbidden(target)) {
				const path = [label(target)];
				for (let at = node; at; at = parents.get(at.file)) {
					path.unshift(label(at));
				}
				return path;
			}
			if (target.file) {
				queue.push(target);
			}
		}
	}
	return null;
}

async function main() {
	const failures = [];
	for (const entry of entries) {
		if (!(await exists(join(root, entry)))) {
			failures.push(`${entry}: declared RRFlow entry does not exist`);
			continue;
		}
		const path = await firstViolation(entry);
		if (path) {
			failures.push(`${entry} reaches the inherited client:\n    ${path.join("\n    -> ")}`);
		}
	}
	if (failures.length > 0) {
		console.error(`RRFlow isolation gate failed:\n  ${failures.join("\n  ")}`);
		process.exit(1);
	}
	console.log(
		`RRFlow isolation gate passed: ${entries.length} RRFlow entries load no inherited client.`,
	);
}

await main();
