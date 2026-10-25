import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";

export type RuntimeLens = "models" | "records" | "vectors" | "storage";

export interface RuntimeLensProps {
	client: RrdSessionClient;
	connection: RrdConnectionView;
	/** Scopes cached lens reads to one native session. */
	sessionKey: string;
}

/** One record focus shared by every lens, so a selection follows the reader. */
export interface RecordFocusProps {
	/** The selected record as `kind:id`. */
	selected: string | null;
	onSelect: (record: string | null) => void;
	/** How both maps color records; a value from `colorOptions`. */
	colorBy: string;
	onColorBy: (value: string) => void;
	/** Switch lens, keeping the selection. */
	onOpenLens: (lens: RuntimeLens) => void;
}

/** The diagnostic snapshot both maps read; one cached read per session. */
export function databaseQueryKey(sessionKey: string) {
	return ["rrd-database", sessionKey] as const;
}
