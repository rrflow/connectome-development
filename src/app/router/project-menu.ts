import type { AnyRoute } from "@tanstack/react-router";
import type { MenuCountId } from "./menu";

/** The path every project view lives under. */
export const PROJECT_ROUTE = "/runtime/$id";

export interface ProjectTab {
	label: string;
	icon: string;
	hint: string;
	count?: MenuCountId;
	/** The view's path under the project. */
	path: string;
}

export interface ProjectArea {
	/** The folder's name, which is also the first segment of every tab's path. */
	id: string;
	label: string;
	icon: string;
	hint: string;
	tabs: ProjectTab[];
}

const underProject = (fullPath: string) =>
	fullPath.slice(PROJECT_ROUTE.length).replace(/^\/+|\/+$/g, "");

/**
 * Builds the area rail and every area's tabs from the route tree. A folder's
 * `route.tsx` declares its area; each route file inside it that declares a menu
 * entry is a tab of that area. Nothing is listed by hand, so a view is a tab
 * exactly when its file sits in an area's folder.
 */
export function projectAreas(routes: Iterable<AnyRoute>): ProjectArea[] {
	const all = [...routes];
	const areas: { order: number; area: ProjectArea }[] = [];
	for (const route of all) {
		const declared = route.options.staticData?.area;
		const full: string = route.fullPath ?? "";
		if (!declared || !full.startsWith(`${PROJECT_ROUTE}/`)) continue;
		const id = underProject(full);
		const tabs = all
			.flatMap((candidate) => {
				const menu = candidate.options.staticData?.menu;
				const path: string = candidate.fullPath ?? "";
				if (!menu || !path.startsWith(`${full}/`)) return [];
				return [{ order: menu.order, tab: { ...menu, path: underProject(path) } }];
			})
			.sort((a, b) => a.order - b.order || a.tab.label.localeCompare(b.tab.label))
			.map(({ tab: { label, icon, hint, count, path } }) => ({
				label,
				icon,
				hint,
				count,
				path,
			}));
		if (tabs.length === 0) continue;
		areas.push({
			order: declared.order,
			area: { id, label: declared.label, icon: declared.icon, hint: declared.hint, tabs },
		});
	}
	return areas.sort((a, b) => a.order - b.order).map(({ area }) => area);
}

/** The area a project path belongs to: the folder it sits in. */
export function areaOf(areas: ProjectArea[], path: string): ProjectArea | undefined {
	return areas.find((area) => path === area.id || path.startsWith(`${area.id}/`));
}
