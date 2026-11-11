import { useLayoutEffect } from "react";
import { adapter } from "~/adapter";
import { useSetting } from "~/hooks/app/config";
import { useConnection, useView } from "~/hooks/connection/connection";
import { useInterfaceStore } from "~/shell/stores/interface";

const NAME =
	import.meta.env.VITE_Connectome_PREVIEW === "true" ? "Connectome Preview" : "Connectome";

/**
 * Synchronize the title of the window with the current view
 */
export function useTitleSync() {
	const connection = useConnection((c) => c?.name);
	const viewName = useView()?.name;
	const [pinned] = useSetting("behavior", "windowPinned");

	useLayoutEffect(() => {
		const segments: string[] = [];

		if (connection) {
			segments.push(`${connection} -`);
		}

		segments.push(`${NAME} ${viewName || ""}`);

		if (pinned) {
			segments.push("(Pinned)");
		}

		const title = segments.join(" ");

		adapter.setWindowTitle(title);
		useInterfaceStore.getState().setWindowTitle(title);
	}, [viewName, connection, pinned]);
}
