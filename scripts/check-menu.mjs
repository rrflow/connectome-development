import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Menu gate. The main menu is generated from the project's route files, so a
 * view is reachable exactly when its route file exists and declares a menu
 * entry. This gate keeps the owner's original Workbench menu as a floor: every
 * one of its seventeen views must exist as a route file. A view may move or be
 * renamed here, deliberately; it may never silently disappear.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routes = join(root, "src/routes/runtime/$id");

/** The original menu (RRFlow `crates/connectome-ui`, August 2026) and where each view lives now. */
export const FLOOR = {
	overview: "",
	connections: "system/connections",
	estates: "system/engines",
	tables: "knowledge/tables",
	models: "knowledge/models",
	visuals: "workbench/visuals",
	flight: "workbench/flights",
	stream: "activity/stream",
	traces: "reasoning/traces",
	graph: "knowledge/records",
	cluster: "system/cluster",
	capabilities: "system/capabilities",
	query: "workbench/query",
	runs: "reasoning/runs",
	claims: "knowledge/claims",
	routes: "reasoning/routes",
	activity: "activity/audit",
};

function files(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return files(path);
		return name.endsWith(".tsx") && !name.startsWith("-") ? [path] : [];
	});
}

const views = new Map();
const problems = [];
for (const path of files(routes)) {
	const relative = path.slice(routes.length + 1).replaceAll("\\", "/");
	if (relative === "route.tsx") continue;
	const view = relative
		.replace(/\.tsx$/, "")
		.replace(/(^|\/)index$/, "")
		.replace(/\/$/, "");
	const source = readFileSync(path, "utf8");
	const menu = source.match(/staticData:\s*{\s*menu:\s*{([\s\S]*?)}\s*,?\s*}/);
	if (!menu) {
		problems.push(
			`src/routes/runtime/$id/${relative}: a project view must declare staticData.menu`,
		);
		continue;
	}
	for (const field of ["label", "group", "order", "icon", "hint"]) {
		if (!new RegExp(`\\b${field}:`).test(menu[1])) {
			problems.push(`src/routes/runtime/$id/${relative}: menu entry has no ${field}`);
		}
	}
	views.set(view, relative);
}

for (const [original, view] of Object.entries(FLOOR)) {
	if (!views.has(view)) {
		problems.push(
			`the original "${original}" view has no route file (expected src/routes/runtime/$id/${view || "index"}.tsx)`,
		);
	}
}

if (problems.length > 0) {
	console.error("Menu gate failed:");
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log(
	`Menu holds: ${views.size} project views, all ${Object.keys(FLOOR).length} original views present.`,
);
