import type { MantineColorScheme } from "@mantine/core";
import { iconExplorer } from "~/icons";
import type {
	GlobalPage,
	GlobalPageInfo,
	ScaleStep,
	Selectable,
	SidebarMode,
	SyntaxTheme,
} from "./types";

export const INSTANCE_CONFIG = "instance.json";

export const SCALE_STEPS: Selectable<ScaleStep>[] = [
	{ label: "125%", value: "125" },
	{ label: "110%", value: "110" },
	{ label: "100%", value: "100" },
	{ label: "90%", value: "90" },
	{ label: "75%", value: "75" },
];

export const THEMES: Selectable<MantineColorScheme>[] = [
	{ label: "Automatic", value: "auto" },
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
];

export const SYNTAX_THEMES: Selectable<SyntaxTheme>[] = [
	{ label: "Default", value: "default" },
	{ label: "Vivid", value: "vivid" },
];

export const SIDEBAR_MODES: Selectable<SidebarMode>[] = [
	{ label: "Expandable", value: "expandable" },
	{ label: "Compact", value: "compact" },
	{ label: "Wide", value: "wide" },
];

export const GLOBAL_PAGES: Record<GlobalPage, GlobalPageInfo> = {
	"/overview": {
		id: "/overview",
		name: "Overview",
		icon: iconExplorer,
	},
};

export const JSON_FILTER = {
	name: "JSON File",
	extensions: ["json"],
};
