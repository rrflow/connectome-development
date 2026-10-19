import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Match the CommonJS export condition used by transpiled source so Mantine's
// provider and components share the same real context instance.
const { MantineProvider } = createRequire(import.meta.url)("@mantine/core");

// Execute real source with the repository's installed TypeScript compiler. No
// package aliases, generated facade modules, disk bundles, or UI mocks are used.
const modules = new Map();
function loadSource(filename) {
	if (modules.has(filename)) return modules.get(filename).exports;
	const compiled = { exports: {} };
	modules.set(filename, compiled);
	const require = createRequire(filename);
	const requireSource = (specifier) => {
		if (specifier.startsWith(".")) {
			const base = resolve(dirname(filename), specifier);
			for (const extension of [".ts", ".tsx"]) {
				if (existsSync(base + extension)) return loadSource(base + extension);
			}
		}
		return require(specifier);
	};
	const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
		fileName: filename,
		compilerOptions: {
			jsx: ts.JsxEmit.ReactJSX,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: true,
			target: ts.ScriptTarget.ESNext,
		},
	});
	new Function("require", "module", "exports", outputText)(
		requireSource,
		compiled,
		compiled.exports,
	);
	return compiled.exports;
}

const ui = loadSource(fileURLToPath(new URL("./index.tsx", import.meta.url)));
const { highlightCode } = loadSource(fileURLToPath(new URL("./highlight.tsx", import.meta.url)));

function render(component, props) {
	const warnings = [];
	const previousError = console.error;
	console.error = (...args) => warnings.push(args.join(" "));
	let markup;
	try {
		markup = renderToStaticMarkup(
			React.createElement(
				MantineProvider,
				{ theme: ui.MANTINE_THEME },
				React.createElement(component, props),
			),
		);
	} finally {
		console.error = previousError;
	}
	assert.deepEqual(warnings, [], "Rendering must not produce React warnings");
	return markup;
}

function textContent(node) {
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (React.isValidElement(node)) return textContent(node.props.children);
	return node === undefined || node === null ? "" : String(node);
}

test("icons expose accessible names and preserve flip and activity states", () => {
	const icon = render(ui.Icon, {
		path: ui.iconPlay,
		title: "Start serving",
		size: "xl",
		flip: "horizontal",
		spin: true,
	});
	assert.match(icon, /aria-label="Start serving"/);
	assert.match(icon, /<title>Start serving<\/title>/);
	assert.match(icon, /viewBox="0 0 24 24"/);
	assert.match(icon, /scale\(-1, 1\)/);
	assert.match(icon, /rrflow-icon-spinning/);
	assert.ok(icon.includes(ui.iconPlay));
	const decoration = render(ui.Icon, { path: ui.iconCheck });
	assert.match(decoration, /aria-hidden="true"/);
});

test("code blocks preserve source, escape HTML, and expose a copy control and title", () => {
	const code = render(ui.CodeBlock, {
		value: '<script>alert("unsafe")</script>',
		title: "Run command",
		lang: "bash",
	});
	assert.match(code, /Run command/);
	assert.match(code, /Copy code/);
	assert.match(code, /language-bash/);
	assert.match(code, /&lt;/);
	assert.ok(!code.includes("<script>"));
});

test("syntax coloring covers RRFlow and supported snippets without changing a character", () => {
	const snippets = {
		rrflowql: "FROM records WHERE score > 0.5 PROJECT name; -- exact source\n",
		json: '{"engine": "RRFlow", "ready": true, "count": 3}\n',
		js: "const engine = new RRFlow(); // connect\n",
		rust: "let ready: bool = true; // connect\n",
		py: "ready = True # connect\n",
		go: "package main\nvar ready = true\n",
		php: "<?php $ready = true; ?>\n",
		cli: 'rrflow serve --bind "127.0.0.1:0"\n',
		csharp: "var ready = true; // connect\n",
		java: "boolean ready = true; // connect\n",
		c: "int ready = 1; // connect\n",
	};
	for (const [language, source] of Object.entries(snippets)) {
		const highlighted = highlightCode(source, language);
		assert.equal(textContent(highlighted), source, `${language} must retain exact source`);
		assert.ok(
			Array.isArray(highlighted) && highlighted.some(React.isValidElement),
			`${language} must include colored tokens`,
		);
	}
	const code = render(ui.CodeBlock, { value: snippets.rrflowql, lang: "rrflowql" });
	assert.match(code, /class="tok-keyword">FROM<\/span>/);
	assert.match(code, /class="tok-comment">-- exact source<\/span>/);
});

test("unsupported and large code payloads remain exact readable text", () => {
	const source = "unfamiliar syntax <preserved>\n";
	assert.equal(highlightCode(source, "future-language"), source);
	assert.equal(highlightCode(source, "__proto__"), source);
	assert.equal(highlightCode(source, "constructor"), source);
	const large = `FROM records;\n${" ".repeat(100_001)}`;
	assert.equal(highlightCode(large, "rrflowql"), large);
});

test("Markdown supports GFM while refusing embedded scripts and executable URLs", () => {
	const markdown = render(ui.Markdown, {
		content: [
			"**Records**",
			'<script>alert("unsafe")</script>',
			"[unsafe](javascript:alert(1))",
			"| Field | Value |\n| --- | --- |\n| engine | RRFlow |",
		].join("\n\n"),
	});
	assert.match(markdown, /<strong>Records<\/strong>/);
	assert.match(markdown, /<table>/);
	assert.ok(!markdown.includes("<script>"));
	assert.ok(!markdown.includes('href="javascript:'));
});

test("icons and original pictograms are usable offline assets", () => {
	const pictograms = [];
	let icons = 0;
	for (const [name, value] of Object.entries(ui)) {
		if (name.startsWith("icon")) {
			assert.equal(typeof value, "string", name);
			assert.match(value, /^M/, `${name} must contain an SVG path`);
			icons++;
		}
		if (name.startsWith("picto")) {
			assert.match(value, /^data:image\/svg\+xml,/);
			const svg = decodeURIComponent(value.split(",")[1]);
			assert.match(svg, /viewBox="0 0 96 96"/);
			assert.ok(!svg.includes("<script"));
			assert.ok(!svg.includes("https://"));
			pictograms.push(value);
		}
	}
	assert.equal(icons, 127);
	assert.equal(pictograms.length, 13);
	assert.equal(new Set(pictograms).size, pictograms.length);
	assert.ok(ui.pictoRRFlowCloud);
	assert.equal(ui.MANTINE_THEME.colors.obsidian.length, 10);
	assert.equal(ui.MANTINE_THEME.colors.bright.length, 10);
});
