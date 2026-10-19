import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { compression } from "vite-plugin-compression2";
import { ViteImageOptimizer as images } from "vite-plugin-image-optimizer";
import { Mode, plugin as markdown } from "vite-plugin-markdown";
import { engineProtocol, version } from "./package.json";

const isTauri = !!process.env.TAURI_ENV_PLATFORM;
const isCompress = process.env.VITE_CONNECTOME_COMPRESS !== "false";
const isPreview = process.env.VITE_CONNECTOME_PREVIEW === "true";
const isDocker = process.env.VITE_CONNECTOME_DOCKER === "true";

const ENTRYPOINTS = {
	connectome: "/index.html",
	mini_embed: "/tools/mini-embed.html",
};

const TOOLS = {
	"tools/mini-embed.html": "mini/run/index.html",
};

export default defineConfig(({ mode }) => {
	// Required because we cannot pass a custom mode to tauri build
	mode = isPreview ? "preview" : mode;

	// Define base plugins
	const plugins: PluginOption[] = [
		images(),
		react(),
		markdown({
			mode: [Mode.HTML],
		}),
		{
			name: "rename-html",
			enforce: "post",
			generateBundle(_, bundle) {
				for (const chunk of Object.values(bundle)) {
					if (TOOLS[chunk.fileName]) {
						const endpoint = TOOLS[chunk.fileName];
						const target = dirname(resolve("dist", endpoint));
						mkdirSync(target, { recursive: true });
						chunk.fileName = endpoint;
					}
				}
			},
		},
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
						codemirror: ["codemirror", "@replit/codemirror-indentation-markers"],
						mantime: ["@mantine/core", "@mantine/hooks", "@mantine/notifications"],
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
			"import.meta.env.RRFLOW_VERSION": JSON.stringify(engineProtocol),
			"import.meta.env.MODE": JSON.stringify(mode),
			"import.meta.env.GTM_ID": JSON.stringify(""),
		},
		optimizeDeps: {
			esbuildOptions: {
				target: "esnext",
			},
		},
	};
});
