import "@xyflow/react/dist/style.css";
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import "mantine-contextmenu/styles.layer.css";

import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import "~/shared/assets/styles/layers.scss";
import "~/shared/assets/styles/global.scss";
import "~/shared/assets/styles/theme.scss";
import "~/shared/assets/styles/variants.scss";

import "../adapter";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { createRoot } from "react-dom/client";
import { startConfigSync } from "~/shared/util/config";
import { preloadImages } from "~/shared/util/preloader";
import { App } from "~/shell/components/App";
import { adapter } from "../adapter";
import { generateEditorIcons } from "../editor/icons";

(async () => {
	dayjs.extend(relativeTime);

	// Synchronize the config to the store
	await startConfigSync();

	// Initialize adapter
	await adapter.initialize();

	// Generate editor icons
	generateEditorIcons();

	// Render the app component
	const root = document.querySelector("#root");

	if (!root) {
		throw new Error("Root element not found");
	}

	createRoot(root).render(<App />);

	// Preload images
	preloadImages();
})();
