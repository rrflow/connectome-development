import { createFileRoute } from "@tanstack/react-router";
import { useProject } from "~/features/runtime/project/context";
import { StorageTab } from "~/features/runtime/storage/storage-tab";
import { iconMemory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/storage")({
	staticData: {
		menu: {
			label: "Storage",
			order: 2,
			icon: iconMemory,
			hint: "How the data is kept safe on disk and quick in memory, with live counters.",
		},
	},
	component: View,
});

function View() {
	const { session, client, sessionKey } = useProject();
	return session ? (
		<StorageTab
			connection={session}
			client={client}
			sessionKey={sessionKey}
		/>
	) : null;
}
