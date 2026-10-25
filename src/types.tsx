import type { ElementProps, MantineColorScheme } from "@mantine/core";
import { AboutMetadata } from "@tauri-apps/api/menu";
import type { FeatureFlagMap } from "~/shared/util/feature-flags";
import type { Duration } from "~/vendor/rrflow-client";

export type MiniAppearance = "normal" | "compact" | "plain";
export type AccessType = "JWT" | "RECORD";
export type BannerType = "info" | "warning" | "important";
export type AuthLevel = "root" | "namespace" | "database";
export type AuthType = "user" | "access";
export type Base = "ROOT" | "NAMESPACE" | "DATABASE";
export type ColorScheme = "light" | "dark";
export type DiagramAlgorithm = "default" | "aligned" | "spaced";
export type DiagramDirection = "default" | "ltr" | "rtl";
export type DiagramStrategy = "NETWORK_SIMPLEX" | "BRANDES_KOEPF" | "LINEAR_SEGMENTS";
export type DiagramLineStyle = "default" | "metro" | "straight" | "smooth";
export type DiagramLinks = "default" | "hidden" | "visible";
export type DiagramMode = "default" | "fields" | "summary" | "simple";
export type DiagramHoverFocus = "default" | "none" | "neighbours" | "chain" | "recursive";
export type InstallMode = "fresh" | "existing";
export type NoneResultMode = "default" | "show" | "hide" | "collapse";
export type Orientation = "horizontal" | "vertical";
export type Platform = "darwin" | "windows" | "linux";
export type Protocol = "http" | "https" | "ws" | "wss" | "mem" | "indxdb";
export type ResultFormat = "json" | "sql";
export type ResultMode = "table" | "single" | "combined" | "graph" | "live";
export type ScaleStep = "75" | "90" | "100" | "110" | "125" | "150";
export type SchemaMode = "schemaless" | "schemafull";
export type SidebarMode = "expandable" | "compact" | "wide" | "fill";
export type SourceMode = "schema" | "infer";
export type SyntaxTheme = "default" | "vivid";
export type TableType = "ANY" | "NORMAL" | "RELATION";
export type TableVariant = "normal" | "relation" | "view";
export type UrlTarget = "internal" | "external";
export type ViewRequirement = "database";
export type QueryType = "config" | "file";
export type AuthState = "unknown" | "loading" | "authenticated" | "unauthenticated";
export type MonitorType = "metrics" | "logs";
export type MonitorSeverity = "info" | "warning" | "error";
export type FunctionType = "function" | "model";
export type MigrationIssueSeverity = "might_break" | "will_break" | "breaking_resolution";
export type MigrationIssueKind = "incompatible feature";
export type MigrationIssueTruncation = "none" | "start" | "end" | "both";
export type AuthMode =
	| "none"
	| "root"
	| "namespace"
	| "database"
	| "token"
	| "access"
	| "access-signup";
export type GlobalPage = "/overview" | "/mini/new";
export type ViewPage =
	| "query"
	| "explorer"
	| "graphql"
	| "designer"
	| "authentication"
	| "functions"
	| "parameters"
	| "documentation"
	| "migrations";

export type AppMenuItemType =
	| "Separator"
	| "Copy"
	| "Cut"
	| "Paste"
	| "SelectAll"
	| "Undo"
	| "Redo"
	| "Minimize"
	| "Maximize"
	| "Fullscreen"
	| "Hide"
	| "HideOthers"
	| "ShowAll"
	| "CloseWindow"
	| "Quit"
	| "Services"
	| "Command"
	| "Custom"
	| {
			About: AboutMetadata | null;
	  };

export type CodeLang = "cli" | "rust" | "js" | "go" | "py" | "csharp" | "java" | "php" | "c";

export type OpenFn = (id: string | null) => void;
export type ColumnSort = [string, "asc" | "desc"];
export type KeyBindings = Record<string, string[]>;
export type Open<T> = T & { [key: string]: any };
export type FeatureCondition<R = boolean> = (flags: FeatureFlagMap) => R;
export type Selectable<T extends string = string> = { label: string; value: T };
export type Listable<T extends string = string> = Selectable<T> & {
	description?: string;
	icon?: string;
};
export type Snippets = Partial<Record<CodeLang, string>>;
export type Identified<T = object, I = string> = T & { id: I };
export type PartialId<T extends { id: I }, I = string> = Pick<T, "id"> & Partial<T>;
export type Assign<T, O extends object> = Omit<T, keyof O> & O;
export type AuthTarget = [AuthType, string];
export type Flags<T extends string> = Partial<Record<T, boolean>>;

export interface Authentication {
	mode: AuthMode;
	protocol: Protocol;
	hostname: string;
	username: string;
	password: string;
	namespace: string;
	database: string;
	token: string;
	access: string;
	accessFields: AccessField[];
}

export interface Connection {
	id: string;
	name: string;
	target?: "runtime" | "diagnostics" | "control-plane";
	runtimeInstance?: string;
	/** Path to the installed RRD operator credential file. A reference only: the native process reads it. */
	runtimeCredential?: string;
	icon: number;
	labels?: string[];
	instance?: boolean;
	lastNamespace: string;
	lastDatabase: string;
	queries: QueryTab[];
	activeQuery: string;
	queryHistory: HistoryQuery[];
	authentication: Authentication;
	pinnedTables: string[];
	diagramAlgorithm: DiagramAlgorithm;
	diagramDirection: DiagramDirection;
	diagramStrategy: DiagramStrategy;
	diagramLineStyle: DiagramLineStyle;
	diagramLinkMode: DiagramLinks;
	diagramHoverFocus: DiagramHoverFocus;
	diagramMode: DiagramMode;
	designerTableList: boolean;
	explorerTableList: boolean;
	queryTabList: boolean;
	graphqlQuery: string;
	graphqlVariables: string;
	graphqlShowVariables: boolean;
	graphLabels?: Record<string, string[]>;
	graphShowStray?: boolean;
	graphStraightEdges?: boolean;
}

export interface Template {
	id: string;
	name: string;
	icon: number;
	values: Authentication;
	labels?: string[];
}

export interface ConnectomeBehaviorSettings {
	updateChecker: boolean;
	tableSuggest: boolean;
	variableSuggest: boolean;
	queryErrorChecker: boolean;
	enterConfirms: boolean;
	querySelectionExecution: boolean;
	querySelectionExecutionWarning: boolean;
	windowPinned: boolean;
	docsLanguage: CodeLang;
	versionCheckTimeout: number;
	queryQuickClose: boolean;
	strictSandbox: boolean;
	sidekickPanel: boolean;
	recordDiagnostics: boolean;
	diagnosticsHistorySize: number;
}

export interface ConnectomeAppearanceSettings {
	colorScheme: MantineColorScheme;
	syntaxTheme: SyntaxTheme;
	windowScale: number;
	editorScale: number;
	queryLineNumbers: boolean;
	inspectorLineNumbers: boolean;
	functionLineNumbers: boolean;
	resultWordWrap: boolean;
	autoCollapseDepth: number;
	defaultResultMode: ResultMode;
	defaultResultFormat: ResultFormat;
	defaultNoneResultMode: NoneResultMode;
	defaultDiagramAlgorithm: DiagramAlgorithm;
	defaultDiagramDirection: DiagramDirection;
	defaultDiagramStrategy: DiagramStrategy;
	defaultDiagramLineStyle: DiagramLineStyle;
	defaultDiagramLinkMode: DiagramLinks;
	defaultDiagramMode: DiagramMode;
	defaultDiagramHoverFocus: DiagramHoverFocus;
	sidebarMode: SidebarMode;
	queryOrientation: Orientation;
	sidebarViews: Flags<ViewPage>;
	disableAnimations: boolean;
}

export interface ConnectomeTemplateSettings {
	list: Template[];
}

/**
 * How the desktop serves a local RRFlow estate. RRFlow has one storage
 * engine, picks its own loopback port, and keeps the operator credential in a
 * file the native process reads, so there is nothing else to configure.
 */
export interface ConnectomeServingSettings {
	/** The project directory that holds, or will hold, the estate. Empty means the app's default estate. */
	project: string;
	/** Installation mode used when the project has no estate yet. */
	mode: InstallMode;
	/** An explicit `rrflow` executable; empty means the one on PATH. */
	executable: string;
	historySize: number;
}

/** How the desktop chose the engine it ran. */
export type EngineSource = "override" | "sidecar" | "path";

/** The `rrflow` executable the desktop ran: where, how it was chosen, and what it hashes to. */
export interface EngineBinding {
	path: string;
	source: EngineSource;
	sha256: string;
	/** The RRFlow revision a bundled engine was built from. */
	revision?: string;
}

export interface EstateSelection {
	project: string;
	mode: InstallMode;
	executable: string;
}

export interface EstatePreview {
	project: string;
	mode: InstallMode;
	engine: EngineBinding;
	installation: { installation: { plan_sha256: string }; [key: string]: unknown } | null;
}

/** The estate the native process is serving, as the webview may see it: coordinates only. */
export interface ServedEstate {
	project: string;
	endpoint: string;
	instance: string;
	credential_path: string;
	installed: boolean;
	engine: EngineBinding;
}

export type EstateStageName = "engine" | "install" | "serve" | "ready";
export type EstateStageState = "running" | "done" | "skipped" | "failed" | "stopped";

/** One boundary of the serve sequence, reported by the native process as it is reached. */
export interface EstateStage {
	stage: EstateStageName;
	state: EstateStageState;
	detail: string;
}

export interface QueryResponse {
	success: boolean;
	result: any;
	duration?: Duration;
	type?: "live" | "kill" | "other";
}

export interface QueryTab {
	id: string;
	type: QueryType;
	query: string; // NOTE Query string for config type, path for file type
	name?: string;
	variables: string;
	valid: boolean; // TODO Remove
	resultMode: ResultMode;
	noneResultMode: NoneResultMode;
	resultFormat: ResultFormat;
	showVariables: boolean;
}

export interface HistoryQuery {
	id: string;
	query: string;
	timestamp: number;
	origin?: string;
}

export interface SavedQuery {
	id: string;
	query: string;
	name: string;
	tags: string[];
}

export interface ConnectomeSettings {
	behavior: ConnectomeBehaviorSettings;
	appearance: ConnectomeAppearanceSettings;
	templates: ConnectomeTemplateSettings;
	serving: ConnectomeServingSettings;
}

export interface ConnectomeConfig {
	configVersion: number;
	previousVersion: string;
	connections: Connection[];
	sandbox: Connection;
	activeResource: string;
	savedQueries: SavedQuery[];
	lastPromptedVersion: string | null;
	lastViewedNewsAt: number | null;
	settings: ConnectomeSettings; // TODO Rename to preferences and flatten inner objects
	keybindings: KeyBindings;
	featureFlags: Partial<FeatureFlagMap>;
	openDesignerPanels: string[];
	commandHistory: string[];
	onboarding: string[];
}

export interface AccessField {
	subject: string;
	value: string;
}

export interface AccessJwt {
	issuer: {
		alg: string;
		key: string;
	};
	verify:
		| {
				url: string;
		  }
		| {
				alg: string;
				key: string;
		  };
}

export interface TableView {
	expr: string;
	cond: string;
	group: string;
}

export interface Permissions {
	select: boolean | string;
	create: boolean | string;
	update: boolean | string;
	delete: boolean | string;
}

export interface Kind {
	kind: TableType;
	enforced?: boolean;
	in?: string[];
	out?: string[];
}

export type RootSchema = SchemaInfoKV;
export type NamespaceSchema = SchemaInfoNS;

export interface ConnectionSchema {
	root: RootSchema;
	namespace: NamespaceSchema;
	database: DatabaseSchema;
}

export interface DatabaseSchema {
	functions: SchemaFunction[];
	models: SchemaModel[];
	accesses: SchemaAccess[];
	tables: TableInfo[];
	users: SchemaUser[];
	params: SchemaParameter[];
}

export interface SchemaTable {
	name: string;
	drop: boolean;
	full: boolean; // 2.0
	schemafull?: boolean; // 3.0
	permissions: Permissions;
	kind: Kind;
	view?: string;
	changefeed?: { expiry: string; store_original: boolean };
}

export interface SchemaField {
	name: string;
	flex: boolean;
	readonly: boolean;
	kind?: string;
	value?: string;
	assert?: string;
	default?: string;
	permissions: Permissions;
}

export interface SchemaIndex {
	name: string;
	cols: string;
	index: string;
}

export interface SchemaEvent {
	name: string;
	when: string;
	then: string[];
}

export interface SchemaUser {
	name: string;
	hash: string;
	roles: string[];
	comment?: string;
	duration: {
		session: Duration;
		token: Duration;
	};
}

export interface SchemaAccess {
	name: string;
	authenticate?: string;
	comment?: string;
	duration: {
		session: Duration;
		token: Duration;
	};
	kind:
		| {
				kind: "JWT";
				jwt: AccessJwt;
		  }
		| {
				kind: "RECORD";
				signin: string;
				signup: string;
				jwt: AccessJwt;
		  };
}

export interface SchemaParameter {
	name: string;
	permissions: boolean | string;
	value: string;
	comment?: string;
}

export interface SchemaFunction {
	name: string;
	block: string;
	args: [string, string][];
	permissions: boolean | string;
	comment: string;
	returns: string;
}

export interface SchemaModel {
	name: string;
	hash: string;
	version: string;
	permission: boolean | string;
	comment: string;
}

export interface FunctionDetails {
	type: FunctionType;
	details: SchemaFunction | SchemaModel;
}

export interface TableInfo {
	schema: SchemaTable;
	fields: SchemaField[];
	indexes: SchemaIndex[];
	events: SchemaEvent[];
}

export interface SchemaNamespace {
	name: string;
}

export interface SchemaDatabase {
	name: string;
}

export interface SchemaInfoKV {
	namespaces: SchemaNamespace[];
	defaults: {
		namespace?: string;
		database?: string;
	};
	accesses: SchemaAccess[];
	users: SchemaUser[];
}

export interface SchemaInfoNS {
	databases: SchemaDatabase[];
	accesses: SchemaAccess[];
	users: SchemaUser[];
}

export interface SchemaInfoDB {
	functions: SchemaFunction[];
	params: SchemaParameter[];
	models: SchemaModel[];
	accesses: SchemaAccess[];
	tables: SchemaTable[];
	users: SchemaUser[];
	analyzers: any[]; // unused
}

export interface SchemaInfoTB {
	events: SchemaEvent[];
	fields: SchemaField[];
	indexes: SchemaIndex[];
	tables: any[]; // unused
}

export interface RRFlowOptions {
	connection: Authentication;
	onConnect?: (version: string) => void;
	onDisconnect?: (code: number, reason: string) => void;
	onError?: (error: string) => void;
}

export interface LiveMessage {
	id: string;
	action: string;
	queryId: string;
	timestamp: number;
	data: any;
}

export interface GlobalPageInfo {
	id: GlobalPage;
	name: string;
	icon: string;
	aliases?: string[];
	disabled?: (condition: GlobalCondition) => boolean;
}

export interface GlobalCondition {
	flags: FeatureFlagMap;
}

export interface ViewPageInfo {
	id: ViewPage;
	name: string;
	icon: string;
	anim?: any;
	disabled?: (condition: ViewCondition) => boolean;
}

export interface ViewCondition {
	flags: FeatureFlagMap;
	connection: string;
	version: string | null;
}

export interface Dataset {
	name: string;
	path: string;
}

export interface Driver {
	id: CodeLang;
	name: string;
	icon: React.FC<{ active?: boolean } & ElementProps<"svg">>;
	link: string;
}

export interface AppMenu {
	id: string;
	name: string;
	disabled?: boolean;
	items: AppMenuItem[];
}

export interface AppMenuItem {
	id: string;
	type: AppMenuItemType;
	name?: string;
	data?: any;
	disabled?: boolean;
	binding?: string[];
	action?: () => void;
}

export interface Monitor {
	id: string;
	type: MonitorType;
	name: string;
}

export interface MigrationDiagnosticLocation {
	column: number;
	kind: string;
	label: string;
	length: number;
	line: number;
	source: string;
	truncation: string;
}

export type MigrationDiagnosticResolution = {
	action: "ignore" | "fix";
};

export type MigrationKind =
	| "incompatible future"
	| "stored closure"
	| "all idiom"
	| "field idiom followed"
	| "function logical_and"
	| "function logical_or"
	| "function math::sqrt"
	| "function math::min"
	| "function math::max"
	| "mock value"
	| "number key ordering"
	| "id field"
	| "search index"
	| "analyze statement"
	| "record references"
	| "like operator"
	| "mtree index";

export type MigrationSeverity = "unlikely_break" | "can_break" | "will_break";

export type MigrationResourceType =
	| "kv-user"
	| "kv-access"
	| "ns-user"
	| "ns-access"
	| "db-user"
	| "db-api"
	| "db-access"
	| "db-param"
	| "db-function"
	| "db-tb-event"
	| "db-tb-index"
	| "db-tb-field"
	| "db-tb-record";

export interface MigrationDiagnosticResult {
	error: string;
	details: string;
	kind: MigrationKind;
	origin: string[];
	severity: MigrationSeverity;
	location?: MigrationDiagnosticLocation;
	resolution?: MigrationDiagnosticResolution;
}
