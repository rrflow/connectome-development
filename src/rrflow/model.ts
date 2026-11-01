import type { RequestPayload, SuccessPayload } from "@rrflow/rrd-client";

/*
 * The RRFlow value model: the contract types Connectome builds values with,
 * and the rules it builds them by.
 *
 * Every type here is derived from the operation types `@rrflow/rrd-client`
 * generates from the pinned engine's OpenAPI document, so moving the engine pin
 * moves them, and `tsc` reports any use that no longer fits. Nothing here is a
 * second schema.
 *
 * Reads do not need this module for display: the native process decodes every
 * engine value, at full 64-bit precision, and sends the webview display text.
 * This module is for the values the webview itself builds (record and schema
 * edits, query parameters) and for showing them before they are sent.
 *
 * Inherited value classes and their RRFlow counterparts:
 * - `RecordId`, `StringRecordId`: `DataReference` (`reference`, `referenceKey`).
 * - `Decimal`: a `decimal` value, kept as its exact text.
 * - `Duration`: none. The contract carries durations as integer milliseconds
 *   in fields named `*_ms`; there is no duration value.
 * - `Geometry*`: `DataGeoValue`, written by `put_geo`. Geography is its own
 *   model, not a property value.
 * - `Uuid`: a `string` value. `Table`: a kind, which is a canonical id.
 * - `escapeIdent`: none. rrflowQL names are canonical ids.
 *
 * This module imports only types, so Node runs it as written
 * (`scripts/check-value-model.mjs`).
 */

/** The result of `query-execute`. */
export type QueryResult = SuccessPayload<"query-execute">;
export type QueryRow = QueryResult["rows"][number];
/** One typed value: a property, a query cell, a parameter. */
export type QueryValue = QueryRow["values"][string];
export type QueryValueType = QueryValue["type"];

/** One mutation of a transaction. */
export type TransactionMutation = RequestPayload<"transaction-preview">["mutations"][number];
export type Mutation<K extends TransactionMutation["mutation"]> = Extract<
	TransactionMutation,
	{ mutation: K }
>;
export type DataReference = Mutation<"put_record">["reference"];
export type DataProperties = NonNullable<Mutation<"put_record">["properties"]>;
export type DataGeoValue = Mutation<"put_geo">["value"];
export type DataSeriesValue = Mutation<"append_series_sample">["value"];
export type DataVectorValue = Mutation<"put_vector">["value"];
export type DataTarget = Mutation<"retire_data">["target"];
export type DataLogicalModel = Mutation<"retire_data">["model"];

/** A quantization codec and its parameters, as `vector-quantization-build` takes it. */
export type VectorQuantizationMethod = RequestPayload<"vector-quantization-build">["method"];
export type TurboQuantBits = Extract<VectorQuantizationMethod, { method: "turbo_quant" }>["bits"];

/** The result of `data-schema-read`. */
export type DataSchemaSnapshot = SuccessPayload<"data-schema-read">;
export type DataSchemaRegistry = NonNullable<DataSchemaSnapshot["schema"]>;
export type DataTableSchema = DataSchemaRegistry["tables"][string];

/** Every value type the contract has, in its own order. */
export const VALUE_TYPES = [
	"null",
	"bool",
	"integer",
	"unsigned",
	"decimal",
	"string",
	"digest",
	"list",
	"map",
] as const;

// Fails to compile when the contract gains a value type VALUE_TYPES lacks.
type MissingValueType = Exclude<QueryValueType, (typeof VALUE_TYPES)[number]>;
const everyValueType: [MissingValueType] extends [never] ? true : never = true;
void everyValueType;

/** Longest display text, in UTF-8 bytes, before it is cut short. */
export const MAX_DISPLAY_BYTES = 2048;
/** Longest canonical identifier, in bytes. */
export const MAX_ID_BYTES = 128;

const CANONICAL_ID = /^[a-z0-9][a-z0-9._-]*$/;
const DIGEST = /^[0-9a-f]{64}$/;
// A finite decimal in the grammar the kernel accepts: no hexadecimal, no
// infinity, no NaN.
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INTEGER = /^-?\d+$/;
const UNSIGNED = /^\d+$/;
const I64_MIN = -(2n ** 63n);
const I64_MAX = 2n ** 63n - 1n;
const U64_MAX = 2n ** 64n - 1n;

/** A value the contract or the kernel would refuse. */
export class ValueError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValueError";
	}
}

export function isCanonicalId(text: string): boolean {
	return text.length > 0 && text.length <= MAX_ID_BYTES && CANONICAL_ID.test(text);
}

/** `text` as a canonical identifier: lowercase ASCII letters, digits, `.`, `-`, `_`. */
export function canonicalId(text: string, label = "identifier"): string {
	if (!isCanonicalId(text)) {
		throw new ValueError(
			`${label} must be 1 to ${MAX_ID_BYTES} lowercase ASCII letters, digits, '.', '-' or '_', starting with a letter or digit`,
		);
	}
	return text;
}

export function reference(kind: string, id: string): DataReference {
	return { kind: canonicalId(kind, "kind"), id: canonicalId(id, "id") };
}

/** A reference written as `kind:id`. */
export function referenceKey(ref: DataReference): string {
	return `${ref.kind}:${ref.id}`;
}

/** A `kind:id` key as a reference, or `null` when it is not one. */
export function parseReferenceKey(key: string): DataReference | null {
	const split = key.indexOf(":");
	if (split < 0) return null;
	const kind = key.slice(0, split);
	const id = key.slice(split + 1);
	return isCanonicalId(kind) && isCanonicalId(id) ? { kind, id } : null;
}

function exactInteger(number: number, unsigned: boolean): number {
	if (!Number.isSafeInteger(number) || (unsigned && number < 0)) {
		throw new ValueError(
			unsigned
				? "an unsigned value must be a whole number from 0 to 2^53 - 1 here; larger values cannot cross to the native process exactly"
				: "an integer must be a whole number within ±(2^53 - 1) here; larger values cannot cross to the native process exactly",
		);
	}
	return number;
}

/** Builders for every value type; each refuses what the engine would. */
export const value = {
	null: (): QueryValue => ({ type: "null" }),
	bool: (flag: boolean): QueryValue => ({ type: "bool", value: flag }),
	integer: (number: number): QueryValue => ({
		type: "integer",
		value: exactInteger(number, false),
	}),
	unsigned: (number: number): QueryValue => ({
		type: "unsigned",
		value: exactInteger(number, true),
	}),
	decimal: (text: string): QueryValue => {
		if (!DECIMAL.test(text)) {
			throw new ValueError("a decimal must be a finite number written in decimal digits");
		}
		return { type: "decimal", value: text };
	},
	string: (text: string): QueryValue => ({ type: "string", value: text }),
	digest: (hex: string): QueryValue => {
		if (!DIGEST.test(hex)) {
			throw new ValueError("a digest must be 64 lowercase hexadecimal characters");
		}
		return { type: "digest", value: hex };
	},
	list: (items: QueryValue[]): QueryValue => ({ type: "list", value: [...items] }),
	map: (entries: Record<string, QueryValue>): QueryValue => ({
		type: "map",
		value: { ...entries },
	}),
};

/**
 * The value an operator typed for a property of type `type`. Lists and maps
 * are built item by item, not parsed from text.
 */
export function parseValue(type: QueryValueType, text: string): QueryValue {
	switch (type) {
		case "null":
			if (text !== "" && text !== "null") throw new ValueError("null has no other text");
			return value.null();
		case "bool":
			if (text !== "true" && text !== "false") {
				throw new ValueError("a bool is true or false");
			}
			return value.bool(text === "true");
		case "integer":
		case "unsigned": {
			const unsigned = type === "unsigned";
			if (!(unsigned ? UNSIGNED : INTEGER).test(text)) {
				throw new ValueError(
					`${unsigned ? "an unsigned value" : "an integer"} is whole digits`,
				);
			}
			const whole = BigInt(text);
			if (whole < (unsigned ? 0n : I64_MIN) || whole > (unsigned ? U64_MAX : I64_MAX)) {
				throw new ValueError(`${text} is outside the ${unsigned ? "u64" : "i64"} range`);
			}
			return unsigned ? value.unsigned(Number(whole)) : value.integer(Number(whole));
		}
		case "decimal":
			return value.decimal(text);
		case "string":
			return value.string(text);
		case "digest":
			return value.digest(text);
		case "list":
		case "map":
			throw new ValueError(`a ${type} is built item by item`);
	}
}

/**
 * Whether every number in `value` is exact in JavaScript. An integer past
 * 2^53 - 1 that reached the webview as a JSON number has already been rounded.
 */
export function isExact(item: QueryValue): boolean {
	switch (item.type) {
		case "integer":
		case "unsigned":
			return Number.isSafeInteger(item.value);
		case "list":
			return item.value.every(isExact);
		case "map":
			return Object.values(item.value).every(isExact);
		default:
			return true;
	}
}

const encoder = new TextEncoder();

/** Orders strings by their UTF-8 bytes, as the engine's maps are ordered. */
function byteOrder(left: string, right: string): number {
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	for (let index = 0; index < Math.min(a.length, b.length); index++) {
		if (a[index] !== b[index]) return a[index] - b[index];
	}
	return a.length - b.length;
}

function plain(item: QueryValue): string {
	switch (item.type) {
		case "null":
			return "null";
		case "bool":
		case "integer":
		case "unsigned":
			return String(item.value);
		case "decimal":
		case "string":
		case "digest":
			return item.value;
		case "list":
			return `[${item.value.map(plain).join(", ")}]`;
		case "map":
			return `{${Object.keys(item.value)
				.sort(byteOrder)
				.map((key) => `${key}: ${plain(item.value[key])}`)
				.join(", ")}}`;
	}
}

/** `text` cut to at most `MAX_DISPLAY_BYTES` UTF-8 bytes, whole characters only. */
function bounded(text: string): string {
	if (encoder.encode(text).length <= MAX_DISPLAY_BYTES) return text;
	let bytes = 0;
	let end = 0;
	for (const character of text) {
		const size = encoder.encode(character).length;
		if (bytes + size > MAX_DISPLAY_BYTES) break;
		bytes += size;
		end += character.length;
	}
	return `${text.slice(0, end)}…`;
}

/**
 * A value as the native views render it: its content, not its wire form, cut
 * to `MAX_DISPLAY_BYTES`. Exact for every value `isExact` accepts.
 */
export function display(item: QueryValue): string {
	return bounded(plain(item));
}
