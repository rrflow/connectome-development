import type { MantineColorScheme } from "@mantine/core";
import { AboutMetadata } from "@tauri-apps/api/menu";
import type { FeatureFlagMap } from "~/shared/util/feature-flags";

/*
 * Connectome's renderer model. Every wire shape of RRD comes from the
 * generated `@rrflow/rrd-client` SDK or the native `rrd-client` views in
 * `~/rrflow/*`; nothing here mirrors the contract. These types describe the
 * client's own state: profiles, settings, the served estate, and the shell.
 */

export type ColorScheme = "light" | "dark";
export type InstallMode = "fresh" | "existing";
export type Platform = "darwin" | "windows" | "linux";
export type ScaleStep = "75" | "90" | "100" | "110" | "125" | "150";
export type SidebarMode = "expandable" | "compact" | "wide" | "fill";
export type SyntaxTheme = "default" | "vivid";
export type UrlTarget = "internal" | "external";
export type GlobalPage = "/overview";

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
export type Identified<T = object, I = string> = T & { id: I };
export type PartialId<T extends { id: I }, I = string> = Pick<T, "id"> & Partial<T>;
export type Assign<T, O extends object> = Omit<T, keyof O> & O;
export type Flags<T extends string> = Partial<Record<T, boolean>>;

/** What a profile connects to: a project's RRD runtime, or an enterprise control plane. */
export type ConnectionTarget = "runtime" | "control-plane";

/**
 * A saved profile. A runtime profile names an RRD endpoint (loopback HTTP or
 * remote HTTPS) and, once verified, the instance identity it must keep
 * matching; the operator credential, when one exists, is a file path the
 * native process reads — the renderer never holds a key or a session token.
 */
export interface Connection {
	id: string;
	name: string;
	icon: number;
	labels?: string[];
	target: ConnectionTarget;
	/** The origin Connectome talks to, `http://127.0.0.1:9477` or `https://host`. */
	endpoint: string;
	/** The RRD instance id the endpoint must present; empty until the first handshake pins it. */
	runtimeInstance?: string;
	/** Path to the installed RRD operator credential file. A reference only: the native process reads it. */
	runtimeCredential?: string;
	/** Bearer token for an enterprise control plane; empty for runtime profiles. */
	controlToken?: string;
}

export interface ConnectomeBehaviorSettings {
	updateChecker: boolean;
	enterConfirms: boolean;
	windowPinned: boolean;
	versionCheckTimeout: number;
}

export interface ConnectomeAppearanceSettings {
	colorScheme: MantineColorScheme;
	syntaxTheme: SyntaxTheme;
	windowScale: number;
	editorScale: number;
	autoCollapseDepth: number;
	sidebarMode: SidebarMode;
	disableAnimations: boolean;
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

export type EngineSource = "override" | "sidecar" | "path";

/** The `rrflow` executable the desktop ran: where, how it was chosen, and what it hashes to. */
export interface EngineBinding {
	path: string;
	source: EngineSource;
	sha256: string;
	/** The RRFlow revision a bundled engine was built from. */
	revision?: string;
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

export interface ConnectomeSettings {
	behavior: ConnectomeBehaviorSettings;
	appearance: ConnectomeAppearanceSettings;
	serving: ConnectomeServingSettings;
}

export interface ConnectomeConfig {
	configVersion: number;
	previousVersion: string;
	connections: Connection[];
	activeResource: string;
	lastPromptedVersion: string | null;
	settings: ConnectomeSettings;
	keybindings: KeyBindings;
	featureFlags: Partial<FeatureFlagMap>;
	commandHistory: string[];
	onboarding: string[];
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
