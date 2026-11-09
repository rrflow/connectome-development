import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * Capture-only patches for the inherited-screen visual baseline (sprint 009,
 * decision 17).
 *
 * The shipped application cannot reach or run the inherited screens: the
 * Sandbox defaults to an RRFlow runtime profile, a renamed version prefix
 * makes every inherited connection fail after it connects, and the mini page
 * lost the meta tag its adapter looks for. These patches undo exactly those
 * three things in a working tree so the screens can be captured as they look
 * when they work. They change no visual code. `restore` puts every patched
 * file back byte for byte; nothing here is ever committed to a product tree.
 *
 *   node tests/visual/capture-only.mjs apply <worktree>
 *   node tests/visual/capture-only.mjs restore <worktree>
 */

const PATCHES = [
	{
		file: "src/shared/util/defaults.tsx",
		reason: "open the Sandbox as a pre-runtime saved profile",
		apply: (source, nl) =>
			source.replace(
				`\t\tid: "sandbox",${nl}\t\tname: "Sandbox",${nl}`,
				`\t\tid: "sandbox",${nl}\t\tname: "Sandbox",${nl}\t\ttarget: undefined, // CAPTURE-ONLY${nl}`,
			),
	},
	{
		file: "src/screens/connectome/connection/connection.tsx",
		reason: "strip the engine-name prefix before parsing the version",
		apply: (source) =>
			source.replaceAll(
				'.replace(/^rrflow-/, "")',
				'.replace(/^[a-z]+-/, "") /* CAPTURE-ONLY */',
			),
	},
	{
		file: "src/adapter/mini.tsx",
		reason: "strip the engine-name prefix before parsing the version",
		apply: (source) =>
			source.replaceAll(
				'.replace(/^rrflow-/, "")',
				'.replace(/^[a-z]+-/, "") /* CAPTURE-ONLY */',
			),
	},
	{
		file: "tools/mini-embed.html",
		reason: "restore the meta tag the mini adapter selector looks for",
		apply: (source, nl) =>
			source.includes('name="Connectome-mini"')
				? source
				: source.replace(
						'<meta charset="utf-8" />',
						`<meta charset="utf-8" />${nl}\t<meta name="Connectome-mini" /><!-- CAPTURE-ONLY -->`,
					),
	},
];

function stateFile(root) {
	return join(root, ".visual-capture", "originals.json");
}

export function applyCapturePatches(root) {
	if (existsSync(stateFile(root))) {
		throw new Error(`capture patches are already applied in ${root}; restore first`);
	}
	const originals = {};
	const applied = [];
	for (const patch of PATCHES) {
		const path = join(root, patch.file);
		if (!existsSync(path)) {
			continue;
		}
		const source = readFileSync(path, "utf8");
		const nl = source.includes("\r\n") ? "\r\n" : "\n";
		const patched = patch.apply(source, nl);
		if (patched !== source) {
			originals[patch.file] = source;
			writeFileSync(path, patched, "utf8");
			applied.push(`${patch.file}: ${patch.reason}`);
		}
	}
	mkdirSync(join(root, ".visual-capture"), { recursive: true });
	writeFileSync(stateFile(root), JSON.stringify(originals), "utf8");
	return applied;
}

export function restoreCapturePatches(root) {
	if (!existsSync(stateFile(root))) {
		return [];
	}
	const originals = JSON.parse(readFileSync(stateFile(root), "utf8"));
	for (const [file, source] of Object.entries(originals)) {
		writeFileSync(join(root, file), source, "utf8");
	}
	rmSync(join(root, ".visual-capture"), { recursive: true, force: true });
	return Object.keys(originals);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [command, root] = process.argv.slice(2);
	if (!root || (command !== "apply" && command !== "restore")) {
		console.error("usage: capture-only.mjs apply|restore <worktree>");
		process.exit(2);
	}
	const result = command === "apply" ? applyCapturePatches(root) : restoreCapturePatches(root);
	console.log(`${command}: ${result.length ? result.join("; ") : "nothing to do"}`);
}
