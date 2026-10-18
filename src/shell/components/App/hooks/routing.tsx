import { useLayoutEffect } from "react";
import { useAbsoluteLocation, useSearchParams } from "~/hooks/routing";
import { handleIntentRequest } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";

export function useAppRouter() {
	const { setActiveResource } = useConfigStore.getState();

	const [path, setPath] = useAbsoluteLocation();
	const { intent } = useSearchParams();
	const resource = useConfigStore((s) => s.activeResource);

	// Restore active resource
	useLayoutEffect(() => {
		if (path === "/") {
			if (!resource || resource === "/") {
				setPath("/overview");
			} else {
				setPath(resource);
			}
		} else {
			setActiveResource(path);
		}
	}, [path, resource, setActiveResource]);

	// Handle intent requests
	useLayoutEffect(() => {
		if (intent) {
			handleIntentRequest(intent);
		}
	}, [intent]);
}
