import { isFunction, shake } from "radash";
import {
	createFileDefinition,
	openAndReadFiles,
	openAndWriteFile,
} from "~/shared/util/file-system";
import * as idxdb from "~/shared/util/idxdb";
import { CONFIG_KEY } from "~/shared/util/storage";
import type { ConnectomeConfig, EstatePreview, Platform, ServedEstate, UrlTarget } from "~/types";
import type { ConnectomeAdapter, FileFilter } from "./base";

/**
 * Base adapter for running as web app
 */
export class BrowserAdapter implements ConnectomeAdapter {
	public readonly id: string = "browser";

	public isServeSupported = false;
	public isUpdateCheckSupported = false;
	public isSampleSandboxEnabled = true;
	public titlebarOffset = 0;
	public platform: Platform = "windows";

	public initialize() {
		const platform = navigator.platform.toLowerCase();

		if (platform.includes("win")) {
			this.platform = "windows";
		} else if (platform.includes("mac") || platform.includes("darwin")) {
			this.platform = "darwin";
		} else if (platform.includes("linux")) {
			this.platform = "linux";
		}
	}

	public dumpDebug = () => ({
		Platform: "Web",
		Navigator: navigator.userAgent,
	});

	public async setWindowTitle(title: string) {
		document.title = title;
	}

	public async loadConfig() {
		const localStorageValue = localStorage.getItem(CONFIG_KEY);

		// NOTE legacy local storage config
		if (localStorageValue) {
			const config = localStorageValue || "{}";
			const parsed = JSON.parse(config);

			if (parsed.configVersion === undefined && Object.keys(parsed).length > 0) {
				return {};
			}

			return parsed;
		}

		return (await idxdb.getConfig()) || {};
	}

	public async processConfig(config: ConnectomeConfig) {
		return config;
	}

	public async saveConfig(config: ConnectomeConfig) {
		await idxdb.setConfig(shake(config, isFunction));
		localStorage.removeItem(CONFIG_KEY);
	}

	public async previewEstate(): Promise<EstatePreview> {
		throw new Error("Use the native desktop to start RRFlow");
	}

	public async serveEstate(): Promise<ServedEstate> {
		throw new Error("Not supported");
	}

	public async servedEstate(): Promise<ServedEstate | null> {
		return null;
	}

	public async stopEstate(): Promise<boolean> {
		throw new Error("Not supported");
	}

	public async openUrl(url: string, target?: UrlTarget) {
		window.open(url, target === "internal" ? "_self" : "_blank");
	}

	public async saveFile(
		_title: string,
		defaultPath: string,
		filters: FileFilter[],
		content: () => Result<string | Blob | Response | null>,
	): Promise<boolean> {
		// Attempt saving using the file picker
		if (await openAndWriteFile(content, defaultPath, filters)) {
			return true;
		}

		// Fall back to browser download
		const result = await content();

		if (!result) {
			throw new Error("File is empty");
		}

		const file = await createFileDefinition(result, defaultPath);
		const url = window.URL.createObjectURL(file);
		const el = document.createElement("a");

		el.style.display = "none";
		document.body.append(el);

		el.href = url;
		el.download = defaultPath;
		el.click();

		window.URL.revokeObjectURL(url);
		el.remove();

		return true;
	}

	public async openFile(
		_title: string,
		filters: FileFilter[],
		multiple: boolean,
	): Promise<File[]> {
		const files = await openAndReadFiles(filters, multiple);

		if (Array.isArray(files)) {
			return files;
		}

		const el = document.createElement("input");

		el.type = "file";
		el.style.display = "none";

		el.click();

		return new Promise((resolve, reject) => {
			el.addEventListener("change", async () => {
				resolve([...(el.files ?? [])]);
			});

			el.addEventListener("error", async () => {
				reject(new Error("Failed to read file"));
			});
		});
	}

	public log(label: string, message: string) {
		console.log(`${label}: ${message}`);
	}

	public warn(label: string, message: string) {
		console.warn(`${label}: ${message}`);
	}

	public trace(label: string, message: string) {
		console.debug(`${label}: ${message}`);
	}
}
