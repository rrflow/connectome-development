import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";

export interface RuntimeLensProps {
	client: RrdSessionClient;
	connection: RrdConnectionView;
	/** Scopes cached lens reads to one native session. */
	sessionKey: string;
}
