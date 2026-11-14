import { createFileRoute } from "@tanstack/react-router";
import { ApiReference } from "~/features/runtime/api-reference";
import { useProject } from "~/features/runtime/project/context";
import { iconAPI } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/api")({
	staticData: {
		menu: {
			label: "API reference",
			group: "system",
			order: 9,
			icon: iconAPI,
			hint: "Every operation this engine serves, with an example in each language.",
		},
	},
	component: View,
});

function View() {
	const { endpoint, handshake, connection } = useProject();
	return (
		<ApiReference
			endpoint={endpoint}
			instance={handshake?.service.instance.id ?? connection.runtimeInstance}
		/>
	);
}
