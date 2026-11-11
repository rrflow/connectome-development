import { useEffect } from "react";
import { closeConnection, openConnection } from "~/connection/connection";
import { useConnectionAndView } from "~/hooks/app/routing";

/**
 * Watch for connection changes and open the connection
 */
export function useConnectionSwitch() {
	const [connection] = useConnectionAndView();

	useEffect(() => {
		if (connection) {
			openConnection();
		} else {
			closeConnection();
		}
	}, [connection]);
}
