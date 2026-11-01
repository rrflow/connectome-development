import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

/**
 * Compares two capture sets image by image (sprint 009, decision 17).
 *
 *   node tests/visual/compare.mjs --before <dir> --after <dir> --out <dir> [--tolerance 8]
 *
 * Images are matched by name without extension, so a WebP baseline compares
 * with a PNG capture. A pixel differs when any channel moves by more than
 * `tolerance` (0 to 255). Each pair is reported as identical (no differing
 * pixel), negligible (under 0.1 percent of pixels, such as a blinking caret)
 * or changed; every non-identical pair gets a diff image with the changed
 * pixels in red over a dimmed copy of the after image. `report.json` lists
 * every pair, plus names present on only one side.
 */

const args = Object.fromEntries(
	process.argv.slice(2).reduce((pairs, value, index, all) => {
		if (value.startsWith("--")) {
			pairs.push([value.slice(2), all[index + 1]]);
		}
		return pairs;
	}, []),
);
const before = resolve(args.before);
const after = resolve(args.after);
const out = resolve(args.out ?? "visual-compare");
const tolerance = Number(args.tolerance ?? 8);
// Force-directed layouts and live map tiles move with timing and with the
// order in which code consumes the seeded random sequence, and the storage
// engine's live counters move when the estate writes during the capture
// (most likely an automatic session renewal), so their pixels are reported but
// reviewed by eye for structure (records, edges, legend, counters). A search
// generation is built during the capture, so its digests and the screens that
// show it differ between runs as well.
const DYNAMIC =
	/graph-visualize|geography|native-lens-records-relations|native-records-|native-lens-storage-engine|native-storage-|native-vectors-(build|activate|compare|generation-)/;
mkdirSync(out, { recursive: true });

const IMAGE = new Set([".png", ".webp"]);
const index = (dir) =>
	new Map(
		readdirSync(dir)
			.filter((name) => IMAGE.has(extname(name)))
			.map((name) => [name.slice(0, -extname(name).length), join(dir, name)]),
	);
const dataUrl = (path) =>
	`data:image/${extname(path) === ".webp" ? "webp" : "png"};base64,${readFileSync(path).toString("base64")}`;

const beforeImages = index(before);
const afterImages = index(after);
const report = { before, after, tolerance, pairs: [], onlyBefore: [], onlyAfter: [] };

const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	for (const [name, beforePath] of beforeImages) {
		const afterPath = afterImages.get(name);
		if (!afterPath) {
			report.onlyBefore.push(name);
			continue;
		}
		const result = await page.evaluate(
			async ({ a, b, tolerance }) => {
				const load = (src) =>
					new Promise((ok, fail) => {
						const image = new Image();
						image.onload = () => ok(image);
						image.onerror = () => fail(new Error("image did not decode"));
						image.src = src;
					});
				const [left, right] = await Promise.all([load(a), load(b)]);
				const width = Math.max(left.width, right.width);
				const height = Math.max(left.height, right.height);
				const pixels = (image) => {
					const canvas = document.createElement("canvas");
					canvas.width = width;
					canvas.height = height;
					const context = canvas.getContext("2d");
					context.drawImage(image, 0, 0);
					return context.getImageData(0, 0, width, height);
				};
				const one = pixels(left);
				const two = pixels(right);
				const diff = new ImageData(width, height);
				let changed = 0;
				// The capture paints masked regions (query timings) pure magenta;
				// a pixel masked on either side is not compared.
				const masked = (data, i) =>
					data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255;
				for (let i = 0; i < one.data.length; i += 4) {
					if (masked(one.data, i) || masked(two.data, i)) {
						diff.data.set([60, 0, 60, 255], i);
						continue;
					}
					const moved =
						Math.abs(one.data[i] - two.data[i]) > tolerance ||
						Math.abs(one.data[i + 1] - two.data[i + 1]) > tolerance ||
						Math.abs(one.data[i + 2] - two.data[i + 2]) > tolerance ||
						Math.abs(one.data[i + 3] - two.data[i + 3]) > tolerance;
					if (moved) {
						changed++;
						diff.data.set([255, 0, 0, 255], i);
					} else {
						const grey = (two.data[i] + two.data[i + 1] + two.data[i + 2]) / 6;
						diff.data.set([grey, grey, grey, 255], i);
					}
				}
				let image = null;
				if (changed > 0) {
					const canvas = document.createElement("canvas");
					canvas.width = width;
					canvas.height = height;
					canvas.getContext("2d").putImageData(diff, 0, 0);
					image = canvas.toDataURL("image/png");
				}
				return {
					size: [left.width, left.height, right.width, right.height],
					changed,
					total: width * height,
					image,
				};
			},
			{ a: dataUrl(beforePath), b: dataUrl(afterPath), tolerance },
		);
		const ratio = result.changed / result.total;
		const verdict = DYNAMIC.test(name)
			? "dynamic"
			: result.changed === 0
				? "identical"
				: ratio < 0.001
					? "negligible"
					: "changed";
		if (result.image) {
			writeFileSync(
				join(out, `${name}.diff.png`),
				Buffer.from(result.image.split(",")[1], "base64"),
			);
		}
		report.pairs.push({
			name,
			verdict,
			changedPixels: result.changed,
			percent: Number((ratio * 100).toFixed(3)),
			size: result.size,
		});
	}
	report.onlyAfter = [...afterImages.keys()].filter((name) => !beforeImages.has(name));
} finally {
	await browser.close();
}

writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
const count = (verdict) => report.pairs.filter((pair) => pair.verdict === verdict).length;
const dynamic = report.pairs.filter((pair) => pair.verdict === "dynamic").map((pair) => pair.name);
console.log(
	`compare: ${report.pairs.length} pairs — ${count("identical")} identical, ${count("negligible")} negligible, ${count("changed")} changed, ${dynamic.length} dynamic (review by eye); ${report.onlyBefore.length} only before, ${report.onlyAfter.length} only after`,
);
for (const pair of report.pairs.filter((p) => p.verdict === "changed")) {
	console.log(`  changed: ${pair.name} (${pair.percent}%)`);
}
for (const name of dynamic) {
	console.log(`  dynamic: ${name}`);
}
if (existsSync(out)) {
	console.log(`report: ${join(out, "report.json")}`);
}
