/**
 * What a folder's own `route.tsx` declares to be an area of the project: one
 * entry on the area rail. Its tabs are the route files inside that folder, so
 * an area exists exactly when its folder does, and moving a route file into
 * another folder moves its tab to that area.
 */
export interface AreaEntry {
	/** The name a person reads on the rail. */
	label: string;
	/** Position on the rail, lowest first. */
	order: number;
	icon: string;
	/** One plain sentence shown on hover, for someone new to the product. */
	hint: string;
}

/**
 * What a route file declares to appear as a tab in its folder's area. The area
 * is the folder, so a tab never names it.
 */
export interface MenuEntry {
	/** The name a person reads on the tab. */
	label: string;
	/** Position inside its area, lowest first. */
	order: number;
	icon: string;
	/** One plain sentence shown on hover, for someone new to the product. */
	hint: string;
	/** The live count shown beside the tab, named by its source. */
	count?: MenuCountId;
}

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
		area?: AreaEntry;
		menu?: MenuEntry;
	}
}
