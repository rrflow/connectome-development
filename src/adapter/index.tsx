import type { ConnectomeAdapter } from "./base";
import { BrowserAdapter } from "./browser";
import { DesktopAdapter } from "./desktop";
import { DockerAdapter } from "./docker";

const useDesktop = "__TAURI_INTERNALS__" in window;
const useDocker = import.meta.env.VITE_Connectome_DOCKER === "true";

/**
 * The active environment adapter
 */
export const adapter: ConnectomeAdapter = (() => {
	if (useDocker) {
		return new DockerAdapter();
	}

	if (useDesktop) {
		return new DesktopAdapter();
	}

	return new BrowserAdapter();
})();

export const isDesktop = adapter instanceof DesktopAdapter;
export const isBrowser = adapter instanceof BrowserAdapter;
export const isDocker = adapter instanceof DockerAdapter;
