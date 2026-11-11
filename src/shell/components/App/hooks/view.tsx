import { useConnectionAndView, useConnectionNavigator } from "~/hooks/app/routing";
import { useEventSubscription } from "~/hooks/state/event";
import { NavigateViewEvent } from "~/shared/util/platform/global-events";

export function useViewSync() {
	const [connection] = useConnectionAndView();
	const navigateConnection = useConnectionNavigator();

	useEventSubscription(NavigateViewEvent, (view) => {
		if (connection) {
			navigateConnection(connection, view);
		}
	});
}
