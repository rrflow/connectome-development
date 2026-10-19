import { isArray, isObject } from "radash";
import type { Connection, ConnectomeConfig } from "~/types";
import { createBaseConfig } from "./defaults";

/**
 * Carry a stored configuration forward to the current version.
 *
 * Policy:
 * - The config version is incremented only for backwards-breaking changes.
 * - Additions have a default in `defaults.tsx` or are computed here.
 *
 * Version 3 (2026-10-18) is the first RRD-only configuration. Older files
 * hold the inherited database client's profiles: SurrealDB-style
 * authentication (protocol, hostname, username, password, namespace,
 * database, token, access), query tabs, a sandbox, designer options and a
 * `templates` settings category. Only profiles that already targeted an RRD
 * runtime or a control plane are carried over — their endpoint is rebuilt
 * from `protocol://hostname` — and everything else is dropped rather than
 * reinterpreted. Nothing of the inherited model survives in version 3.
 */
export function applyMigrations(config: any): ConnectomeConfig {
	const version = typeof config.configVersion === "number" ? config.configVersion : -1;

	if (version < 3) {
		const base = createBaseConfig();
		const connections: Connection[] = [];

		if (isArray(config.connections)) {
			for (const legacy of config.connections) {
				const migrated = migrateLegacyProfile(legacy);
				if (migrated) {
					connections.push(migrated);
				}
			}
		}

		const settings = isObject(config.settings) ? config.settings : {};
		const behavior = isObject(settings.behavior) ? settings.behavior : {};
		const appearance = isObject(settings.appearance) ? settings.appearance : {};
		const serving = isObject(settings.serving) ? settings.serving : {};

		return {
			...base,
			previousVersion: typeof config.previousVersion === "string" ? config.previousVersion : base.previousVersion,
			connections,
			activeResource: "/overview",
			lastPromptedVersion: config.lastPromptedVersion ?? null,
			featureFlags: isObject(config.featureFlags) ? config.featureFlags : {},
			commandHistory: isArray(config.commandHistory) ? config.commandHistory : [],
			keybindings: isObject(config.keybindings) ? config.keybindings : {},
			onboarding: isArray(config.onboarding) ? config.onboarding : [],
			settings: {
				behavior: {
					...base.settings.behavior,
					...pick(behavior, ["updateChecker", "enterConfirms", "windowPinned", "versionCheckTimeout"]),
				},
				appearance: {
					...base.settings.appearance,
					...pick(appearance, [
						"colorScheme",
						"syntaxTheme",
						"windowScale",
						"editorScale",
						"autoCollapseDepth",
						"sidebarMode",
						"disableAnimations",
					]),
				},
				serving: {
					...base.settings.serving,
					...pick(serving, ["project", "mode", "executable", "historySize"]),
				},
			},
		};
	}

	return config;
}

/**
 * A pre-version-3 profile becomes a runtime or control-plane profile when it
 * already targeted one; the inherited database profiles have no RRD meaning
 * and are dropped.
 */
function migrateLegacyProfile(legacy: any): Connection | null {
	if (!isObject(legacy) || typeof legacy.id !== "string") {
		return null;
	}

	const target =
		legacy.target === "control-plane"
			? "control-plane"
			: legacy.target === "runtime" || legacy.target === "diagnostics"
				? "runtime"
				: null;

	if (!target) {
		return null;
	}

	const auth = isObject(legacy.authentication) ? legacy.authentication : {};
	const protocol = auth.protocol === "https" ? "https" : "http";
	const hostname = typeof auth.hostname === "string" ? auth.hostname : "";

	if (!hostname) {
		return null;
	}

	return {
		id: legacy.id,
		name: typeof legacy.name === "string" ? legacy.name : "",
		icon: typeof legacy.icon === "number" ? legacy.icon : 0,
		labels: isArray(legacy.labels) ? legacy.labels : undefined,
		target,
		endpoint: `${protocol}://${hostname}`,
		runtimeInstance: typeof legacy.runtimeInstance === "string" ? legacy.runtimeInstance : undefined,
		runtimeCredential:
			typeof legacy.runtimeCredential === "string" ? legacy.runtimeCredential : undefined,
		controlToken: target === "control-plane" && typeof auth.token === "string" ? auth.token : undefined,
	};
}

function pick<T extends object>(source: any, keys: (keyof T)[]): Partial<T> {
	const out: Partial<T> = {};
	for (const key of keys) {
		if (source[key] !== undefined) {
			out[key] = source[key];
		}
	}
	return out;
}
