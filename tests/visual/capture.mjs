import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * Captures every inherited Connectome screen and graph (sprint 009,
 * decision 17) from one worktree's production build.
 *
 *   node tests/visual/capture.mjs --root <worktree> --out <dir> [--theme dark|light] [--port 4180]
 *
 * Build the worktree first with the inherited views enabled and the
 * capture-only patches applied (see README.md). The flow seeds the in-browser
 * Sandbox from `seed.surql`, then visits each view, result mode, drawer,
 * modal and settings tab in a fixed order at 1440x900. Each image is named
 * `<theme>-<state>.png`; `<theme>-capture-log.json` lists what was captured,
 * what failed and the page errors seen.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SEED = join(here, "seed.surql");
const args = Object.fromEntries(
	process.argv.slice(2).reduce((pairs, value, index, all) => {
		if (value.startsWith("--")) {
			pairs.push([value.slice(2), all[index + 1]]);
		}
		return pairs;
	}, []),
);
const root = resolve(args.root ?? ".");
const out = resolve(args.out ?? "visual-capture");
const theme = args.theme ?? "dark";
const port = Number(args.port ?? 4180);
const origin = `http://127.0.0.1:${port}`;
mkdirSync(out, { recursive: true });

const server = spawn(
	"npx",
	[
		"--yes",
		"pnpm@11.24.0",
		"exec",
		"vite",
		"preview",
		"--host",
		"127.0.0.1",
		"--port",
		String(port),
		"--strictPort",
	],
	{ cwd: root, shell: true, stdio: "ignore", detached: process.platform !== "win32" },
);
const stopServer = () => {
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
	} else {
		try {
			process.kill(-server.pid, "SIGTERM");
		} catch {
			// already stopped
		}
	}
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
	try {
		await fetch(origin);
		break;
	} catch {
		await wait(500);
	}
}
const browser = await chromium.launch();
const log = { theme, captured: [], failed: [], errors: [] };
const page = await browser.newPage({
	viewport: { width: 1440, height: 900 },
	colorScheme: theme,
	reducedMotion: "reduce",
});
// A fixed-seed Math.random, so the force-directed layouts start from the
// same positions on every run.
await page.addInitScript(() => {
	let state = 0x2f6b9a1d;
	Math.random = () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
});
page.on("pageerror", (e) => log.errors.push(e.message.slice(0, 200)));
const slug = (s) => s.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "");
const shot = async (name) => {
	await page.mouse.move(1439, 899);
	await wait(800);
	// Query timings differ on every run; they are masked, not compared.
	await page.screenshot({
		path: join(out, `${theme}-${name}.png`),
		mask: [
			page.locator(".cm-line").filter({ hasText: /Query \d+ \(\d/ }),
			page.getByText(/^\d+(\.\d+)?\s?(ns|us|µs|ms|s)$/),
		],
		maskColor: "#ff00ff",
	});
	log.captured.push(name);
};
const step = async (name, fn) => {
	try {
		await fn();
	} catch (e) {
		log.failed.push(`${name}: ${String(e.message).split("\n")[0].slice(0, 160)}`);
		await page.keyboard.press("Escape").catch(() => {});
		await wait(400);
	}
};
const view = async (label) => {
	await page.getByRole("button", { name: label, exact: true }).first().click();
	await wait(2500);
};
const run = async () => {
	await page.getByRole("button", { name: "Run query" }).last().click();
	await wait(3000);
};
const editorText = async (text) => {
	await page.locator(".cm-content").first().click();
	await page.keyboard.press("Control+a");
	await page.keyboard.insertText(text);
};

try {
	await page.goto(`${origin}/overview`, { waitUntil: "networkidle" });
	await step("disable-animations", async () => {
		await page.getByRole("button", { name: "Settings", exact: true }).first().click();
		await wait(1200);
		const row = page.getByText("Disable animations", { exact: true }).first();
		const box = row
			.locator("xpath=ancestor::*[.//input[@type='checkbox']][1]")
			.locator("input[type=checkbox]")
			.first();
		if (!(await box.isChecked())) {
			await box.check({ force: true });
		}
		log.animationsDisabled = await box.isChecked();
		await page.keyboard.press("Escape");
		await wait(800);
	});
	if (theme === "light") {
		await step("set-light-theme", async () => {
			await page.getByRole("button", { name: "Settings", exact: true }).first().click();
			await wait(1200);
			const index = await page
				.locator("input")
				.evaluateAll((els) => els.findIndex((e) => e.value === "Dark"));
			if (index < 0) throw new Error("theme input not found");
			await page.locator("input").nth(index).click();
			await wait(600);
			await page.getByRole("option", { name: "Light", exact: true }).first().click();
			await wait(800);
			await page.keyboard.press("Escape");
			await wait(800);
		});
	}
	await step("overview", () => shot("overview"));
	await step("open-sandbox", async () => {
		await page.keyboard.press("Control+k");
		await wait(500);
		await page.keyboard.type("Open the Sandbox", { delay: 10 });
		await wait(400);
		await shot("command-palette");
		await page.keyboard.press("Enter");
		await wait(6000);
		await shot("sandbox-onboarding");
		const cont = page.getByRole("button", { name: "Continue" });
		if (await cont.count()) {
			await cont.first().click();
			await wait(800);
		}
	});
	for (const tab of ["RRFlowQL Basics", "Graph Queries", "Vector Queries"]) {
		await step(`tab ${tab}`, async () => {
			await page.getByText(tab, { exact: true }).first().click();
			await wait(1200);
			await shot(`query-starter-${slug(tab)}`);
		});
	}
	await step("seed", async () => {
		await page.getByRole("button", { name: "New query" }).first().click();
		await wait(1000);
		await editorText(readFileSync(SEED, "utf8"));
		await run();
		await shot("query-seed-combined");
	});
	await step("graph-traversal", async () => {
		await editorText("SELECT * FROM person:ada->works_on->project;");
		await run();
		await shot("query-graph-traversal");
	});
	await step("result-modes", async () => {
		await editorText(
			"SELECT *, ->works_on->project AS projects, ->knows->person AS knows FROM person;",
		);
		await run();
		await page.getByRole("button", { name: "Change result mode" }).first().click();
		await wait(800);
		await shot("query-result-mode-menu");
		const items = (await page.getByRole("menuitem").allInnerTexts())
			.map((s) => s.trim())
			.filter(Boolean);
		log.resultModes = items;
		await page.keyboard.press("Escape");
		await wait(300);
		for (const label of items) {
			await step(`mode ${label}`, async () => {
				await page.getByRole("button", { name: "Change result mode" }).first().click();
				await wait(500);
				await page.getByRole("menuitem", { name: label }).first().click();
				// A force layout is captured only after it has come to rest.
				await wait(label.startsWith("Graph") ? 8000 : 2500);
				await shot(`query-result-${slug(label)}`);
			});
		}
	});
	await step("variables", async () => {
		await page.getByRole("button", { name: "Show variables" }).first().click();
		await wait(1000);
		await shot("query-variables");
	});
	await step("saved-queries", async () => {
		await page.getByText("Saved queries", { exact: true }).first().click();
		await wait(1200);
		await shot("query-saved");
		await page.keyboard.press("Escape");
	});
	await step("history", async () => {
		await page.getByText("Query history", { exact: true }).first().click();
		await wait(1200);
		await shot("query-history");
		await page.keyboard.press("Escape");
	});
	await step("explorer", async () => {
		await view("Data explorer");
		await shot("explorer");
		await page.getByText("person", { exact: true }).first().click();
		await wait(2000);
		await shot("explorer-person");
		await page.getByText("works_on", { exact: true }).first().click();
		await wait(2000);
		await shot("explorer-relation-table");
		await page.getByText("person", { exact: true }).first().click();
		await wait(1500);
		await page.getByText("person:ada", { exact: false }).first().click();
		await wait(2000);
		await shot("inspector-open");
		const tabs = ["Content", "Relations"];
		log.inspectorTabs = tabs;
		for (const t of tabs) {
			await step(`inspector ${t}`, async () => {
				await page.getByText(t, { exact: true }).last().click();
				await wait(1500);
				await shot(`inspector-${slug(t)}`);
			});
		}
		await page.keyboard.press("Escape");
		await wait(500);
	});
	await step("map", async () => {
		await view("Data explorer");
		await page.getByText("person", { exact: true }).first().click();
		await wait(1500);
		await page
			.getByText(/51° 30/)
			.first()
			.click();
		await wait(2000);
		await shot("geography-drawer");
		await page.keyboard.press("Escape");
	});
	await step("designer", async () => {
		await view("Data model");
		await wait(2500);
		await shot("designer-graph");
		await page.getByText("person", { exact: true }).first().click();
		await wait(2000);
		await shot("designer-table-drawer");
		await page.keyboard.press("Escape");
	});
	for (const [label, name] of [
		["GraphQL", "graphql"],
		["Authentication", "authentication"],
		["Parameters", "parameters"],
		["Functions", "functions"],
		["Runtime API", "documentation"],
	]) {
		await step(name, async () => {
			await view(label);
			await shot(name);
		});
	}
	await step("parameter-selected", async () => {
		await view("Parameters");
		await page.getByText("team", { exact: false }).first().click();
		await wait(1500);
		await shot("parameters-team");
	});
	await step("function-selected", async () => {
		await view("Functions");
		await page.getByText("greet", { exact: false }).first().click();
		await wait(1500);
		await shot("functions-greet");
	});
	await step("auth-user", async () => {
		await view("Authentication");
		await page.getByText("demo", { exact: true }).first().click();
		await wait(1500);
		await shot("authentication-user");
		await page.keyboard.press("Escape");
	});
	await step("record-creator", async () => {
		await view("Data explorer");
		await page.getByText("person", { exact: true }).first().click();
		await wait(1500);
		await page
			.getByRole("button", { name: /create record|new record/i })
			.first()
			.click();
		await wait(1500);
		await shot("explorer-record-creator");
		await page.keyboard.press("Escape");
	});
	await step("export-modal", async () => {
		await page.getByText("Export database", { exact: true }).first().click();
		await wait(1500);
		await shot("modal-export-database");
		await page.keyboard.press("Escape");
	});
	await step("import-modal", async () => {
		await page.getByText("Import database", { exact: true }).first().click();
		await wait(1500);
		await shot("modal-import-database");
		await page.keyboard.press("Escape");
	});
	await step("designer-options", async () => {
		await view("Data model");
		log.designerButtons = await page
			.getByRole("button")
			.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")).filter(Boolean));
		await page.getByRole("button", { name: "Graph options" }).first().click();
		await wait(1200);
		await shot("designer-options");
		await page.keyboard.press("Escape");
		await wait(400);
		await page.getByRole("button", { name: "Designer help" }).first().click();
		await wait(1200);
		await shot("designer-help");
		await page.keyboard.press("Escape");
	});
	await step("table-creator", async () => {
		await view("Data model");
		await page
			.getByRole("button", { name: /create table|new table/i })
			.first()
			.click();
		await wait(1500);
		await shot("modal-table-creator");
		await page.keyboard.press("Escape");
	});
	await step("connection-menu", async () => {
		await page.getByText("Sandbox", { exact: true }).first().click();
		await wait(1200);
		await shot("connection-menu");
		await page.keyboard.press("Escape");
	});
	await step("settings", async () => {
		await page.getByRole("button", { name: "Settings", exact: true }).first().click();
		await wait(1200);
		for (const t of [
			"Preferences",
			"Keybindings",
			"Templates",
			"Backup & Restore",
			"OSS Licenses",
			"About",
		]) {
			await step(`settings ${t}`, async () => {
				await page.getByText(t, { exact: true }).first().click();
				await wait(1000);
				await shot(`settings-${slug(t)}`);
			});
		}
		await page.keyboard.press("Escape");
		await wait(500);
	});
	await step("embed-generator", async () => {
		await page.goto(`${origin}/mini/new`, { waitUntil: "networkidle" });
		await wait(3000);
		await shot("mini-embed-generator");
		const src = await page.locator("iframe").last().getAttribute("src");
		log.miniRunnerUrl = src;
		if (src) {
			const query = new URL(src).search;
			await page.goto(`${origin}/mini/run/index.html${query}`, { waitUntil: "networkidle" });
			await wait(6000);
			await shot("mini-runner");
		}
	});
} finally {
	writeFileSync(join(out, `${theme}-capture-log.json`), JSON.stringify(log, null, 1));
	console.log(
		JSON.stringify(
			{
				theme,
				captured: log.captured.length,
				failed: log.failed,
				errors: log.errors.slice(0, 5),
			},
			null,
			1,
		),
	);
	await browser.close();
	stopServer();
}
process.exit(0);
