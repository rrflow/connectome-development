// Runs the dependency-authority rules over this repository's manifests.
// The rules and what each one is for are in `dependency-authority.mjs`.
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
	aliasViolations,
	cargoViolations,
	npmViolations,
	pinViolations,
} from "./dependency-authority.mjs";

const manifest = JSON.parse(await readFile("package.json", "utf8"));
const lock = await readFile("src-tauri/Cargo.lock", "utf8");
const tsconfig = JSON.parse(await readFile("tsconfig.json", "utf8"));
const viteSource = await readFile("vite.config.ts", "utf8");
const cargo = cargoViolations(lock);
const violations = [
	...npmViolations(manifest),
	...aliasViolations(tsconfig, viteSource),
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
