/*
 * The values a query's `$name` parameters stand for, and the kinds a query can
 * read from.
 *
 * A person types the values as one JSON object. Each is turned into the
 * contract's typed value here; whether the engine takes that type as a
 * parameter is the contract's to say, in its own words, when the query is sent.
 */

import { classify, FAMILIES } from "../editor/rrflowql/engine/index.ts";
import { type QueryValue, VALUE_TYPES, value } from "./model.ts";

export type QueryParameters = Record<string, QueryValue>;

/** A parameter name as the engine's parser reads it, without the `$`. */
const NAME = /^[A-Za-z0-9_.]+$/;
const TYPES = new Set<string>(VALUE_TYPES);

function isRecord(input: unknown): input is Record<string, unknown> {
	return typeof input === "object" && input !== null && !Array.isArray(input);
}

/** A value already written in the contract's own form, `{ "type": …, "value": … }`. */
function isTyped(input: Record<string, unknown>): boolean {
	const keys = Object.keys(input);
	return (
		typeof input.type === "string" &&
		TYPES.has(input.type) &&
		keys.every((key) => key === "type" || key === "value")
	);
}

/**
 * JSON to the contract's value. A whole number is unsigned when it is zero or
 * more and an integer when it is negative; write `{ "type": "integer",
 * "value": 5 }` to say otherwise.
 */
export function toQueryValue(input: unknown): QueryValue {
	if (input === null) return value.null();
	if (typeof input === "boolean") return value.bool(input);
	if (typeof input === "string") return value.string(input);
	if (typeof input === "number") {
		if (!Number.isInteger(input)) return value.decimal(String(input));
		return input < 0 ? value.integer(input) : value.unsigned(input);
	}
	if (Array.isArray(input)) return value.list(input.map(toQueryValue));
	if (isRecord(input)) {
		if (isTyped(input)) return typed(input);
		return value.map(
			Object.fromEntries(
				Object.entries(input).map(([key, item]) => [key, toQueryValue(item)]),
			),
		);
	}
	throw new Error("a parameter value must be JSON");
}

function typed(input: Record<string, unknown>): QueryValue {
	const content = input.value;
	switch (input.type) {
		case "null":
			return value.null();
		case "bool":
			if (typeof content === "boolean") return value.bool(content);
			break;
		case "integer":
			if (typeof content === "number") return value.integer(content);
			break;
		case "unsigned":
			if (typeof content === "number") return value.unsigned(content);
			break;
		case "decimal":
			if (typeof content === "string") return value.decimal(content);
			break;
		case "string":
			if (typeof content === "string") return value.string(content);
			break;
		case "digest":
			if (typeof content === "string") return value.digest(content);
			break;
		case "list":
			if (Array.isArray(content)) return value.list(content.map(toQueryValue));
			break;
		case "map":
			if (isRecord(content)) {
				return value.map(
					Object.fromEntries(
						Object.entries(content).map(([key, item]) => [key, toQueryValue(item)]),
					),
				);
			}
			break;
	}
	throw new Error(`the value of a ${String(input.type)} is not a ${String(input.type)}`);
}

export type ParsedParameters =
	| { ok: true; parameters: QueryParameters }
	| { ok: false; error: string };

/** Reads the variables text: empty, or one JSON object of name to value. */
export function parseParameters(text: string): ParsedParameters {
	if (!text.trim()) return { ok: true, parameters: {} };
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		return { ok: false, error: `Not valid JSON: ${(cause as Error).message}` };
	}
	if (!isRecord(parsed)) {
		return { ok: false, error: "Variables are one JSON object: a name and its value each." };
	}
	const parameters: QueryParameters = {};
	for (const [key, item] of Object.entries(parsed)) {
		const name = key.startsWith("$") ? key.slice(1) : key;
		if (!NAME.test(name)) {
			return {
				ok: false,
				error: `"${key}" is not a parameter name: letters, digits, "_" and "." only.`,
			};
		}
		try {
			parameters[name] = toQueryValue(item);
		} catch (cause) {
			return { ok: false, error: `${name}: ${(cause as Error).message}` };
		}
	}
	return { ok: true, parameters };
}

/** The parameters a query names, each once, in the order it first uses them. */
export function parameterNames(query: string): string[] {
	const names = new Set<string>();
	for (const token of classify(query).tokens) {
		if (token.role === "parameter") names.add(query.slice(token.from + 1, token.to));
	}
	return [...names].filter((name) => name.length > 0);
}

/**
 * The variables text with every parameter the query names. Values already
 * given are kept as written; a new name starts as `null`. Returns null when
 * the text cannot be read, so nothing a person typed is overwritten.
 */
export function inferParameters(text: string, query: string): string | null {
	let current: Record<string, unknown> = {};
	if (text.trim()) {
		try {
			const parsed: unknown = JSON.parse(text);
			if (!isRecord(parsed)) return null;
			current = parsed;
		} catch {
			return null;
		}
	}
	const next = { ...current };
	for (const name of parameterNames(query)) {
		if (!(name in next) && !(`$${name}` in next)) next[name] = null;
	}
	return JSON.stringify(next, null, 2);
}

/** A table as the engine's schema lists it. */
export interface SourceTable {
	name: string;
	model: string;
}

/** Which data model each source family reads; `record` reads every other table. */
const FAMILY_MODEL: Record<string, string> = {
	relation: "graph_relation",
	traverse: "graph_relation",
	event: "event",
	series: "time_series",
	geo: "geo",
};

/** The kinds the schema lists for each source family a query can name. */
export function sourceKinds(tables: SourceTable[]): Record<string, string[]> {
	const claimed = new Set(Object.values(FAMILY_MODEL));
	const kinds: Record<string, string[]> = {};
	for (const family of FAMILIES) {
		const model = FAMILY_MODEL[family];
		const names =
			family === "record"
				? tables.filter((table) => !claimed.has(table.model))
				: model
					? tables.filter((table) => table.model === model)
					: [];
		kinds[family] = names.map((table) => table.name).sort();
	}
	return kinds;
}
