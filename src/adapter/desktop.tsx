import { getHotkeyHandler } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api/core";
import { Event, listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { attachConsole, info, trace, warn } from "@tauri-apps/plugin-log";
import { arch, type } from "@tauri-apps/plugin-os";
import { open as openURL } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { compareVersions } from "compare-versions";
import { VIEW_PAGES } from "~/constants";
import { getSetting, overwriteConfig, watchStore } from "~/shared/util/config";
import { getConnection } from "~/shared/util/connection";
import { openAndReadFiles, openAndWriteFile } from "~/shared/util/file-system";
import { NavigateViewEvent } from "~/shared/util/global-events";
import { showErrorNotification, showInfo } from "~/shared/util/helpers";
import { dispatchIntent, handleIntentRequest } from "~/shared/util/intents";
import { ConfigStore, useConfigStore } from "~/shell/stores/config";
import { useInterfaceStore } from "~/shell/stores/interface";
import { useDatabaseStore } from "~/stores/database";
import type {
	ConnectomeConfig,
	EstatePreview,
	EstateStage,
	Platform,
	QueryTab,
	ServedEstate,
	ViewPage,
} from "~/types";
import { adapter } from ".";
import type { ConnectomeAdapter, FileFilter } from "./base";

interface Resource {
	File?: FileResource;
	Link?: LinkResource;
}

interface FileResource {
	success: boolean;
	name: string;
	path: string;
}

interface LinkResource {
	host: string;
	params: string;
}

/**
 * Connectome adapter for running as Wails desktop app
 */
export class DesktopAdapter implements ConnectomeAdapter {
	public readonly id: string = "desktop";

	public isServeSupported = true;
	public isUpdateCheckSupported = true;
	public isSampleSandboxEnabled = true;
	public titlebarOffset = 0;
	public platform: Platform = "windows";

	#arch: string = arch();
	#system: string = type();

	public constructor() {
		this.initDatabaseEvents();
		this.initWindowEvents();

		document.addEventListener("DOMContentLoaded", () => {
			setTimeout(() => {
				getCurrentWindow().show();
			}, 500);
		});

		document.addEventListener("contextmenu", (e) => {
			e.preventDefault();
		});

		document.body.addEventListener(
			"keydown",
			getHotkeyHandler([["mod+alt+i", () => invoke("toggle_devtools")]]),
		);

		getCurrentWindow().listen("config-updated", (event: Event<ConfigStore>) => {
			overwriteConfig(event.payload);
		});

		getCurrentWindow().listen("open-resource", () => {
			this.queryOpenRequest();
		});

		getCurrentWindow().listen("tauri://focus", () => {
			this.checkForUpdates();
		});
	}

	public async initialize() {
		await attachConsole();

		this.queryOpenRequest();
		this.checkForUpdates();

		if (this.platform === "darwin") {
			this.titlebarOffset = 15;
		} else {
			this.titlebarOffset = 32;
		}

		watchStore({
			initial: true,
			store: useConfigStore,
			select: (s) => s.settings.appearance.windowScale,
			then: (scale) => getCurrentWebview().setZoom(scale / 100),
		});

		watchStore({
			initial: true,
			store: useConfigStore,
			select: (s) => s.settings.behavior.windowPinned,
			then: (pinned) => {
				getCurrentWindow().setAlwaysOnTop(pinned);
			},
		});
	}

	public dumpDebug = () => ({
		Platform: "Desktop",
		OS: this.#system,
		Architecture: this.#arch,
		WebView: navigator.userAgent,
	});

	public async setWindowTitle(title: string) {
		getCurrentWindow().setTitle(title || "Connectome");
	}

	public async loadConfig() {
		switch (type()) {
			case "windows": {
				this.platform = "windows";
				break;
			}
			case "macos": {
				this.platform = "darwin";
				break;
			}
			case "linux": {
				this.platform = "linux";
				break;
			}
		}

		const config = await invoke<string>("load_config");

		return JSON.parse(config);
	}

	public async processConfig(config: ConnectomeConfig) {
		return config;
	}

	public saveConfig(config: ConnectomeConfig) {
		return invoke<void>("save_config", {
			config: JSON.stringify(config),
		});
	}

	public async previewEstate() {
		const { project, mode, executable } = useConfigStore.getState().settings.serving;
		return invoke<EstatePreview>("rrd_estate_preview", {
			request: { project, mode, executable },
		});
	}

	public async serveEstate(acceptedPlanSha256?: string) {
		const { project, mode, executable } = useConfigStore.getState().settings.serving;

		return invoke<ServedEstate>("rrd_estate_serve", {
			request: { project, mode, executable, accepted_plan_sha256: acceptedPlanSha256 },
		});
	}

	public async servedEstate() {
		return invoke<ServedEstate | null>("rrd_estate_status");
	}

	public async stopEstate() {
		return invoke<boolean>("rrd_estate_stop");
	}

	public async openUrl(url: string) {
		openURL(url);
	}

	public async saveFile(
		title: string,
		defaultPath: string,
		filters: any,
		content: () => Result<string | Blob | null>,
	): Promise<boolean> {
		// Attempt saving using the file picker
		if (await openAndWriteFile(content, defaultPath, filters)) {
			return true;
		}

		// Fall back to desktop dialog
		const filePath = await save({ title, defaultPath, filters });

		if (!filePath) {
			return false;
		}

		const result = await content();

		if (!result) {
			throw new Error("File is empty");
		}

		if (typeof result === "string") {
			await writeTextFile(filePath, result);
		} else {
			await writeFile(filePath, new Uint8Array(await result.arrayBuffer()));
		}

		return true;
	}

	public async openFile(
		title: string,
		filters: FileFilter[],
		multiple: boolean,
	): Promise<File[]> {
		const files = await openAndReadFiles(filters, multiple);

		if (Array.isArray(files)) {
			return files;
		}

		const result = await open({
			title,
			filters,
			multiple,
		});

		if (!result) {
			return [];
		}

		const paths: string[] = Array.isArray(result) ? result : [result];

		return Promise.all(
			paths.map(async (path) => {
				return new File([(await readFile(path)) as unknown as BlobPart], path);
			}),
		);
	}

	public toggleDevTools() {
		invoke("toggle_devtools");
	}

	public log(label: string, message: string) {
		info(`${label}: ${message}`);
	}

	public warn(label: string, message: string) {
		warn(`${label}: ${message}`);
	}

	public trace(label: string, message: string) {
		trace(`${label}: ${message}`);
	}

	public async checkForUpdates(force?: boolean) {
		const { lastPromptedVersion, setLastPromptedVersion } = useConfigStore.getState();
		const { setAvailableUpdate } = useInterfaceStore.getState();

		adapter.log("Updater", "Checking for updates");

		try {
			const result = await check();

			if (result) {
				const currentVersion = import.meta.env.VERSION;
				const latestVersion = result.version;

				adapter.log("Updater", `Current: ${currentVersion}, Latest: ${latestVersion}`);

				if (compareVersions(latestVersion, currentVersion) > 0) {
					const showAlert = force || result.version !== lastPromptedVersion;

					setAvailableUpdate(result, showAlert);
					setLastPromptedVersion(result.version);
				}
			} else {
				adapter.log("Updater", "No updates available");
			}
		} catch (err: any) {
			console.warn("Failed to check for updates", err);
		}
	}

	public readQueryFile(query: QueryTab) {
		return invoke<string>("read_query_file", { path: query.query });
	}

	public writeQueryFile(query: QueryTab, content: string) {
		return invoke<void>("write_query_file", { path: query.query, content });
	}

	public openQueryFile() {
		return invoke<string>("open_query_file");
	}

	public openInExplorer(query: QueryTab) {
		return invoke<void>("open_in_explorer", { path: query.query });
	}

	public pruneQueryFiles() {
		const { sandbox, connections } = useConfigStore.getState();
		const paths = [sandbox, ...connections]
			.flatMap((c) => c.queries)
			.filter((q) => q.type === "file")
			.map((q) => q.query);

		return invoke<void>("prune_allowed_files", { paths });
	}

	private initDatabaseEvents() {
		let throttleLevel = 0;

		setInterval(() => {
			throttleLevel = Math.max(0, throttleLevel - 1);
		}, 500);

		// Each boundary of the serve sequence, in the order the native process
		// reaches it: install (plan, apply), serve (announced), ready
		// (authenticated). The serving panel explains each one.
		listen<EstateStage>("estate:stage", (event) => {
			const stage = event.payload;
			const historySize = getSetting("serving", "historySize");

			this.log("Serve", `${stage.stage} ${stage.state}: ${stage.detail}`);

			useDatabaseStore.getState().pushStage(stage);
			useDatabaseStore
				.getState()
				.pushConsoleLine(`[${stage.stage}] ${stage.detail}`, historySize);
		});

		// The engine's own diagnostic output.
		listen<string>("estate:output", (event) => {
			if (throttleLevel > 50) {
				return;
			}

			const historySize = getSetting("serving", "historySize");

			useDatabaseStore.getState().pushConsoleLine(event.payload, historySize);
			throttleLevel++;
		});
	}

	private initWindowEvents() {
		getCurrentWindow().listen("window:open_settings", (e) =>
			dispatchIntent("open-settings", e.payload ? { tab: e.payload as string } : undefined),
		);
	}

	private async queryOpenRequest() {
		const { addQueryTab, setActiveQueryTab } = useConfigStore.getState();
		const resources = await invoke<Resource[]>("get_opened_resources");

		if (resources.length === 0) {
			return;
		}

		for (const { File, Link } of resources) {
			if (File) {
				const { success, name, path } = File;

				if (!success) {
					showErrorNotification({
						title: `Failed to open "${name}"`,
						content: `File exceeds maximum size limit`,
					});

					continue;
				}

				const connection = getConnection();

				if (!connection) {
					showInfo({
						title: "Connection required",
						subtitle: "Please open a connection before opening files",
					});
					return;
				}

				const existing = connection.queries.find(
					(q) => q.type === "file" && q.query === path,
				);

				if (existing) {
					setActiveQueryTab(connection.id, existing.id);
				} else {
					addQueryTab(connection.id, { type: "file", name: name, query: path });
				}

				NavigateViewEvent.dispatch("query");
				await invoke("clear_opened_resources");
			} else if (Link) {
				const { host, params } = Link;

				if (host) {
					const views = Object.keys(VIEW_PAGES) as ViewPage[];
					const target = views.find((v) => host === v);

					if (target) {
						NavigateViewEvent.dispatch(target);
					}
				}

				if (params) {
					const search = new URLSearchParams(params);
					const intent = search.get("intent");

					if (intent) {
						setTimeout(() => {
							handleIntentRequest(intent);
						});
					}
				}

				await invoke("clear_opened_resources");
			}
		}
	}
}
