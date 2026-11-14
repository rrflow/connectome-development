import type { AnyRoute } from "@tanstack/react-router";
import { MENU_GROUPS, type MenuCountId, type MenuGroupId } from "./menu";

/** The path every project view lives under. */
export const PROJECT_ROUTE = "/runtime/$id";

export interface ProjectMenuItem {
	label: string;
	icon: string;
	hint: string;
	count?: MenuCountId;
	/** The view's path under the project, empty for the project's first screen. */
	path: string;
}

export interface ProjectMenuGroup {
	id: MenuGroupId;
	label: string;
	items: ProjectMenuItem[];
}

/**
 * Builds the project menu from the route tree: one entry per route file under
 * the project that declares a menu entry, grouped and ordered as declared.
 * Nothing is listed here by hand, so a view is in the menu exactly when its
 * route file exists.
 */
export function projectMenu(routes: Iterable<AnyRoute>): ProjectMenuGroup[] {
	const entries: { group: MenuGroupId; order: number; item: ProjectMenuItem }[] = [];
	for (const route of routes) {
		const menu = route.options.staticData?.menu;
		const full: string = route.fullPath ?? "";
		if (!menu || !full.startsWith(PROJECT_ROUTE)) continue;
		entries.push({
			group: menu.group,
			order: menu.order,
			item: {
				label: menu.label,
				icon: menu.icon,
				hint: menu.hint,
				count: menu.count,
				path: full.slice(PROJECT_ROUTE.length).replace(/^\/+|\/+$/g, ""),
			},
		});
	}
	return MENU_GROUPS.map((group) => ({
		id: group.id,
		label: group.label,
		items: entries
			.filter((entry) => entry.group === group.id)
			.sort((a, b) => a.order - b.order || a.item.label.localeCompare(b.item.label))
			.map((entry) => entry.item),
	})).filter((group) => group.items.length > 0);
}
