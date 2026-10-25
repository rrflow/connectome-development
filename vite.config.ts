import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { compression } from "vite-plugin-compression2";
import { ViteImageOptimizer as images } from "vite-plugin-image-optimizer";
import { Mode, plugin as markdown } from "vite-plugin-markdown";
import { connectome, version } from "./package.json";

/**
 * The RRFlow engine Connectome is contracted to. `src-tauri/Cargo.lock` is
 * the one owner of that pin: the native client builds on `rrd-contract` at
 * exactly this revision, CI builds the engine from it, and the renderer shows
 * it. The crate version is RRFlow's product version.
 */
function pinnedEngine(): { version: string; revision: string } {
	const lock = readFileSync(
		fileURLToPath(new URL("src-tauri/Cargo.lock", import.meta.url)),
		"utf8",
	);
	const block = lock
		.split("[[package]]")
		.find((candidate) => /^name = "rrd-contract"$/m.test(candidate));
	const engineVersion = block?.match(/^version = "([^"]+)"$/m)?.[1];
	const revision = block?.match(/rrflow-development\?rev=([0-9a-f]{40})/)?.[1];
	if (!engineVersion || !revision) {
		throw new Error("src-tauri/Cargo.lock does not pin rrd-contract to one RRFlow revision");
	}
	return { version: engineVersion, revision };
}

const isTauri = !!process.env.TAURI_ENV_PLATFORM;
const isCompress = process.env.VITE_CONNECTOME_COMPRESS !== "false";
const isPreview = process.env.VITE_CONNECTOME_PREVIEW === "true";
const isDocker = process.env.VITE_CONNECTOME_DOCKER === "true";

const ENTRYPOINTS = {
	connectome: "/index.html",
};

export default defineConfig(({ mode }) => {
	// Required because we cannot pass a custom mode to tauri build
	mode = isPreview ? "preview" : mode;
	const engine = pinnedEngine();

	// Define base plugins
	const plugins: PluginOption[] = [
		images(),
		react(),
		markdown({
			mode: [Mode.HTML],
		}),
	];

	// Configure compression for web builds
	if (!isTauri && isCompress) {
		console.log("Compressing assets...");
		plugins.push(
			compression({
				// Vite's preview server and Tauri load the original artifacts. Compressed
				// files are optional deployment siblings; they must never replace WASM.
				deleteOriginalAssets: false,
				threshold: isDocker ? 100 : undefined,
				include: isDocker
					? /assets\/.+\.(html|xml|css|json|js|mjs|svg|wasm)$/
					: /\.(wasm)$/,
			}),
		);
	} else {
		console.log("Skipping compression for build");
	}

	return {
		plugins,
		clearScreen: false,
		envPrefix: ["VITE_", "TAURI_"],
		server: {
			port: 1420,
			strictPort: true,
		},
		build: {
			target: "es2020",
			minify: process.env.TAURI_DEBUG ? false : "esbuild",
			sourcemap: !!process.env.TAURI_DEBUG,
			rollupOptions: {
				input: !isTauri ? ENTRYPOINTS : undefined,
				output: {
					experimentalMinChunkSize: 5000,
					manualChunks: {
						react: ["react", "react-dom"],
						codemirror: [
							"codemirror",
							"@surrealdb/codemirror",
							"@surrealdb/lezer",
							"@replit/codemirror-indentation-markers",
						],
						mantime: ["@mantine/core", "@mantine/hooks", "@mantine/notifications"],
						rrflow: [
							"surrealdb",
							"@surrealdb/wasm",
							"@surrealdb/ql-wasm-v2",
							"@surrealdb/ql-wasm-v3",
						],
					},
				},
			},
		},
		esbuild: {
			supported: {
				"top-level-await": true, //browsers can handle top-level-await features
			},
		},
		resolve: {
			alias: {
				"~": fileURLToPath(new URL("src", import.meta.url)),
			},
		},
		css: {
			modules: {
				localsConvention: "dashesOnly",
			},
			preprocessorOptions: {
				scss: {
					additionalData: '@use "~/shared/assets/styles/mixins" as *;',
					api: "modern-compiler",
				},
			},
		},
		define: {
			"import.meta.env.DATE": JSON.stringify(new Date()),
			"import.meta.env.VERSION": JSON.stringify(version),
			"import.meta.env.CHANNEL": JSON.stringify(connectome.channel),
			"import.meta.env.RRFLOW_ENGINE_VERSION": JSON.stringify(engine.version),
			"import.meta.env.RRFLOW_ENGINE_REVISION": JSON.stringify(engine.revision),
			"import.meta.env.MODE": JSON.stringify(mode),
			"import.meta.env.GTM_ID": JSON.stringify(""),
		},
		optimizeDeps: {
			exclude: ["@surrealdb/wasm", "@surrealdb/ql-wasm-v2", "@surrealdb/ql-wasm-v3"],
			esbuildOptions: {
				target: "esnext",
			},
		},
		assetsInclude: [
			"**/@surrealdb/wasm/dist/*.wasm",
			"**/@surrealdb/ql-wasm-v2/dist/*.wasm",
			"**/@surrealdb/ql-wasm-v3/dist/*.wasm",
		],
	};
});
