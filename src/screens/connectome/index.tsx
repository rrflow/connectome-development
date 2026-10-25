import { Box, Drawer, Flex, Group, Stack } from "@mantine/core";
import { type FC, memo, Suspense, useLayoutEffect } from "react";
import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from "react-reverse-portal";
import { Redirect, Route, Switch } from "wouter";
import { adapter, isDesktop } from "~/adapter";
import { TopGlow } from "~/components/TopGlow";
import { useSetting } from "~/hooks/config";
import { useAvailableViews } from "~/hooks/connection";
import { useGlowOffset } from "~/hooks/glow";
import { useStable } from "~/hooks/stable";
import { getConnectionById } from "~/shared/util/connection";
import { AppTitleBar } from "~/shell/components/AppTitleBar";
import { useInterfaceStore } from "~/shell/stores/interface";
import type { ViewPage } from "~/types";
import { ControlPlanePage } from "./pages/ControlPlane";
import { CreateConnectionPage } from "./pages/CreateConnection";
import { OverviewPage } from "./pages/Overview";
import { RuntimeConnectionPage } from "./pages/RuntimeConnection";
import { RuntimeDiagnosticsPage } from "./pages/RuntimeDiagnostics";
import { ConnectomeSidebar } from "./sidebar";
import classes from "./style.module.scss";
import { ConnectomeToolbar } from "./toolbar";
import AuthenticationView from "./views/authentication/AuthenticationView";
import DesignerView from "./views/designer/DesignerView";
import DocumentationView from "./views/documentation/DocumentationView";
import ExplorerView from "./views/explorer/ExplorerView";
import FunctionsView from "./views/functions/FunctionsView";
import GraphqlView from "./views/graphql/GraphqlView";
import MigrationView from "./views/migration/MigrationView";
import ParametersView from "./views/parameters/ParametersView";
import QueryView from "./views/query/QueryView";

const DatabaseSidebarLazy = memo(ConnectomeSidebar);
const OverviewPageLazy = memo(OverviewPage);
const CreateConnectionPageLazy = memo(CreateConnectionPage);

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

export function ConnectomeScreen() {
	const { setOverlaySidebar } = useInterfaceStore.getState();

	const overlaySidebar = useInterfaceStore((s) => s.overlaySidebar);
	const title = useInterfaceStore((s) => s.title);
	const views = useAvailableViews();

	const [sidebarMode] = useSetting("appearance", "sidebarMode");
	const isMacos = adapter.platform === "darwin" && isDesktop;
	const isOtherOS = adapter.platform !== "darwin" && isDesktop;

	const onCloseSidebar = useStable(() => {
		setOverlaySidebar(false);
	});

	const glowOffset = useGlowOffset();
	const sidebarOffset = 25 + (sidebarMode === "wide" ? 190 : 49);

	useLayoutEffect(() => {
		const body = document.body;

		body.style.setProperty("--sidebar-offset", `${sidebarOffset}px`);
		body.style.setProperty("--titlebar-offset", `${adapter.titlebarOffset}px`);
	}, [sidebarOffset]);

	return (
		<Box
			className={classes.root}
			bg="var(--mantine-color-body)"
		>
			{isOtherOS && <AppTitleBar />}
			<Flex
				direction="column"
				flex={1}
				pos="relative"
			>
				<DatabaseSidebarLazy
					sidebarMode={sidebarMode}
					visibleFrom="md"
				/>

				<Box className={classes.wrapper}>
					{isMacos && (
						<Flex
							data-tauri-drag-region
							className={classes.titlebar}
							justify="center"
							align="center"
						>
							{title}
						</Flex>
					)}

					<Stack
						flex={1}
						className={classes.pageContent}
						pos="relative"
						gap="lg"
					>
						<TopGlow offset={glowOffset} />

						<Group
							gap="md"
							pos="absolute"
							left={0}
							right={0}
							top={0}
							align="center"
							wrap="nowrap"
							className={classes.toolbar}
						>
							<ConnectomeToolbar />
						</Group>

						<Switch>
							<Route path="/" />

							<Route path="/overview">
								<OverviewPageLazy />
							</Route>

							<Route path="/connections/create">
								<CreateConnectionPageLazy />
							</Route>

							<Route path="/control/:id">
								{({ id }) => <ControlPlanePage id={id} />}
							</Route>

							<Route path="/diagnostics/:id">
								{({ id }) => <RuntimeDiagnosticsPage id={id} />}
							</Route>

							<Route path="/runtime/:id/:section/:detail">
								{({ id, section, detail }) => (
									<RuntimeConnectionPage
										key={id}
										id={id}
										section={section}
										detail={detail}
									/>
								)}
							</Route>
							<Route path="/runtime/:id/:section">
								{({ id, section }) => (
									<RuntimeConnectionPage
										key={id}
										id={id}
										section={section}
									/>
								)}
							</Route>
							<Route path="/runtime/:id">
								{({ id }) => (
									<RuntimeConnectionPage
										key={id}
										id={id}
									/>
								)}
							</Route>

							<Route path="/c/:connection/:view">
								{({ connection, view }) => {
									const profile = getConnectionById(connection);
									if (profile?.target === "control-plane") {
										return <Redirect to={`/control/${profile.id}`} />;
									}
									if (profile?.target === "diagnostics") {
										return <Redirect to={`/diagnostics/${profile.id}`} />;
									}
									if (profile?.target === "runtime") {
										return <Redirect to={`/runtime/${profile.id}`} />;
									}

									const _view = view as ViewPage;
									const portal = views[_view] ? VIEW_PORTALS[_view] : undefined;

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
												<Redirect to="/overview" />
											)}
										</>
									);
								}}
							</Route>

							<Route>
								<Redirect to="/overview" />
							</Route>
						</Switch>
					</Stack>
				</Box>
			</Flex>

			<Drawer
				withCloseButton={false}
				opened={overlaySidebar}
				onClose={onCloseSidebar}
				size={215}
			>
				<DatabaseSidebarLazy sidebarMode="fill" />
			</Drawer>
		</Box>
	);
}
