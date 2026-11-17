import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Menu gate. The area rail and the tabs are generated from the project's route
 * folders: a folder's `route.tsx` declares its area, and each route file in it
 * that declares a menu entry is a tab of that area. A view is reachable exactly
 * when its route file exists, sits in an area's folder and declares a tab. This
 * gate keeps the owner's original Workbench menu as a floor: every one of its
 * seventeen views must exist as a route file. A view may move or be renamed
 * here, deliberately; it may never silently disappear.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routes = join(root, "src/routes/runtime/$id");

/** The original menu (RRFlow `crates/connectome-ui`, August 2026) and where each view lives now. */
export const FLOOR = {
	overview: "overview",
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
const areaFolders = new Set();
for (const path of files(routes)) {
	const relative = path.slice(routes.length + 1).replaceAll("\\", "/");
	if (relative === "route.tsx") continue;
	if (relative === "index.tsx") continue;
	if (relative.endsWith("/route.tsx")) {
		const source = readFileSync(path, "utf8");
		const area = source.match(/staticData:\s*{\s*area:\s*{([\s\S]*?)}\s*,?\s*}/);
		const folder = relative.slice(0, -"/route.tsx".length);
		if (!area || folder.includes("/")) {
			problems.push(
				`src/routes/runtime/$id/${relative}: an area folder's route must declare staticData.area`,
			);
			continue;
		}
		for (const field of ["label", "order", "icon", "hint"]) {
			if (!new RegExp(`\\b${field}:`).test(area[1])) {
				problems.push(`src/routes/runtime/$id/${relative}: area has no ${field}`);
			}
		}
		areaFolders.add(folder);
		continue;
	}
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
	if (!relative.includes("/")) {
		problems.push(
			`src/routes/runtime/$id/${relative}: a project view must sit in an area's folder`,
		);
	} else if (/\bgroup:/.test(menu[1])) {
		problems.push(
			`src/routes/runtime/$id/${relative}: a tab never names its area; the folder is the area`,
		);
	}
	for (const field of ["label", "order", "icon", "hint"]) {
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

for (const view of views.keys()) {
	const folder = view.split("/")[0];
	if (!areaFolders.has(folder)) {
		problems.push(`${view}: its folder "${folder}" has no route.tsx declaring an area`);
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
