/** A table projection of the already validated native RrdQueryView. */
export interface NativeQueryTable {
	columns: string[];
	rows: { identity: string; cells: (string | null)[] }[];
	returnedRows: number;
	knownAtCursor: number;
	truncated: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function count(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Selects this native presentation shape from the result pane's unknown value.
 * It never changes the original response or decodes an engine wire protocol.
 * A missing projected property is absent, rather than an inherited JS value.
 */
export function nativeQueryTable(value: unknown): NativeQueryTable | null {
	if (!record(value)) return null;
	const fields = [
		"canonical_query",
		"known_at_cursor",
		"schema_revision",
		"columns",
		"rows",
		"returned_rows",
		"truncated",
		"keys_examined",
		"output_bytes",
	];
	if (!fields.every((field) => Object.hasOwn(value, field))) return null;
	if (
		typeof value.canonical_query !== "string" ||
		!count(value.known_at_cursor) ||
		!count(value.schema_revision) ||
		!count(value.returned_rows) ||
		!count(value.keys_examined) ||
		!count(value.output_bytes) ||
		typeof value.truncated !== "boolean" ||
		!Array.isArray(value.columns) ||
		!value.columns.every((column): column is string => typeof column === "string") ||
		new Set(value.columns).size !== value.columns.length ||
		!Array.isArray(value.rows) ||
		value.rows.length !== value.returned_rows
	) {
		return null;
	}
	const columns = [...value.columns];
	const rows: NativeQueryTable["rows"] = [];
	for (const row of value.rows) {
		if (
			!record(row) ||
			!Object.hasOwn(row, "identity") ||
			typeof row.identity !== "string" ||
			!Object.hasOwn(row, "values") ||
			!record(row.values) ||
			!Object.values(row.values).every((cell) => typeof cell === "string")
		) {
			return null;
		}
		const values = row.values;
		rows.push({
			identity: row.identity,
			cells: columns.map((column) =>
				Object.hasOwn(values, column) ? (values[column] as string) : null,
			),
		});
	}
	return {
		columns,
		rows,
		returnedRows: value.returned_rows,
		knownAtCursor: value.known_at_cursor,
		truncated: value.truncated,
	};
}
