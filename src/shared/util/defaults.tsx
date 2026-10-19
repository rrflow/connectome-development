import type { Connection, ConnectomeConfig, ConnectomeSettings } from "~/types";
import { newId } from "./helpers";

/**
 * The stored configuration's version. Version 3 is the first RRD-only
 * configuration: profiles name an endpoint and a target, and nothing of the
 * inherited database client (sandbox, namespaces, query tabs, designer
 * options) is stored. `migrator.tsx` carries older files forward.
 */
export const CONFIG_VERSION = 3;

export const DEFAULT_RUNTIME_ENDPOINT = "http://127.0.0.1:9477";

export function createBaseConfig(): ConnectomeConfig {
	return {
		configVersion: CONFIG_VERSION,
		previousVersion: import.meta.env.VERSION,
		connections: [],
		activeResource: "/overview",
		lastPromptedVersion: null,
		featureFlags: {},
		commandHistory: [],
		keybindings: {},
		onboarding: [],
		settings: createBaseSettings(),
	};
}

export function createBaseSettings(): ConnectomeSettings {
	return {
		behavior: {
			// Enabled after Connectome owns a signed RRFlow release feed.
			updateChecker: false,
			enterConfirms: false,
			windowPinned: false,
			versionCheckTimeout: 5,
		},
		appearance: {
			colorScheme: "dark",
			syntaxTheme: "default",
			windowScale: 100,
			editorScale: 100,
			autoCollapseDepth: 0,
			sidebarMode: "expandable",
			disableAnimations: false,
		},
		serving: {
			project: "",
			mode: "fresh",
			executable: "",
			historySize: 250,
		},
	};
}

export function createBaseConnection(): Connection {
	return {
		id: newId(),
		name: "",
		icon: 0,
		target: "runtime",
		endpoint: DEFAULT_RUNTIME_ENDPOINT,
	};
}
