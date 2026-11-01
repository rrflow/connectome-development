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
 *     --engine-dir <dir holding rrflow.exe> --out <dir> [--theme dark|light] [--port 9333]
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
	await page.mouse.move(1439, 1799);
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
	// Tall enough that each lens, its graph and its map fit in one image.
	await page.setViewportSize({ width: 1440, height: 1800 });
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
	await step("workbench", async () => {
		await page.reload({ waitUntil: "domcontentloaded" });
		await wait(6000);
		await shot("workbench-overview");
	});
	const workbench = page.url();
	const back = async () => {
		await page.goto(workbench, { waitUntil: "domcontentloaded" });
		await wait(4000);
	};
	for (const tab of ["Knowledge", "Activity", "Learning", "Services", "API reference"]) {
		await step(`tab ${tab}`, async () => {
			await back();
			await page
				.getByRole("tab", { name: tab })
				.or(page.getByRole("button", { name: tab, exact: true }))
				.first()
				.click();
			await wait(3000);
			await shot(`workbench-${slug(tab)}`);
		});
	}
	await step("api-reference-states", async () => {
		await back();
		await page.getByRole("button", { name: "API reference", exact: true }).first().click();
		await wait(4000);
		// The topic list jumps to an operation and follows the article in view.
		const topics = page.getByRole("navigation", { name: "API topics" });
		const active = () => topics.locator('[aria-current="true"]').innerText();
		const expect = async (what, wanted) => {
			const shown = await active();
			if (shown !== wanted)
				throw new Error(`${what}: the topic list shows "${shown}", not "${wanted}"`);
		};
		const query = "Run a bounded rrflowQL query at one read stamp";
		await topics.getByText(query, { exact: true }).click();
		await wait(2500);
		await expect("after a jump", query);
		await shot("api-reference-query");
		// Opening the language list scrolls back to the top, where the first
		// operation is the one in view.
		await page.getByLabel("Example language").first().click();
		await wait(600);
		await page.getByRole("option", { name: "Python", exact: true }).first().click();
		await wait(1500);
		const first = await topics.getByRole("button").first().innerText();
		await expect("at the top", first);
		await shot("api-reference-python");
		// Leave the saved language as it was for later runs.
		await page.getByLabel("Example language").first().click();
		await wait(600);
		await page.getByRole("option", { name: "CLI", exact: true }).first().click();
		await wait(800);
		// Scrolling by hand moves the active topic to an article in view.
		await page.mouse.move(1000, 1200);
		await page.mouse.wheel(0, 4000);
		await wait(1500);
		// Both the article and its topic are in view.
		const inView = await topics.locator('[aria-current="true"]').evaluate((topic) => {
			const article = document.getElementById(`api-${topic.getAttribute("data-topic")}`);
			const list = topic.closest("nav");
			if (!article || !list) return false;
			const page = article.getBoundingClientRect();
			const bounds = list.getBoundingClientRect();
			const item = topic.getBoundingClientRect();
			return (
				page.bottom > 0 &&
				page.top < window.innerHeight &&
				item.top >= bounds.top &&
				item.bottom <= bounds.bottom
			);
		});
		const scrolledTo = await active();
		if (scrolledTo === first || !inView) {
			throw new Error(
				`after scrolling, the topic list shows "${scrolledTo}", and it or its article is out of view`,
			);
		}
		log.apiReferenceScrolledTo = scrolledTo;
	});
	for (const card of ["Data models", "Records & relations", "Vectors", "Storage engine"]) {
		await step(`lens ${card}`, async () => {
			await back();
			await page.getByText(card, { exact: true }).first().click();
			await wait(4000);
			await shot(`lens-${slug(card)}`);
			log.lensUrls = { ...(log.lensUrls ?? {}), [card]: page.url() };
		});
	}
	await step("records-graph-states", async () => {
		await page.goto(log.lensUrls["Records & relations"], { waitUntil: "domcontentloaded" });
		await wait(5000);
		const find = page.getByLabel("Find a record").first();
		await find.click();
		await find.fill("a1");
		await wait(800);
		await page.getByRole("option").first().click();
		await wait(3000);
		await shot("records-selected");
		await page.getByText("Around the selection", { exact: true }).first().click();
		await wait(3000);
		await shot("records-around-selection");
		await page.getByLabel("Color by").first().click();
		await wait(600);
		const options = (await page.getByRole("option").allInnerTexts())
			.map((t) => t.trim())
			.filter(Boolean);
		log.colorBy = options;
		const kind = options.find((o) => /kind/i.test(o)) ?? options[options.length - 1];
		await page.getByRole("option", { name: kind }).first().click();
		await wait(3000);
		await shot(`records-color-${slug(kind)}`);
	});
	const lens = async (card) => {
		await page.goto(log.lensUrls[card], { waitUntil: "domcontentloaded" });
		await wait(5000);
	};
	const into = async (locator) => {
		await locator.scrollIntoViewIfNeeded();
		await wait(1200);
	};
	await step("records-query", async () => {
		await lens("Records & relations");
		const find = page.getByLabel("Find a record").first();
		await find.click();
		await find.fill("a1");
		await wait(800);
		await page.getByRole("option").first().click();
		await wait(3000);
		await page.getByRole("button", { name: "Query", exact: true }).first().click();
		await wait(3000);
		await into(page.getByRole("button", { name: "Run query" }).first());
		await shot("records-query");
		const traverse = page
			.getByRole("button", { name: /^Traverse .* from the selection$/ })
			.first();
		log.traverse = await traverse.innerText();
		await traverse.click();
		await wait(3000);
		await into(page.getByRole("button", { name: "Run query" }).first());
		await shot("records-traverse");
		// A query the engine refuses, typed where the console takes text (a
		// text area or a code editor) and run: what the engine said, and where.
		// An autosizing text area keeps a hidden copy, so only shown fields count.
		await page.locator("textarea:visible, .cm-content:visible").last().click();
		await page.keyboard.press("Control+A");
		await page.keyboard.type("FROM record:document AT VALID 1 KNOWN");
		await page.getByRole("button", { name: "Run query" }).first().click();
		await wait(3000);
		await into(page.getByRole("button", { name: "Run query" }).first());
		await shot("records-refused");
	});
	await step("vectors-points", async () => {
		await lens("Vectors");
		await page.getByRole("button", { name: "Browse points" }).first().click();
		await wait(2500);
		await into(page.getByRole("button", { name: "Hide points" }).first());
		await shot("vectors-points");
		await page
			.locator("table")
			.filter({ hasText: "First numbers" })
			.locator("button")
			.first()
			.click();
		await wait(4000);
		await into(page.getByText("Selected record", { exact: true }).first());
		await shot("vectors-nearest");
	});
	await step("storage-details", async () => {
		await lens("Storage engine");
		await page.getByRole("button", { name: "Show every engine counter" }).first().click();
		await wait(1500);
		await into(page.getByRole("button", { name: "Hide every engine counter" }).first());
		await shot("storage-counters");
		await page.getByRole("button", { name: "Show details" }).first().click();
		await wait(1500);
		await into(page.getByRole("button", { name: "Hide details" }).first());
		await shot("storage-history");
	});
	await step("models-table", async () => {
		await lens("Data models");
		await page.getByLabel("Choose a native table").first().click();
		await wait(800);
		const options = (await page.getByRole("option").allInnerTexts())
			.map((t) => t.trim())
			.filter(Boolean);
		log.nativeTables = options;
		const pick = options.find((o) => /relational/.test(o)) ?? options[0];
		await page.getByRole("option", { name: pick }).first().click();
		await wait(1500);
		await page.getByRole("button", { name: "Browse up to 50 rows" }).first().click();
		await wait(3000);
		await into(page.getByRole("button", { name: "Browse up to 50 rows" }).first());
		await shot(`models-${slug(pick.split(" - ")[0])}-rows`);
	});
	// TurboQuant in the Vectors lens (step T1): the empty search generations
	// section, the build form and the request it holds, the built generation,
	// its activation, then exact beside TurboQuant for a selected record and the
	// generation's details. These steps write to the estate, so they follow
	// every lens capture that reads it. A build without the section logs them
	// as failed.
	const dialog = () => page.getByRole("dialog");
	await step("vectors-generations", async () => {
		await lens("Vectors");
		await into(page.getByRole("button", { name: "Build a generation" }).first());
		await shot("vectors-generations-empty");
		await page.getByRole("button", { name: "Build a generation" }).first().click();
		await wait(1200);
		await shot("vectors-build-form");
		await dialog().getByRole("button", { name: "Review the request" }).click();
		await wait(2000);
		await shot("vectors-build-request");
		await dialog().getByRole("button", { name: "Build", exact: true }).click();
		await wait(3000);
		await shot("vectors-build-applied");
		await dialog().getByRole("button", { name: "Done" }).click();
		await wait(1500);
		await page.getByRole("button", { name: "Activate", exact: true }).first().click();
		await wait(2000);
		await shot("vectors-activate-request");
		await dialog().getByRole("button", { name: "Activate", exact: true }).click();
		await wait(3000);
		await dialog().getByRole("button", { name: "Done" }).click();
		await wait(1500);
	});
	await step("vectors-compare", async () => {
		await lens("Vectors");
		await page.getByRole("button", { name: "Browse points" }).first().click();
		await wait(2500);
		await page
			.locator("table")
			.filter({ hasText: "First numbers" })
			.locator("button")
			.first()
			.click();
		await wait(4000);
		// The comparison is taller than the space below the map, so it is
		// brought to the top of the window to show its lists and evidence.
		await page
			.getByText("Exact and approximate, side by side", { exact: true })
			.first()
			.evaluate((element) => element.scrollIntoView({ block: "start" }));
		await wait(1200);
		await shot("vectors-compare");
		await page.getByTitle("Show its digests").first().click();
		await wait(1000);
		await into(page.getByTitle("Show its digests").first());
		await shot("vectors-generation-details");
	});
	for (const panel of [
		"What do these words mean?",
		"Advanced details",
		"Explore project knowledge",
		"Knowledge paths",
		"Manage project engines",
	]) {
		await step(`panel ${panel}`, async () => {
			await back();
			await page.getByRole("button", { name: panel }).first().click();
			await wait(3000);
			await shot(`panel-${slug(panel)}`);
			await page.keyboard.press("Escape");
		});
	}
	await step("settings", async () => {
		await back();
		await page.getByRole("button", { name: "Settings", exact: true }).first().click();
		await wait(1500);
		const tabs = await page.locator("[role=dialog] button, [role=dialog] a").allInnerTexts();
		log.settingsTabs = tabs
			.map((t) => t.trim())
			.filter(Boolean)
			.slice(0, 20);
		const SETTINGS = [
			"Preferences",
			"Keybindings",
			"Templates",
			"Database Serving",
			"Backup & Restore",
			"OSS Licenses",
			"About",
		];
		for (const t of SETTINGS) {
			await page.getByText(t, { exact: true }).first().click();
			await wait(1000);
			await shot(`settings-${slug(t)}`);
		}
		await page.keyboard.press("Escape");
	});
	// The project's instance through a stop and a start (step F4a): the panel
	// shows the stopped project, then the instance it started again. A build
	// without per-project rows has no Start, and that step is logged as failed.
	const openEngines = async () => {
		await page.getByRole("button", { name: "Manage project engines" }).first().click();
		await wait(2000);
	};
	await step("project-engines-stopped", async () => {
		await back();
		await openEngines();
		await page.getByRole("button", { name: "Stop this engine" }).first().click();
		await wait(5000);
		await shot("project-engines-stopped");
	});
	await step("project-engines-restarted", async () => {
		await page.getByRole("button", { name: "Start", exact: true }).first().click();
		for (let i = 0; i < 90 && (await servedEstates()).length === 0; i++) {
			await wait(1000);
		}
		await wait(4000);
		await openEngines();
		await shot("project-engines-restarted");
		await page.keyboard.press("Escape");
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
process.exit(0);
