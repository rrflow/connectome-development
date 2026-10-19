import { Box, Drawer, Flex, Group, Stack } from "@mantine/core";
import { memo, useLayoutEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import { adapter, isDesktop } from "~/adapter";
import { TopGlow } from "~/components/TopGlow";
import { useSetting } from "~/hooks/config";
import { useGlowOffset } from "~/hooks/glow";
import { useStable } from "~/hooks/stable";
import { getConnectionById } from "~/shared/util/connection";
import { AppTitleBar } from "~/shell/components/AppTitleBar";
import { useInterfaceStore } from "~/shell/stores/interface";
import { ControlPlanePage } from "./pages/ControlPlane";
import { CreateConnectionPage } from "./pages/CreateConnection";
import { OverviewPage } from "./pages/Overview";
import { RuntimeConnectionPage } from "./pages/RuntimeConnection";
import { ConnectomeSidebar } from "./sidebar";
import classes from "./style.module.scss";
import { ConnectomeToolbar } from "./toolbar";

const DatabaseSidebarLazy = memo(ConnectomeSidebar);
const OverviewPageLazy = memo(OverviewPage);
const CreateConnectionPageLazy = memo(CreateConnectionPage);

export function ConnectomeScreen() {
	const { setOverlaySidebar } = useInterfaceStore.getState();

	const overlaySidebar = useInterfaceStore((s) => s.overlaySidebar);
	const title = useInterfaceStore((s) => s.title);

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

							<Route path="/runtime/:id">
								{({ id }) => <RuntimeConnectionPage id={id} />}
							</Route>

							<Route path="/c/:connection/:view?">
								{({ connection }) => {
									const profile = getConnectionById(connection);
									if (profile?.target === "control-plane") {
										return <Redirect to={`/control/${profile.id}`} />;
									}
									if (profile) {
										return <Redirect to={`/runtime/${profile.id}`} />;
									}
									return <Redirect to="/overview" />;
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
