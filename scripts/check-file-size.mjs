#!/usr/bin/env node
/**
 * File-size gate. No source file may exceed LIMIT lines; the files that did
 * before this rule are recorded in `scripts/file-size-baseline.json` and may
 * only shrink. `--init` writes the baseline from the current tree, once.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { evaluate } from "./file-size.mjs";

const LIMIT = 400;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "file-size-baseline.json");
const CHECKED = /^(src|scripts|tests)\/.*\.(ts|tsx|mjs)$|^src-tauri\/src\/.*\.rs$/;
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
			.filter(([, lines]) => lines > LIMIT)
			.sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(baselinePath, `${JSON.stringify(large, null, "\t")}\n`);
	console.log(
		`file-size baseline written: ${Object.keys(large).length} files over ${LIMIT} lines`,
	);
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const problems = evaluate(sizes, baseline, LIMIT);
if (problems.length > 0) {
	console.error("File-size gate failed:");
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
const over = Object.keys(baseline).length;
console.log(
	`File sizes hold: ${tracked.length} files, none new over ${LIMIT} lines, ${over} large files held to their size.`,
);
