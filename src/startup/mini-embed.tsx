import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.css";
import "../rrflow/ui/styles.css";

import "~/shared/assets/styles/layers.scss";
import "~/shared/assets/styles/fonts.scss";
import "~/shared/assets/styles/global.scss";
import "~/shared/assets/styles/override.scss";
import "~/shared/assets/styles/variants.scss";

import "../adapter";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { createRoot } from "react-dom/client";
import { openConnection } from "~/screens/connectome/connection/connection";
import { MiniRunScreen } from "~/screens/mini-embed";
import { startConfigSync } from "~/shared/util/config";
import { handleWindowMessage } from "~/shared/util/messaging";
import { adapter } from "../adapter";
import type { MiniAdapter } from "../adapter/mini";

(async () => {
	dayjs.extend(relativeTime);

	// Synchronize the config to the store
	await startConfigSync();

	// Initialize adapter
	await adapter.initialize();

	// Render the app component
	const root = document.querySelector("#root");

	if (!root) {
		throw new Error("Root element not found");
	}

	createRoot(root).render(<MiniRunScreen />);

	// Connect and initialize the dataset
	openConnection().then(() => {
		setTimeout(() => {
			const adp = adapter as MiniAdapter;

			// Initialize the mini
			adp.initializeContent();

			// Notify the parent window that the app is ready
			adp.broadcastReady();
		}, 150);
	});

	// Listen for window messages
	window.addEventListener("message", handleWindowMessage, false);
})();
