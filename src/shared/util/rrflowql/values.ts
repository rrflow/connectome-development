/**
 * JSON is the editable presentation of public RRD values. These helpers only
 * serialize/deserialize data; they do not evaluate expressions or validate a
 * query, schema, transaction, or authorization contract.
 */
export function formatRRFlowValue(value: unknown, pretty = false): string {
	const encoded = JSON.stringify(
		value,
		(_key, entry: unknown) => {
			if (typeof entry === "bigint") return entry.toString();
			if (typeof entry === "number" && !Number.isFinite(entry)) {
				throw new TypeError("RRD JSON values cannot contain a non-finite number");
			}
			if (
				typeof entry === "number" &&
				Number.isInteger(entry) &&
				!Number.isSafeInteger(entry)
			) {
				throw new TypeError(
					"Represent integers outside the JavaScript safe range as strings",
				);
			}
			if (
				typeof entry === "undefined" ||
				typeof entry === "function" ||
				typeof entry === "symbol"
			) {
				throw new TypeError(`RRD JSON values cannot contain ${typeof entry}`);
			}
			if (entry && typeof entry === "object" && !Array.isArray(entry)) {
				const prototype = Object.getPrototypeOf(entry);
				if (prototype !== Object.prototype && prototype !== null) {
					throw new TypeError(
						"This value must expose its public RRD JSON representation with toJSON()",
					);
				}
				if (Object.getOwnPropertySymbols(entry).length > 0) {
					throw new TypeError("RRD JSON objects cannot contain symbol keys");
				}
			}
			return entry;
		},
		pretty ? 2 : undefined,
	);
	if (encoded === undefined) throw new TypeError("The value has no RRD JSON representation");
	return encoded;
}

export function parseRRFlowValue<T = unknown>(source: string): T {
	try {
		return JSON.parse(source, (_key, entry: unknown) => {
			if (
				typeof entry === "number" &&
				(!Number.isFinite(entry) ||
					(Number.isInteger(entry) && !Number.isSafeInteger(entry)))
			) {
				throw new TypeError(
					"Represent integers outside the JavaScript safe range and exact decimals as strings",
				);
			}
			return entry;
		}) as T;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new SyntaxError(`Enter a JSON value for RRD. ${reason}`);
	}
}
