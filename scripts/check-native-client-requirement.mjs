// Holds `docs/native-client-requirement.json` to the tree, and says what the
// requirement still owes. The rules are in `native-client-requirement.mjs`.
//
//   node scripts/check-native-client-requirement.mjs             the record is true
//   node scripts/check-native-client-requirement.mjs --write     rewrite the record from the tree
//   node scripts/check-native-client-requirement.mjs --complete  also fail while anything is owed
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import process from "node:process";
import { compare, measure, remaining } from "./native-client-requirement.mjs";

const RECORD = "docs/native-client-requirement.json";
// The inherited vendor's name. This gate must spell what it counts, so the
// identity gate lists this file among the ones allowed to.
const vendor = /surreal/i;
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".mjs"]);
const sources = [];

async function collect(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) {
			if (entry.name !== "node_modules") await collect(path);
		} else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
			sources.push({ path, content: await readFile(join(path), "utf8") });
		}
	}
}

await collect("src");
sources.push({ path: "vite.config.ts", content: await readFile("vite.config.ts", "utf8") });

const measured = measure({
	manifest: JSON.parse(await readFile("package.json", "utf8")),
	vendor,
	sources,
	parity: JSON.parse(await readFile("docs/inherited-capability-parity.json", "utf8")),
	checklist: await readFile("tests/visual/PARITY.md", "utf8"),
});

if (process.argv.includes("--write")) {
	await writeFile(RECORD, `${JSON.stringify(measured, null, "\t")}\n`);
	console.log(`Wrote ${RECORD} from the tree.`);
}

const recorded = JSON.parse(await readFile(RECORD, "utf8"));
const violations = compare(recorded, measured);
if (violations.length > 0) {
	console.error("The native client requirement's record does not match the tree:");
	for (const violation of violations) console.error(`- ${violation}`);
	process.exitCode = 1;
}

const left = remaining(measured);
if (left.length === 0) {
	console.log("The native client requirement is met: nothing inherited remains.");
} else {
	console.log("The native client requirement is not met:");
	for (const item of left) console.log(`- ${item}`);
	if (process.argv.includes("--complete")) process.exitCode = 1;
}
