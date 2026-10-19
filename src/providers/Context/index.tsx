import { createContext, PropsWithChildren, useContext, useState } from "react";
import { __throw } from "~/shared/util/helpers";
import { RRFlow } from "../../rrflow/client/native";

const ContextContext = createContext<{
	rrflow: RRFlow;
	connected: boolean;
	authenticated: boolean;
} | null>(null);

/**
 * Access the RRFlow Context connection
 */
export function useContextConnection() {
	const ctx = useContext(ContextContext) ?? __throw("Missing ContextProvider");
	return [ctx.rrflow, ctx.connected && ctx.authenticated] as const;
}

export function ContextProvider({ children }: PropsWithChildren) {
	const [rrflow] = useState(new RRFlow());
	// Sidekick views remain available as authored. Their data requests stay
	// disabled until an explicit RRFlow cloud context capability is connected.
	// An account access token does not authorize an implicit database connection.
	return (
		<ContextContext.Provider value={{ rrflow, connected: false, authenticated: false }}>
			{children}
		</ContextContext.Provider>
	);
}
