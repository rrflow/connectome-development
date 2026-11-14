import { Box, Drawer, Flex, Group, Stack } from "@mantine/core";
import { Outlet } from "@tanstack/react-router";
import { memo, useLayoutEffect } from "react";
import { adapter, isDesktop } from "~/adapter";
import { TopGlow } from "~/components/TopGlow";
import { useSetting } from "~/hooks/app/config";
import { useAbsoluteLocation } from "~/hooks/app/routing";
import { useStable } from "~/hooks/state/stable";
import { useGlowOffset } from "~/hooks/ui/glow";
import { AppTitleBar } from "~/shell/components/AppTitleBar";
import { useInterfaceStore } from "~/shell/stores/interface";
import { ConnectomeSidebar } from "./sidebar";
import classes from "./style.module.scss";
import { ConnectomeToolbar } from "./toolbar";

const DatabaseSidebarLazy = memo(ConnectomeSidebar);

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
	const [location] = useAbsoluteLocation();
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
							data-workspace={location.startsWith("/runtime/") || undefined}
						>
							<ConnectomeToolbar />
						</Group>

						<Outlet />
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
