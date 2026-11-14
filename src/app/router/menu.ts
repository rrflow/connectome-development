/**
 * What a route file declares to appear in the main menu. The menu is built
 * from the route tree, so a view exists there exactly when its route file does.
 */
export interface MenuEntry {
	/** The name a person reads in the menu. */
	label: string;
	/** The menu group this view sits under. */
	group: MenuGroupId;
	/** Position inside its group, lowest first. */
	order: number;
	icon: string;
	/** One plain sentence shown on hover, for someone new to the product. */
	hint: string;
	/** The live count shown beside the entry, named by its source. */
	count?: MenuCountId;
}

export const MENU_GROUPS = [
	{ id: "start", label: "Start" },
	{ id: "workbench", label: "Workbench" },
	{ id: "knowledge", label: "Knowledge" },
	{ id: "engine", label: "Engine" },
	{ id: "reasoning", label: "Reasoning" },
	{ id: "activity", label: "Activity" },
	{ id: "system", label: "System" },
] as const;

export type MenuGroupId = (typeof MENU_GROUPS)[number]["id"];

/** Counts the project layout reads live from the engine; never a stored number. */
export type MenuCountId =
	| "connections"
	| "engines"
	| "tables"
	| "models"
	| "collections"
	| "flights"
	| "tasks"
	| "capabilities";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		menu?: MenuEntry;
	}
}
