import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

/**
 * Captures the RRFlow-native desktop screens (sprint 009, decision 17): the
 * project engines dialog, the exact installation preview, serving, and every
 * runtime workbench lens on a seeded estate.
 *
 *   node tests/visual/capture-native.mjs --root <worktree> --exe <connectome.exe> \
 *     --engine-dir <dir holding rrflow.exe> --out <dir> [--theme dark|light] [--port 9333] \
 *     [--window 1440x1800]
 *
 * The default window is tall enough that each lens fits in one image. Pass a
 * real window size, such as 1440x900 or 1366x768, to capture what a person sees
 * without scrolling: sprint 016 judges every screen at a real window size.
 *
 * Build the desktop with `VITE_CONNECTOME_PREVIEW=true pnpm tauri build --debug
 * --no-bundle`: a preview build keeps its data in `RRFlow/ConnectomePreview`,
 * apart from the user's own Connectome data. The webview profile goes to a
 * scratch folder through `WEBVIEW2_USER_DATA_FOLDER`, and Playwright attaches
 * through WebView2's remote debugging port. After serving, the estate is
 * seeded with the lens fixture by the native test
 * `seed_served_estate_for_visual_capture`, which reads the operator credential
 * inside the native process; the capture only passes its path.
 */

const args = Object.fromEntries(
	process.argv.slice(2).reduce((pairs, value, index, all) => {
		if (value.startsWith("--")) {
			pairs.push([value.slice(2), all[index + 1]]);
		}
		return pairs;
	}, []),
);
const root = resolve(args.root ?? ".");
const exe = resolve(args.exe);
const engineDir = resolve(args["engine-dir"]);
const out = resolve(args.out ?? "visual-native");
const port = Number(args.port ?? 9333);
const theme = args.theme ?? "dark";
const [windowWidth, windowHeight] = (args.window ?? "1440x1800").split("x").map(Number);
mkdirSync(out, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = { captured: [], failed: [], steps: [] };
const answers = async () => {
	try {
		return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
	} catch {
		return false;
	}
};
// Something already answering on the port is an earlier run's webview; the
// capture would attach to it instead of the application it starts.
if (await answers()) {
	throw new Error(`port ${port} is already in use; stop the earlier Connectome first`);
}
const app = spawn(exe, [], {
	env: {
		...process.env,
		PATH: `${engineDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`,
		WEBVIEW2_USER_DATA_FOLDER: join(out, "webview2"),
		WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
	},
	stdio: "ignore",
});
const stopApp = () => {
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"], { stdio: "ignore" });
	} else {
		app.kill("SIGTERM");
	}
};

let page;
const slug = (s) => s.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "");
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Text that differs on every run: the estate's instance, project and estate
// identities (each installation draws a new identity), its loopback port,
// clock dates and times, the clock reading a query is pinned to, measured
// durations and the capture's own folder.
const VARIABLE_TEXT = [
	/(instance|project|estate)-[0-9a-f]{6,}/,
	/127\.0\.0\.1:\d+/,
	/\d{1,2}\/\d{1,2}\/\d{4}/,
	/\d{1,2}:\d{2}(:\d{2})?\s?[AP]M/,
	/(?<=AT VALID )\d+/,
	/\b\d+(\.\d+)?\s?(ms|µs|s)\b/,
	new RegExp(literal(out)),
].map((pattern) => pattern.source);
// Paints magenta, which the compare ignores, over exactly the characters that
// match, in text, in code editor lines and inside text fields, so the words
// around them stay in the image. A match scrolled out of its container is
// clipped to what shows.
const paintMasks = () =>
	page.evaluate((sources) => {
		const patterns = sources.map((source) => new RegExp(source, "g"));
		const matches = (text) =>
			patterns.flatMap((pattern) =>
				[...text.matchAll(pattern)].map((match) => [
					match.index,
					match.index + match[0].length,
				]),
			);
		const boxes = [];
		const add = (rects, element) => {
			for (const rect of rects) {
				let { left, top, right, bottom } = rect;
				for (let at = element; at && at !== document.body; at = at.parentElement) {
					const style = getComputedStyle(at);
					if (/hidden|auto|scroll|clip/.test(`${style.overflowX} ${style.overflowY}`)) {
						const clip = at.getBoundingClientRect();
						left = Math.max(left, clip.left);
						top = Math.max(top, clip.top);
						right = Math.min(right, clip.right);
						bottom = Math.min(bottom, clip.bottom);
					}
				}
				if (right > left && bottom > top) {
					boxes.push({ left, top, right, bottom });
				}
			}
		};
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (node.parentElement?.closest(".cm-line")) {
				continue;
			}
			for (const [start, end] of matches(node.nodeValue)) {
				const range = document.createRange();
				range.setStart(node, start);
				range.setEnd(node, end);
				add(range.getClientRects(), node.parentElement);
			}
		}
		// A code editor splits a line into one text node per token, so a match
		// is found in the whole line and painted across the nodes it spans.
		for (const line of document.querySelectorAll(".cm-line")) {
			const nodes = [];
			let text = "";
			const inLine = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
			for (let node = inLine.nextNode(); node; node = inLine.nextNode()) {
				nodes.push({ node, from: text.length });
				text += node.nodeValue;
			}
			const at = (offset, end) => {
				const found = nodes.findLast(({ from }) => (end ? from < offset : from <= offset));
				return [found.node, offset - found.from];
			};
			for (const [start, end] of matches(text)) {
				const range = document.createRange();
				range.setStart(...at(start, false));
				range.setEnd(...at(end, true));
				add(range.getClientRects(), line);
			}
		}
		// A field's value has no text node, so a hidden copy laid out like the
		// field locates the matching characters.
		for (const field of document.querySelectorAll("textarea, input")) {
			const value = field.value ?? "";
			const found = matches(value);
			if (found.length === 0) {
				continue;
			}
			const style = getComputedStyle(field);
			const frame = field.getBoundingClientRect();
			const copy = document.createElement("div");
			for (const property of [
				"fontFamily",
				"fontSize",
				"fontWeight",
				"fontStyle",
				"letterSpacing",
				"wordSpacing",
				"lineHeight",
				"paddingTop",
				"paddingRight",
				"paddingBottom",
				"paddingLeft",
				"borderTopWidth",
				"borderRightWidth",
				"borderBottomWidth",
				"borderLeftWidth",
				"boxSizing",
				"textIndent",
				"tabSize",
			]) {
				copy.style[property] = style[property];
			}
			Object.assign(copy.style, {
				position: "fixed",
				left: `${frame.left}px`,
				top: `${frame.top}px`,
				width: `${frame.width}px`,
				borderStyle: "solid",
				borderColor: "transparent",
				visibility: "hidden",
				whiteSpace: field.tagName === "TEXTAREA" ? "pre-wrap" : "pre",
				overflowWrap: "break-word",
			});
			document.body.append(copy);
			for (const [start, end] of found) {
				const mark = document.createElement("span");
				mark.textContent = value.slice(start, end);
				copy.replaceChildren(value.slice(0, start), mark, value.slice(end));
				add(mark.getClientRects(), field);
			}
			copy.remove();
		}
		for (const box of boxes) {
			const paint = document.createElement("div");
			paint.className = "visual-capture-mask";
			Object.assign(paint.style, {
				position: "fixed",
				left: `${box.left}px`,
				top: `${box.top}px`,
				width: `${box.right - box.left}px`,
				height: `${box.bottom - box.top}px`,
				background: "#ff00ff",
				zIndex: "2147483647",
				pointerEvents: "none",
			});
			document.body.append(paint);
		}
		return boxes.length;
	}, VARIABLE_TEXT);
const shot = async (name) => {
	await page.mouse.move(windowWidth - 1, windowHeight - 1);
	await wait(800);
	log.masks = { ...(log.masks ?? {}), [name]: await paintMasks() };
	try {
		// The project folder input scrolls its value, so it is masked whole.
		await page.screenshot({
			path: join(out, `native-${name}.png`),
			mask: [page.getByLabel("Project directory")],
			maskColor: "#ff00ff",
		});
	} finally {
		await page.evaluate(() => {
			for (const paint of document.querySelectorAll(".visual-capture-mask")) {
				paint.remove();
			}
		});
	}
	log.captured.push(name);
};
const note = async (name) => {
	const buttons = await page.evaluate(() =>
		[...document.querySelectorAll("button")]
			.map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim())
			.filter(Boolean),
	);
	log.steps.push({ name, url: page.url(), buttons: buttons.slice(-40) });
};
const step = async (name, fn) => {
	try {
		await fn();
		await note(name);
	} catch (e) {
		log.failed.push(`${name}: ${String(e.message).split("\n")[0].slice(0, 200)}`);
		await note(`${name} (failed)`).catch(() => {});
		// A dialog a failed step left open would block every later step.
		await page?.keyboard.press("Escape").catch(() => {});
		await page?.keyboard.press("Escape").catch(() => {});
	}
};
const invoke = (command, payload) =>
	page.evaluate(([c, p]) => window.__TAURI_INTERNALS__.invoke(c, p), [command, payload ?? {}]);
// The served estates, from either status shape: a list of served estates
// before step F4a, then every tracked instance with its lifecycle.
const servedEstates = async () => {
	const status = await invoke("rrd_estate_status", { request: { projects: [], executable: "" } });
	return Array.isArray(status)
		? status
		: (status?.instances ?? [])
				.filter((instance) => instance.state === "ready")
				.map((instance) => instance.estate);
};

try {
	let ready = false;
	for (let i = 0; i < 240 && !ready; i++) {
		ready = await answers();
		if (!ready) {
			await wait(500);
		}
	}
	if (!ready) {
		throw new Error("the webview debugging port never opened");
	}
	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
	const context = browser.contexts()[0];
	for (let i = 0; i < 40 && !page; i++) {
		page = context.pages()[0];
		await wait(250);
	}
	await page.setViewportSize({ width: windowWidth, height: windowHeight });
	// Times render in UTC, so a masked time is the same width on any machine.
	const cdp = await context.newCDPSession(page);
	await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
	// The first launch after a build can paint late, so the overview's own
	// content, not the fixed wait alone, says the window is ready.
	await page
		.getByRole("button", { name: "Start local RRFlow" })
		.first()
		.waitFor({ timeout: 60_000 });
	await wait(4000);
	if (theme === "light") {
		await step("set-light-theme", async () => {
			await page.getByRole("button", { name: "Settings", exact: true }).first().click();
			await wait(1200);
			const index = await page
				.locator("input")
				.evaluateAll((els) => els.findIndex((e) => e.value === "Dark"));
			if (index < 0) throw new Error("theme input not found");
			// Centred, so the preferences' sticky search bar does not cover it.
			await page
				.locator("input")
				.nth(index)
				.evaluate((input) => input.scrollIntoView({ block: "center" }));
			await wait(600);
			await page.locator("input").nth(index).click();
			await wait(600);
			await page.getByRole("option", { name: "Light", exact: true }).first().click();
			await wait(800);
			await page.keyboard.press("Escape");
			await wait(800);
		});
	}

	await step("overview", () => shot("overview"));
	await step("project-engines", async () => {
		await page.getByRole("button", { name: "Start local RRFlow" }).first().click();
		await wait(2000);
		await shot("project-engines");
	});
	await step("installation-preview", async () => {
		// A fresh project folder under the capture's output, so every run
		// installs and seeds its own estate.
		await page.getByLabel("Project directory").first().fill(join(out, "project"));
		await page.getByRole("button", { name: "Preview or open project" }).first().click();
		await wait(8000);
		await shot("installation-preview");
	});
	await step("install-and-serve", async () => {
		await page.getByRole("button", { name: "Install and open RRFlow" }).first().click();
		await wait(3000);
		await shot("serving-stages");
		for (let i = 0; i < 90; i++) {
			const served = await servedEstates();
			if (Array.isArray(served) && served.length > 0) {
				log.served = served.map((s) => ({
					endpoint: s.endpoint,
					instance: s.instance,
					project: s.project,
				}));
				break;
			}
			await wait(1000);
		}
		await wait(4000);
		await shot("served");
	});
	await step("seed", async () => {
		const [served] = await servedEstates();
		const seed = spawnSync(
			"cargo",
			[
				"test",
				"--manifest-path",
				join(root, "src-tauri", "Cargo.toml"),
				"--locked",
				"seed_served_estate_for_visual_capture",
				"--",
				"--ignored",
			],
			{
				env: {
					...process.env,
					CONNECTOME_CAPTURE_ENDPOINT: served.endpoint,
					CONNECTOME_CAPTURE_INSTANCE: served.instance,
					CONNECTOME_CAPTURE_CREDENTIAL: served.credential_path,
				},
				encoding: "utf8",
			},
		);
		log.seed = {
			status: seed.status,
			tail: `${seed.stdout ?? ""}`.split("\n").slice(-6).join("\n"),
		};
		if (seed.status !== 0) {
			throw new Error(`seeding failed: ${seed.stderr?.split("\n").slice(-4).join(" ")}`);
		}
	});
	await step("focused-visual-workbench", async () => {
		await page.goto(page.url().replace(/(\/runtime\/[^/]+).*/, "$1/reasoning/workbench"), {
			waitUntil: "domcontentloaded",
		});
		await page
			.getByRole("heading", { name: "Prompt workbench", exact: true })
			.waitFor({ timeout: 60000 });
		await page
			.getByLabel("Prompt", { exact: true })
			.fill("Inspect the temporary project's documents and relationships.");
		await page
			.getByRole("button", { name: "Launch observe flight", exact: true })
			.click({ timeout: 60000 });
		const flow = page.getByRole("heading", { name: "Recorded event flow", exact: true });
		await flow.waitFor({ timeout: 60000 });
		await flow.scrollIntoViewIfNeeded();
		if (
			(await page
				.getByRole("list", { name: "Recorded flight event sequence" })
				.locator("li")
				.count()) === 0
		)
			throw new Error("No returned flight events");
		await shot("workbench-event-flow");
		const records = page.getByText("Choose a record using the keyboard", { exact: true });
		await records.waitFor({ timeout: 60000 });
		await records.evaluate((el) => el.scrollIntoView({ block: "end" }));
		await wait(500);
		await shot("workbench-project-graph");
		const storage = page.getByRole("heading", { name: "rrflowKV storage path", exact: true });
		await storage.waitFor({ timeout: 60000 });
		await storage.evaluate((el) => el.scrollIntoView({ block: "start" }));
		await wait(500);
		await shot("workbench-storage-path");
	});
} finally {
	writeFileSync(join(out, "native-capture-log.json"), JSON.stringify(log, null, 1));
	console.log(
		JSON.stringify(
			{ captured: log.captured, failed: log.failed, served: log.served, seed: log.seed },
			null,
			1,
		),
	);
	stopApp();
}
process.exit(log.failed.length ? 1 : 0);
