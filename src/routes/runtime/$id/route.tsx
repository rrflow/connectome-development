import { createFileRoute } from "@tanstack/react-router";
import { ProjectLayout } from "~/features/runtime/project/layout";

export const Route = createFileRoute("/runtime/$id")({
	component: () => {
		const { id } = Route.useParams();
		return (
			<ProjectLayout
				key={id}
				id={id}
			/>
		);
	},
});
