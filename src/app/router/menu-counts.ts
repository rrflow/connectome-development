import { create } from "zustand";
import type { MenuCountId } from "./menu";

/**
 * The live counts shown beside menu entries. The project layout writes what it
 * just read from the engine; a count that has not been read is absent, and the
 * menu then shows nothing rather than a remembered or invented number.
 */
export type MenuCounts = Partial<Record<MenuCountId, number>>;

interface MenuCountStore {
	project: string | null;
	counts: MenuCounts;
	report: (project: string, counts: MenuCounts) => void;
	clear: (project: string) => void;
}

export const useMenuCounts = create<MenuCountStore>((set) => ({
	project: null,
	counts: {},
	report: (project, counts) => set({ project, counts }),
	clear: (project) =>
		set((state) => (state.project === project ? { project: null, counts: {} } : state)),
}));
