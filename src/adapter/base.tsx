import type {
	ConnectomeConfig,
	EstatePreview,
	EstateSelection,
	InstanceStatus,
	Platform,
	ServedEstate,
	UrlTarget,
} from "~/types";

export interface FileFilter {
	name: string;
	extensions: string[];
}

export interface ConnectomeAdapter {
	/**
	 * Identifier for this adapter
	 */
	id: string;

	/**
	 * Returns whether local database serving is supported
	 */
	isServeSupported: boolean;

	/**
	 * Returns whether update checking is supported
	 */
	isUpdateCheckSupported: boolean;

	/**
	 * Whether telemetry is enabled
	 */

	/**
	 * Whether the sample sandbox is enabled
	 */
	isSampleSandboxEnabled: boolean;

	/**
	 * What the titlebar offset is if applicable
	 */
	titlebarOffset: number;

	/**
	 * The currently active platform
	 */
	platform: Platform;

	/**
	 * Initialize any adapter specific services. This function is invoked
	 * after the config has been loaded.
	 */
	initialize(): Result<void>;

	/**
	 * Return debug information about the current environment of the adapter
	 */
	dumpDebug(): object;

	/**
	 * Set the window title
	 *
	 * @param title The title to set
	 */
	setWindowTitle(title: string): Promise<void>;

	/**
	 * Load the config from the adapter
	 */
	loadConfig(): Promise<any>;

	/**
	 * Process the config after loading it. At this point the config
	 * has been repaired and migrated to the latest version.
	 *
	 * @param config The config to process
	 */
	processConfig(config: ConnectomeConfig): Result<ConnectomeConfig>;

	/**
	 * Save the config to the adapter
	 *
	 * @param config The config to save
	 */
	saveConfig(config: ConnectomeConfig): Promise<void>;

	/**
	 * Serve the configured local estate: install it when the project has no
	 * estate yet, attach to it when another process already serves it, or
	 * start the engine on a loopback port, and wait until it is ready.
	 * Resolves with the served estate's coordinates.
	 */
	previewEstate(selection?: EstateSelection): Promise<EstatePreview>;
	serveEstate(acceptedPlanSha256?: string, selection?: EstateSelection): Promise<ServedEstate>;

	/**
	 * Every project instance the native registry tracks. It looks at each one
	 * first, and proves and attaches an instance started elsewhere for any of
	 * the known `projects`.
	 */
	projectInstances(projects: string[]): Promise<InstanceStatus>;

	/**
	 * Stop the engine this desktop started at the exact canonical project
	 * path, or dismiss its failure. An instance started elsewhere is never
	 * stopped. Resolves with whether an engine was stopped.
	 */
	stopEstate(project: string): Promise<boolean>;

	/**
	 * Open the given URL in the default browser
	 *
	 * @param url The URL to open
	 * @param target The target to open the URL in
	 */
	openUrl(url: string, target?: UrlTarget): Promise<void>;

	/**
	 * Save a file locally
	 */
	saveFile(
		title: string,
		defaultPath: string,
		filters: FileFilter[],
		content: () => Result<string | Blob | Response | null>,
	): Promise<boolean>;

	/**
	 * Open a file locally
	 */
	openFile(title: string, filters: FileFilter[], multiple: boolean): Promise<File[]>;

	/**
	 * Log a message to the implemented logging system
	 */
	log(label: string, message: string): void;

	/**
	 * Log a warning message to the implemented logging system
	 */
	warn(label: string, message: string): void;

	/**
	 * Log a trace message to the implemented logging system
	 */
	trace(label: string, message: string): void;
}
