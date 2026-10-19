import type { QueryResponse } from "~/types";
import { layoutRRFlowQL } from "../../../rrflow/editor/lexical";
import type { RRFlowQL } from "./contract";
import { formatRRFlowValue, parseRRFlowValue } from "./values";

export const RRFLOWQL_VALIDATION_UNAVAILABLE =
	"RRFlowQL validation is unavailable: this RRD public contract does not expose a parse or validate operation. Queries are validated by RRD when executed.";

/**
 * RRFlow client presentation services. Native query semantics stay in RRD;
 * no upstream grammar, WASM runtime, or alternate parser is loaded here.
 */
export class NativeRRFlowQL implements RRFlowQL {
	async validateQuery(_source: string): Promise<string | undefined> {
		return RRFLOWQL_VALIDATION_UNAVAILABLE;
	}

	async validateWhere(_source: string): Promise<string | undefined> {
		return RRFLOWQL_VALIDATION_UNAVAILABLE;
	}

	async formatValue(value: unknown, _json = false, pretty = false): Promise<string> {
		return formatRRFlowValue(value, pretty);
	}

	async parseValue<T = unknown>(source: string): Promise<T> {
		return parseRRFlowValue<T>(source);
	}

	async getLiveQueries(_source: string, responses: QueryResponse[]): Promise<number[]> {
		// Public result metadata, never source-text guessing, identifies live
		// responses. Failed query responses remain in the caller's result list.
		return responses.flatMap((response, index) =>
			response.success && response.type === "live" ? [index] : [],
		);
	}

	async formatQuery(source: string, pretty = true): Promise<string> {
		return layoutRRFlowQL(source, pretty);
	}

	async extractKindRecords(kind: string): Promise<string[]> {
		// RuntimePropertySchema.value_type is a closed scalar/container enum;
		// native relation targets instead live in RuntimeRelationSchema.from/to.
		if (/^(null|bool|integer|unsigned|decimal|string|digest|list|map)$/u.test(kind)) return [];
		throw new Error(
			"RRD does not expose record targets in a textual field kind. Use the native relation schema's from/to types.",
		);
	}
}
