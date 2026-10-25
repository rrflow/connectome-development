/**
 * Renders the macOS disk-image background from Connectome's brand sources:
 * the Connectome mark (`src/shared/assets/pictograms/connectome.svg`), the
 * interface font bundled from `@fontsource-variable/inter`, and the gradient
 * of the `Wordmark` component. Run it after changing any of them:
 *
 *   node scripts/brand/render-installer-art.mjs
 *
 * Tauri's default disk-image layout places the application at x = 180 and
 * the Applications folder at x = 480 in a 660-pixel window, so the arrow runs
 * between them and the label plates sit beneath each icon.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const mark = await readFile(`${root}src/shared/assets/pictograms/connectome.svg`, "utf8");
const font = await readFile(
	`${root}node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2`,
);
const output = `${root}src-tauri/res/dmg-background.png`;

const html = `<!doctype html>
<html>
<head>
<style>
	@font-face {
		font-family: "Inter Variable";
		font-weight: 100 900;
		src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");
	}
	html, body { margin: 0; width: 660px; height: 372px; }
	body {
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(ellipse 420px 260px at 60% 52%, rgba(124, 92, 246, 0.22), transparent 70%),
			radial-gradient(ellipse 360px 220px at 30% 60%, rgba(6, 182, 212, 0.10), transparent 70%),
			linear-gradient(160deg, #15121f, #0e0c14);
		font-family: "Inter Variable", sans-serif;
	}
	.brand {
		position: absolute; top: 34px; left: 0; right: 0;
		display: flex; flex-direction: column; align-items: center; gap: 12px;
	}
	.brand svg { width: 46px; height: 46px; }
	.wordmark {
		font-size: 22px; font-weight: 750; line-height: 1; letter-spacing: 0.12em;
		background: linear-gradient(100deg, #f5f0ff 10%, #b891ff 55%, #66d9ff 100%);
		background-clip: text; -webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.arrow { position: absolute; left: 276px; top: 146px; width: 108px; height: 40px; }
	.plate {
		position: absolute; top: 241px; width: 114px; height: 25px;
		border-radius: 13px; background: rgba(255, 255, 255, 0.16);
	}
</style>
</head>
<body>
	<div class="brand">${mark}<span class="wordmark">CONNECTOME</span></div>
	<svg class="arrow" viewBox="0 0 108 40" fill="none">
		<path d="M4 32 C 30 10, 66 6, 96 16" stroke="#ffffff" stroke-opacity="0.85" stroke-width="5" stroke-linecap="round"/>
		<path d="M82 6 L 99 17 L 84 29" stroke="#ffffff" stroke-opacity="0.85" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	<div class="plate" style="left: 123px"></div>
	<div class="plate" style="left: 423px"></div>
</body>
</html>`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 660, height: 372 },
		deviceScaleFactor: 1,
	});
	await page.setContent(html);
	await page.evaluate(() => document.fonts.ready);
	const loaded = await page.evaluate(() => document.fonts.check('750 22px "Inter Variable"'));
	if (!loaded) {
		throw new Error("the bundled interface font did not load");
	}
	await page.screenshot({ path: output, omitBackground: false });
	console.log(`render-installer-art: wrote ${output}`);
} finally {
	await browser.close();
}
