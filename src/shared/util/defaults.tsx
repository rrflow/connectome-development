import type {
	Authentication,
	Connection,
	ConnectionSchema,
	ConnectomeConfig,
	ConnectomeSettings,
	QueryTab,
	QueryType,
} from "~/types";

import { newId } from "./helpers";

export const CONFIG_VERSION = 2;

export function createBaseConfig(): ConnectomeConfig {
	const settings = createBaseSettings();

	return {
		configVersion: CONFIG_VERSION,
		previousVersion: import.meta.env.VERSION,
		connections: [],
		sandbox: createSandboxConnection(settings),
		activeResource: "/overview",
		savedQueries: [],
		lastPromptedVersion: null,
		featureFlags: {},
		commandHistory: [],
		lastViewedNewsAt: null,
		openDesignerPanels: ["general"],
		keybindings: {},
		onboarding: [],
		settings,
	};
}

export function createBaseSettings(): ConnectomeSettings {
	return {
		behavior: {
			// Enabled after Connectome owns a signed RRFlow release feed.
			updateChecker: false,
			tableSuggest: true,
			variableSuggest: true,
			queryErrorChecker: true,
			enterConfirms: false,
			querySelectionExecution: true,
			querySelectionExecutionWarning: true,
			windowPinned: false,
			docsLanguage: "cli",
			versionCheckTimeout: 5,
			queryQuickClose: true,
			strictSandbox: false,
			sidekickPanel: false,
			recordDiagnostics: false,
			diagnosticsHistorySize: 300,
		},
		appearance: {
			colorScheme: "dark",
			syntaxTheme: "default",
			windowScale: 100,
			editorScale: 100,
			queryLineNumbers: true,
			inspectorLineNumbers: true,
			functionLineNumbers: true,
			resultWordWrap: true,
			autoCollapseDepth: 0,
			defaultResultMode: "combined",
			defaultNoneResultMode: "show",
			defaultResultFormat: "sql",
			defaultDiagramAlgorithm: "aligned",
			defaultDiagramDirection: "ltr",
			defaultDiagramStrategy: "NETWORK_SIMPLEX",
			defaultDiagramLineStyle: "metro",
			defaultDiagramLinkMode: "visible",
			defaultDiagramMode: "fields",
			defaultDiagramHoverFocus: "none",
			sidebarMode: "expandable",
			queryOrientation: "vertical",
			sidebarViews: {},
			disableAnimations: false,
		},
		templates: {
			list: [],
		},
		serving: {
			project: "",
			mode: "fresh",
			executable: "",
			historySize: 250,
		},
	};
}

export function createBaseAuthentication(): Authentication {
	return {
		protocol: "wss",
		hostname: "",
		username: "",
		password: "",
		mode: "root",
		database: "",
		namespace: "",
		token: "",
		access: "",
		accessFields: [],
	};
}

export function createBaseConnection(settings: ConnectomeSettings): Connection {
	const baseTab = createBaseQuery(settings, "config");

	return {
		id: newId(),
		name: "",
		target: "runtime",
		icon: 0,
		queries: [
			{
				...baseTab,
				name: "New query",
			},
		],
		activeQuery: baseTab.id,
		authentication: createBaseAuthentication(),
		pinnedTables: [],
		queryHistory: [],
		lastNamespace: "",
		lastDatabase: "",
		designerTableList: true,
		explorerTableList: true,
		queryTabList: true,
		diagramAlgorithm: "default",
		diagramDirection: "default",
		diagramStrategy: "NETWORK_SIMPLEX",
		diagramLineStyle: "default",
		diagramMode: "default",
		diagramLinkMode: "default",
		diagramHoverFocus: "default",
		graphqlQuery: "",
		graphqlVariables: "{}",
		graphqlShowVariables: false,
	};
}

export function createBaseQuery(settings: ConnectomeSettings, type: QueryType): QueryTab {
	return {
		id: newId(),
		type,
		query: "",
		name: "",
		variables: "{}",
		valid: true,
		resultMode: settings.appearance.defaultResultMode,
		resultFormat: settings.appearance.defaultResultFormat,
		noneResultMode: settings.appearance.defaultNoneResultMode,
		showVariables: false,
	};
}

export function createSandboxConnection(settings: ConnectomeSettings): Connection {
	const base = createBaseConnection(settings);

	return {
		...base,
		id: "sandbox",
		name: "Sandbox",
		lastNamespace: "sandbox",
		lastDatabase: "sandbox",
		authentication: {
			...base.authentication,
			protocol: "mem",
			mode: "none",
		},
	};
}

export function createConnectionSchema(): ConnectionSchema {
	return {
		root: {
			namespaces: [],
			defaults: {},
			accesses: [],
			users: [],
		},
		namespace: {
			databases: [],
			accesses: [],
			users: [],
		},
		database: {
			tables: [],
			accesses: [],
			users: [],
			functions: [],
			models: [],
			params: [],
		},
	};
}
