import { tryit } from "radash";
import type { Formatter } from "~/hooks/connection/rrflowql";
import type { QueryResponse, QueryTab } from "~/shared/types";

export interface PreviewProps {
	responses: QueryResponse[];
	selected: number;
	query: QueryTab;
	isLive: boolean;
}

export async function attemptFormat(format: Formatter, data: any): Promise<string> {
	const [err, res] = await tryit(format)(data);

	return err ? `"Error: ${err.message}"` : res;
}
