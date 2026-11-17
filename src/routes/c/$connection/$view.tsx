import { createFileRoute } from "@tanstack/react-router";
import { DatabaseViews } from "./-database-views";

export const Route = createFileRoute("/c/$connection/$view")({
	component: () => {
		const { connection, view } = Route.useParams();
		return (
			<DatabaseViews
				connection={connection}
				view={view}
			/>
		);
	},
});
