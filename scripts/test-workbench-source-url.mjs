import assert from "node:assert/strict";
import { test } from "node:test";
import {
	checkedSource,
	googleDocsRelayUrl,
	sourceUrl,
	usableSourceUrl,
} from "../src/features/runtime/workbench/linked-cloud/source-url.ts";

test("only an HTTPS address without credentials is a source", () => {
	assert.equal(
		sourceUrl(" https://drive.google.com/drive/folders/new ").href,
		"https://drive.google.com/drive/folders/new",
	);
	for (const refused of [
		"javascript:alert(1)",
		"http://drive.google.com/drive/folders/new",
		"file:///etc/passwd",
		"data:text/html,<script>alert(1)</script>",
		"https://user:secret@drive.google.com/drive/folders/new",
		"https://user@drive.google.com/",
	]) {
		assert.throws(
			() => sourceUrl(refused),
			/Source URLs must use HTTPS and cannot contain credentials\./,
			refused,
		);
	}
	for (const unreadable of ["", "   ", "not a url", "drive.google.com/folder"]) {
		assert.throws(
			() => sourceUrl(unreadable),
			/Provide a valid HTTPS source URL\./,
			unreadable,
		);
	}
});

test("only Google Docs serves a Google Docs export", () => {
	assert.equal(
		googleDocsRelayUrl(new URL("https://docs.google.com/document/d/test-id/edit")),
		"https://docs.google.com/document/d/test-id/export?format=txt",
	);
	for (const refused of [
		"https://example.com/document/d/not-google/edit",
		"https://docs.google.com.evil.example/document/d/x/edit",
		"https://docs.google.com/spreadsheets/d/x/edit",
		"https://docs.google.com/a/document/d/x/edit",
	]) {
		assert.throws(
			() => googleDocsRelayUrl(new URL(refused)),
			/Provide a Google Docs document URL\./,
			refused,
		);
	}
});

test("a typed address is checked once, with its relay when asked", () => {
	assert.deepEqual(checkedSource("https://drive.google.com/drive/folders/new", false), {
		url: "https://drive.google.com/drive/folders/new",
		relayUrl: undefined,
	});
	assert.deepEqual(checkedSource("https://docs.google.com/document/d/test-id/edit", true), {
		url: "https://docs.google.com/document/d/test-id/edit",
		relayUrl: "https://docs.google.com/document/d/test-id/export?format=txt",
	});
	assert.deepEqual(checkedSource("javascript:alert(1)", false), {
		error: "Source URLs must use HTTPS and cannot contain credentials.",
	});
	assert.deepEqual(checkedSource("https://example.com/document/d/x/edit", true), {
		error: "Provide a Google Docs document URL.",
	});
});

test("a saved source is checked again before it is opened or read", () => {
	assert.equal(
		usableSourceUrl({
			url: "https://drive.google.com/a",
			relayUrl: "https://docs.google.com/b",
		}),
		"https://docs.google.com/b",
	);
	// A configuration saved before the rule may hold anything.
	assert.throws(() => usableSourceUrl({ url: "javascript:alert(1)" }));
	assert.throws(() =>
		usableSourceUrl({ url: "https://drive.google.com/a", relayUrl: "http://plain.example/b" }),
	);
});
