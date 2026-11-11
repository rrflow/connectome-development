import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Guide gate (sprint 016). A guide is data that points at the real window, so it
 * can go stale without a type error. Each guide must name an anchor the source
 * still marks with `data-guide`, end its steps on a signal the source still
 * emits, and leave no step without a way to finish.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = join(root, "src/features/runtime");
const folder = join(pages, "guides");

function sources(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return sources(path);
		return extname(name) === ".tsx" || extname(name) === ".ts" ? [path] : [];
	});
}

const text = sources(pages)
	.map((path) => readFileSync(path, "utf8"))
	.join("\n");
const anchors = new Set(
	[...text.matchAll(/data-guide(?:=|:\s*)["'`]([a-z-]+)["'`]/g)].map((match) => match[1]),
);
const signals = new Set(
	[...text.matchAll(/(?:signal\?\.\(|useGuideState\()\s*["'`]([a-z-]+)["'`]/g)].map(
		(match) => match[1],
	),
);
const routes = new Set([...text.matchAll(/route: "([a-z/]+)"/g)].map((match) => match[1]));

const problems = [];
const files = readdirSync(folder).filter((name) => /\.v\d+\.json$/.test(name));
let steps = 0;

for (const file of files) {
	const guide = JSON.parse(readFileSync(join(folder, file), "utf8"));
	const where = (index) => `${file} step ${index + 1}`;

	if (file !== `${guide.id}.v${guide.version}.json`) {
		problems.push(`${file}: the file name does not match its id and version`);
	}
	for (const [index, step] of guide.steps.entries()) {
		steps += 1;
		if (!anchors.has(step.anchor)) {
			problems.push(`${where(index)}: nothing marks data-guide="${step.anchor}"`);
		}
		if (step.route && !routes.has(step.route)) {
			problems.push(`${where(index)}: no tab has the route "${step.route}"`);
		}
		const last = index === guide.steps.length - 1;
		if (step.until && !signals.has(step.until)) {
			problems.push(`${where(index)}: nothing emits the signal "${step.until}"`);
		}
		if (!last && !step.until) {
			problems.push(`${where(index)}: only a guide's last step may end without a signal`);
		}
		if (last && step.until) {
			problems.push(`${where(index)}: the last step must end with Finish, not a signal`);
		}
		if (step.until && !step.action) {
			problems.push(`${where(index)}: a step that waits must say what to do`);
		}
	}
	if (!text.includes(`./${guide.id}.v${guide.version}.json`)) {
		problems.push(`${file}: the guide is not registered in guides/engine.tsx`);
	}
}

if (files.length === 0) problems.push("no guide files found");

if (problems.length > 0) {
	console.error(problems.join("\n"));
	process.exit(1);
}

console.log(`Guides hold: ${files.length} guides, ${steps} steps, every anchor and signal real.`);
