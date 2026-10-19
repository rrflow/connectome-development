import { QueryResponse } from "~/types";

/**
 * An interface providing RRFlowQL functionality
 */
export interface RRFlowQL {
	/**
	 * Return a native validation error or an explicit unavailable reason.
	 * Client presentation tokenization is never evidence of query validity.
	 */
	validateQuery(sql: string): Promise<string | undefined>;

	/**
	 * Validate a where clause and return an error message if invalid
	 */
	validateWhere(where: string): Promise<string | undefined>;

	/**
	 * Format a public value as editable JSON. The json flag is retained for
	 * existing presentation callers; it does not enable a second value grammar.
	 */
	formatValue(value: any, json?: boolean, pretty?: boolean): Promise<string>;

	/**
	 * Deserialize editable JSON without evaluating a query expression
	 */
	parseValue<T = unknown>(value: string): Promise<T>;

	/**
	 * Return the the indexes of the live query statements in the given query
	 */
	getLiveQueries(query: string, responses: QueryResponse[]): Promise<number[]>;

	/**
	 * Lay out source whitespace without canonicalizing or validating a query
	 */
	formatQuery(query: string, pretty?: boolean): Promise<string>;

	/**
	 * Extract the kind records from the given kind
	 */
	extractKindRecords(kind: string): Promise<string[]>;
}
