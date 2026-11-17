#!/usr/bin/env node
/**
 * File-size gate, to the limits in `docs/architecture/code-structure-and-conventions.md`
 * (see `file-size.mjs`). The files already over their limit when the rule began
 * are recorded in `scripts/file-size-baseline.json` and may only shrink.
 * `--init` writes the baseline from the current tree, once.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { evaluate, limitFor } from "./file-size.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "file-size-baseline.json");
const CHECKED = /^(src|tests)\/.*\.tsx?$|^src-tauri\/src\/.*\.rs$/;
const GENERATED = new Set(["src/app/router/routeTree.gen.ts"]);

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
	.split("\n")
	.filter((path) => CHECKED.test(path) && !GENERATED.has(path) && existsSync(join(root, path)));

const sizes = {};
for (const path of tracked) {
	const text = readFileSync(join(root, path), "utf8");
	sizes[path] = text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

if (process.argv.includes("--init")) {
	const large = Object.fromEntries(
		Object.entries(sizes)
			.filter(([path, lines]) => lines > (limitFor(path) ?? Number.POSITIVE_INFINITY))
			.sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(baselinePath, `${JSON.stringify(large, null, "\t")}\n`);
	console.log(`file-size baseline written: ${Object.keys(large).length} files over their limit`);
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const problems = evaluate(sizes, baseline);
if (problems.length > 0) {
	console.error("File-size gate failed:");
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log(
	`File sizes hold: ${tracked.length} files; TS and TSX within 400 lines, Rust within 800, tests within 1500, and ${Object.keys(baseline).length} larger files held to their size.`,
);
