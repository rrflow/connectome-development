import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { MantineProvider } = require("@mantine/core");
const source = readFileSync(new URL("../src/components/Icon/index.tsx", import.meta.url), "utf8");
const compiled = { exports: {} };
const output = ts.transpileModule(source, {
	compilerOptions: {
		jsx: ts.JsxEmit.ReactJSX,
		module: ts.ModuleKind.CommonJS,
		esModuleInterop: true,
	},
}).outputText;
// Only the CSS module is substituted; React, Mantine and Icon execute unchanged.
new Function("require", "module", "exports", output)(
	(name) => (name === "./style.module.scss" ? { icon: "icon", spin: "spin" } : require(name)),
	compiled,
	compiled.exports,
);
const { Icon } = compiled.exports;
function render(props = {}) {
	const markup = renderToStaticMarkup(
		createElement(MantineProvider, null, createElement(Icon, { path: "M1 2L3 4", ...props })),
	);
	return markup.slice(markup.indexOf("<svg"), markup.indexOf("</svg>") + 6);
}

test("a titled icon exposes its accessible name and SVG title", () => {
	const svg = render({ title: "Refresh" });
	assert.match(svg, /aria-label="Refresh"/);
	assert.match(svg, /<title>Refresh<\/title>/);
	assert.doesNotMatch(svg, /aria-hidden="true"/);
});
test("caller labels and visibility take precedence", () => {
	assert.match(render({ title: "Refresh", "aria-label": "Reload" }), /aria-label="Reload"/);
	const labelled = render({ "aria-labelledby": "status-label" });
	assert.match(labelled, /aria-labelledby="status-label"/);
	assert.doesNotMatch(labelled, /aria-hidden="true"/);
	assert.match(render({ title: "Hidden", "aria-hidden": true }), /aria-hidden="true"/);
});
test("an unnamed decorative icon is hidden", () => {
	assert.match(render(), /aria-hidden="true"/);
});
test("flip belongs to the path so the root can spin independently", () => {
	const svg = render({ spin: true, flip: "horizontal" });
	const root = svg.slice(0, svg.indexOf(">") + 1);
	assert.match(root, /class="[^"]*spin/);
	assert.doesNotMatch(root, /scaleX/);
	assert.match(svg, /<path[^>]*transform:scaleX\(-1\);transform-origin:12px 12px/);
	assert.match(svg, /d="M1 2L3 4"/);
	assert.match(root, /viewBox="0 0 24 24"/);
});
