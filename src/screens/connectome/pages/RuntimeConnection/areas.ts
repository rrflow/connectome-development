import { iconBrain, iconHome, iconRelation, iconServer } from "~/icons";

export interface WorkspaceTab {
	route: string;
	label: string;
}

export interface WorkspaceArea {
	id: string;
	label: string;
	icon: string;
	tabs: WorkspaceTab[];
}

/**
 * The project workspace's areas and tabs (sprint 016, parking lot 006). A tab is
 * listed only when its view is real, so an area joins this list when its first
 * view lands, and Ask, History and the rest of the August views arrive that way.
 */
export const WORKSPACE_AREAS: WorkspaceArea[] = [
	{
		id: "start",
		label: "Start",
		icon: iconHome,
		tabs: [{ route: "overview", label: "Home" }],
	},
	{
		id: "knowledge",
		label: "Knowledge",
		icon: iconRelation,
		tabs: [
			{ route: "knowledge/records", label: "Graph" },
			{ route: "knowledge/models", label: "Schema" },
			{ route: "knowledge/vectors", label: "Vectors" },
		],
	},
	{
		id: "reasoning",
		label: "Reasoning",
		icon: iconBrain,
		tabs: [{ route: "reasoning/tasks", label: "Tasks" }],
	},
	{
		id: "system",
		label: "System",
		icon: iconServer,
		tabs: [
			{ route: "system/instance", label: "Instance" },
			{ route: "system/storage", label: "Storage" },
			{ route: "system/api", label: "API reference" },
		],
	},
];

const ROUTES = new Set(WORKSPACE_AREAS.flatMap((area) => area.tabs.map((tab) => tab.route)));

/** Resolves a project address, including one saved before these areas, to its tab. */
export function workspaceRoute(section?: string, detail?: string): string {
	const route = detail ? `${section}/${detail}` : (section ?? "overview");
	if (ROUTES.has(route)) return route;
	if (route === "tasks") return "reasoning/tasks";
	if (route === "api") return "system/api";
	if (route === "knowledge/storage") return "system/storage";
	if (section === "knowledge") return "knowledge/records";
	if (section === "reasoning") return "reasoning/tasks";
	if (section === "system") return "system/instance";
	return "overview";
}

export function workspaceArea(route: string): WorkspaceArea {
	return (
		WORKSPACE_AREAS.find((area) => area.tabs.some((tab) => tab.route === route)) ??
		WORKSPACE_AREAS[0]
	);
}
