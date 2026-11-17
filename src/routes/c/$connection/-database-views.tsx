import { Stack } from "@mantine/core";
import { type FC, memo, Suspense } from "react";
import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from "react-reverse-portal";
import { AppRedirect } from "~/components/AppLink";
import AuthenticationView from "~/features/authentication/AuthenticationView";
import DesignerView from "~/features/designer/DesignerView";
import DocumentationView from "~/features/documentation/DocumentationView";
import ExplorerView from "~/features/explorer/ExplorerView";
import FunctionsView from "~/features/functions/FunctionsView";
import GraphqlView from "~/features/graphql/GraphqlView";
import MigrationView from "~/features/migration/MigrationView";
import ParametersView from "~/features/parameters/ParametersView";
import QueryView from "~/features/query/QueryView";
import { useAvailableViews } from "~/hooks/connection/connection";
import type { ViewPage } from "~/shared/types";
import { getConnectionById } from "~/shared/util/connection/connection";

const PORTAL_OPTIONS = {
	attributes: {
		style: "height: 100%; display: flex; flex-direction: column;",
	},
};

const VIEW_PORTALS: Record<ViewPage, HtmlPortalNode> = {
	query: createHtmlPortalNode(PORTAL_OPTIONS),
	explorer: createHtmlPortalNode(PORTAL_OPTIONS),
	graphql: createHtmlPortalNode(PORTAL_OPTIONS),
	designer: createHtmlPortalNode(PORTAL_OPTIONS),
	authentication: createHtmlPortalNode(PORTAL_OPTIONS),
	functions: createHtmlPortalNode(PORTAL_OPTIONS),
	parameters: createHtmlPortalNode(PORTAL_OPTIONS),
	documentation: createHtmlPortalNode(PORTAL_OPTIONS),
	migrations: createHtmlPortalNode(PORTAL_OPTIONS),
};

const VIEW_COMPONENTS: Record<ViewPage, FC> = {
	query: memo(QueryView),
	explorer: memo(ExplorerView),
	graphql: memo(GraphqlView),
	designer: memo(DesignerView),
	authentication: memo(AuthenticationView),
	functions: memo(FunctionsView),
	parameters: memo(ParametersView),
	documentation: memo(DocumentationView),
	migrations: memo(MigrationView),
};

/**
 * The inherited database tools for a connection that is not an RRFlow project.
 * Each stays mounted in its portal so switching between them keeps its state.
 */
export function DatabaseViews({ connection, view }: { connection: string; view: string }) {
	const views = useAvailableViews();
	const profile = getConnectionById(connection);

	if (profile?.target === "control-plane") {
		return <AppRedirect to={`/control/${profile.id}`} />;
	}
	if (profile?.target === "diagnostics") {
		return <AppRedirect to={`/diagnostics/${profile.id}`} />;
	}
	if (profile?.target === "runtime") {
		return <AppRedirect to={`/runtime/${profile.id}`} />;
	}

	const active = view as ViewPage;
	const portal = views[active] ? VIEW_PORTALS[active] : undefined;

	return (
		<>
			{Object.values(views).map((mode) => {
				const Content = VIEW_COMPONENTS[mode.id];

				return (
					<InPortal
						key={mode.id}
						node={VIEW_PORTALS[mode.id]}
					>
						<Suspense fallback={null}>
							<Content />
						</Suspense>
					</InPortal>
				);
			})}

			{portal ? (
				<Stack
					flex={1}
					gap={0}
				>
					<OutPortal node={portal} />
				</Stack>
			) : (
				<AppRedirect to="/overview" />
			)}
		</>
	);
}
