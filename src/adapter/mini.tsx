import type { MantineColorScheme } from "@mantine/core";
import { ORIENTATIONS, RESULT_MODES } from "~/constants";
import { dedent } from "~/shared/util/dedent";
import {
	createBaseQuery,
	createBaseSettings,
	createSandboxConnection,
} from "~/shared/util/defaults";
import { showErrorNotification } from "~/shared/util/helpers";
import { getDatasetURL } from "~/shared/util/language";
import type { ConnectomeConfig, MiniAppearance, Orientation, ResultMode } from "~/types";
import { BrowserAdapter } from "./browser";

const THEMES = new Set(["light", "dark", "auto"]);

export class MiniAdapter extends BrowserAdapter {
	public readonly id: string = "mini";

	public isSampleSandboxEnabled = false;
	public appearance: MiniAppearance = "normal";
	public corners: string | undefined = undefined;
	public transparent = false;
	public linenumbers = false;
	public uniqueRef = "";
	public autorun = false;

	#datasetQuery: string | undefined;
	#setupQuery: string | undefined;

	public async loadConfig() {
		const settings = createBaseSettings();
		const mainTab = createBaseQuery(settings, "config");
		const params = new URL(document.location.toString()).searchParams;
		const version = await this.#getEmbeddedVersion();
		const { createRRFlowQL } = await import("~/shared/util/rrflowql");
		const rrflowql = createRRFlowQL(version);

		const {
			ref,
			query,
			variables,
			dataset,
			setup,
			theme,
			appearance,
			corners,
			transparent,
			orientation,
			linenumbers,
			autorun,
			resultmode,
			// deprecated
			compact,
			borderless,
		} = Object.fromEntries(params.entries());

		// Unique reference id
		if (ref !== undefined) {
			this.uniqueRef = ref;
		}

		// Appearance
		if (appearance !== undefined) {
			this.appearance = appearance as MiniAppearance;
		}

		// Panel corners
		if (corners !== undefined) {
			this.corners = corners;
		}

		// Hide titlebar (deprecated)
		if (compact !== undefined) {
			console.warn("The compact property is deprecated, please use appearance compact");
			this.appearance = "compact";
		}

		// Borderless (deprecated)
		if (borderless !== undefined) {
			console.warn("The borderless property is deprecated, please use appearance plain");
			this.appearance = "plain";
		}

		// Transparent background
		if (transparent !== undefined) {
			this.transparent = bool(transparent);
			document.body.style.backgroundColor = "transparent";
			document.documentElement.style.colorScheme = "unset";
		}

		// Initial query
		if (query) {
			mainTab.query = dedent(query);
		}

		// Initial variables
		if (variables) {
			try {
				const parsed = await rrflowql.parseValue(variables);
				mainTab.variables = await rrflowql.formatValue(parsed, false, true);
			} catch {
				showErrorNotification({
					title: "Startup error",
					content: "Variables could not be parsed",
				});
			}
		}

		// Premade dataset loading
		if (dataset) {
			const datasetUrl = getDatasetURL(version);

			if (datasetUrl) {
				this.#datasetQuery = await fetch(datasetUrl).then((res) => res.text());
			} else {
				showErrorNotification({
					title: "Startup error",
					content: "Dataset not recognised",
				});
			}
		}

		// Execute a startup query
		if (setup) {
			this.#setupQuery = setup;
		}

		// Interface theme
		if (theme) {
			if (THEMES.has(theme)) {
				settings.appearance.colorScheme = theme as MantineColorScheme;
			} else {
				showErrorNotification({
					title: "Startup error",
					content: "Theme not recognised",
				});
			}
		}

		// Orientation
		if (orientation) {
			if (ORIENTATIONS.some((o) => o.value === orientation)) {
				settings.appearance.queryOrientation = orientation as Orientation;
			} else {
				showErrorNotification({
					title: "Startup error",
					content: "Orientation not recognised",
				});
			}
		}

		// Result mode
		if (resultmode) {
			if (RESULT_MODES.some((m) => m.value === resultmode)) {
				mainTab.resultMode = resultmode as ResultMode;
			} else {
				showErrorNotification({
					title: "Startup error",
					content: "Result mode not recognised",
				});
			}
		}

		// Autorun query
		if (autorun !== undefined) {
			this.autorun = bool(autorun);
		}

		// Hide line numbers
		if (linenumbers !== undefined) {
			this.linenumbers = bool(linenumbers);
		}

		return {
			settings,
			sandbox: {
				...createSandboxConnection(settings),
				activeQuery: mainTab.id,
				queries: [mainTab],
			},
		} satisfies DeepPartial<ConnectomeConfig>;
	}

	public async saveConfig() {
		// noop
	}

	public initializeContent() {
		// The inherited query runner loads on demand, in the original order, so
		// the shared adapter selector that imports this class does not load the
		// inherited client into every page (sprint 009 Slice D0).
		import("~/screens/connectome/connection/connection").then(
			({ executeQuery, executeUserQuery }) => {
				if (this.#datasetQuery) {
					executeQuery(this.#datasetQuery);
				}

				if (this.#setupQuery) {
					executeQuery(this.#setupQuery);
				}

				if (this.autorun) {
					executeUserQuery();
				}
			},
		);
	}

	public broadcastReady() {
		const opts: any = {};

		if (this.uniqueRef) {
			opts.ref = this.uniqueRef;
		}

		// The embed's message channel runs queries through the inherited client,
		// so it loads on demand with the rest of this adapter's engine code.
		import("~/shared/util/messaging").then(({ broadcastMessage }) => {
			broadcastMessage("ready", opts);
		});
	}

	async #getEmbeddedVersion(): Promise<string> {
		const [{ RRFlow }, { createWasmEngines }] = await Promise.all([
			import("~/vendor/rrflow-client"),
			import("@surrealdb/wasm"),
		]);
		const rrflow = new RRFlow({
			engines: createWasmEngines(),
		});

		await rrflow.connect("mem://");

		try {
			return (await rrflow.version()).version.replace(/^rrflow-/, "");
		} finally {
			await rrflow.close();
		}
	}
}

function bool(value: string | undefined) {
	return value !== undefined && value !== "false";
}
