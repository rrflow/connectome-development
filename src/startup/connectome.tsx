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

import { RouterProvider } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { createRoot } from "react-dom/client";
import { router } from "~/app/router/router";
import { startConfigSync } from "~/shared/util/config/config";
import { preloadImages } from "~/shared/util/ui/preloader";
import { adapter } from "../adapter";
import { generateEditorIcons } from "../editor/core/icons";

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

	createRoot(root).render(<RouterProvider router={router} />);

	// Preload images
	preloadImages();
})();
