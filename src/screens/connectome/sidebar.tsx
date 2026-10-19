import {
	Box,
	type BoxProps,
	Divider,
	Flex,
	Group,
	Image,
	ScrollArea,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import clsx from "clsx";
import { Fragment, useMemo } from "react";
import { useCloudUnreadConversationsQuery } from "~/cloud/queries/context";
import { NavigationIcon } from "~/components/NavigationIcon";
import { Shortcut } from "~/components/Shortcut";
import { Spacer } from "~/components/Spacer";
import { useBoolean } from "~/hooks/boolean";
import { useAvailablePages, useAvailableViews } from "~/hooks/connection";
import { useAbsoluteLocation, useConnectionAndView, useConnectionNavigator } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { useIsLight } from "~/hooks/theme";
import { isMobile } from "~/shared/util/helpers";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { useInterfaceStore } from "~/shell/stores/interface";
import type { GlobalPage, SidebarMode, ViewPage } from "~/types";
import { iconArrowLeft, iconCog, iconHelp, iconSearch, pictoBrain } from "../../rrflow/ui/index";
import classes from "./style.module.scss";

const GLOBAL_NAVIGATION: GlobalPage[][] = [
	["/overview", "/organisations"],
	["/referrals"],
	["/mini/new"],
];

const VIEW_NAVIGATION: ViewPage[][] = [
	["dashboard", "monitor", "migrations"],
	["query", "explorer", "graphql"],
	["designer", "authentication", "parameters", "functions"],
	["documentation"],
];

interface NavigationItem {
	name: string;
	icon: string;
	match: string[];
	navigate: () => void;
}

export interface ConnectomeSidebarProps extends BoxProps {
	sidebarMode: SidebarMode;
}

export function ConnectomeSidebar({ sidebarMode, className, ...other }: ConnectomeSidebarProps) {
	const isLight = useIsLight();
	const [, navigate] = useAbsoluteLocation();
	const [connection] = useConnectionAndView();
	const navigateConnection = useConnectionNavigator();
	const availableUpdate = useInterfaceStore((s) => s.availableUpdate);
	const sidebarViews = useConfigStore((s) => s.settings.appearance.sidebarViews);
	const pages = useAvailablePages();
	const views = useAvailableViews();

	const { data: unreadConversations } = useCloudUnreadConversationsQuery();

	const { setOverlaySidebar } = useInterfaceStore.getState();
	const [canHoverSidebar, hoverSidebarHandle] = useBoolean(true);

	const setLocation = useStable((location: string) => {
		hoverSidebarHandle.close();
		navigate(location);
	});

	const globalNavigation: NavigationItem[][] = useMemo(() => {
		return GLOBAL_NAVIGATION.flatMap((row) => {
			const items = row.flatMap((id) => {
				const info = pages[id];

				if (!info) {
					return [];
				}

				return {
					id: info.id,
					name: info.name,
					icon: info.icon,
					match: [info.id, ...(info.aliases || [])],
					navigate: () => setLocation(info.id),
				};
			});

			return items.length > 0 ? [items] : [];
		});
	}, [pages]);

	const viewNavigation: NavigationItem[][] = useMemo(() => {
		if (!connection) {
			return [];
		}

		return VIEW_NAVIGATION.flatMap((row) => {
			const items = row.flatMap((id) => {
				const info = views[id];

				if (!info || sidebarViews[id] === false) {
					return [];
				}

				return {
					id: info.id,
					name: info.name,
					icon: info.icon,
					match: [`/c/*/${info.id}`],
					disabled: !connection,
					navigate: () => {
						hoverSidebarHandle.close();
						navigateConnection(connection, info.id);
					},
				};
			});

			return items.length > 0 ? [items] : [];
		});
	}, [views, sidebarViews, connection]);

	const navigation = connection ? viewNavigation : globalNavigation;

	const openSettings = useStable(() => dispatchIntent("open-settings"));
	const openCommands = useStable(() => dispatchIntent("open-command-palette"));

	const isHoverable = sidebarMode === "expandable" && canHoverSidebar;
	const isCollapsed = sidebarMode === "compact" || sidebarMode === "expandable";
	const isFilled = sidebarMode === "fill";

	return (
		<ScrollArea
			scrollbars="y"
			type="never"
			pos="fixed"
			component="aside"
			top={0}
			left={0}
			bottom={0}
			bg="var(--mantine-color-body)"
			onMouseEnter={hoverSidebarHandle.open}
			className={clsx(
				classes.sidebar,
				isHoverable && classes.sidebarHoverable,
				isCollapsed && classes.sidebarCollapsed,
				isFilled && classes.sidebarFill,
				className,
			)}
			{...other}
		>
			<Flex
				className={classes.sidebarInner}
				direction="column"
				px={16}
			>
				<UnstyledButton
					onClick={() => {
						setLocation("/overview");
						setOverlaySidebar(false);
					}}
				>
					<Group
						gap="lg"
						wrap="nowrap"
						align="center"
						style={{ flexShrink: 0 }}
					>
						<Image
							my={-9}
							src={pictoBrain}
							w={42}
							className={classes.hat}
						/>
						<Box className={classes.wordmark}>
							<Text
								className={classes.wordmarkTitle}
								fw={750}
								lh={1}
							>
								CONNECTOME
							</Text>
							<Text
								className={classes.wordmarkSub}
								fz={9}
								fw={650}
								lh={1.5}
							>
								RRFLOW CONTROL SURFACE
							</Text>
						</Box>
					</Group>
				</UnstyledButton>
				<Stack
					gap="sm"
					mt={22}
					pb={18}
					component="nav"
					flex={1}
				>
					{connection && (
						<>
							<NavigationIcon
								name="Overview"
								icon={iconArrowLeft}
								onClick={() => setLocation("/overview")}
								onMouseEnter={hoverSidebarHandle.open}
								withTooltip={sidebarMode === "compact"}
							/>
							<Divider color={isLight ? "obsidian.2" : "obsidian.7"} />
						</>
					)}

					{navigation.map((items, i) => (
						<Fragment key={i}>
							{items.map((info) => (
								<Group
									key={info.name}
									gap="lg"
									wrap="nowrap"
								>
									<NavigationIcon
										name={info.name}
										icon={info.icon}
										match={info.match}
										onClick={info.navigate}
										onMouseEnter={hoverSidebarHandle.open}
										withTooltip={sidebarMode === "compact"}
									/>
								</Group>
							))}
							{i < navigation.length - 1 && (
								<Divider color={isLight ? "obsidian.2" : "obsidian.7"} />
							)}
						</Fragment>
					))}

					<Spacer />

					<NavigationIcon
						name={
							<Group wrap="nowrap">
								Search
								{!isMobile() && <Shortcut value={["mod", "K"]} />}
							</Group>
						}
						icon={iconSearch}
						onClick={openCommands}
						onMouseEnter={hoverSidebarHandle.open}
						withTooltip={sidebarMode === "compact"}
					/>

					<NavigationIcon
						name="Support"
						icon={iconHelp}
						match={["/support", "/support/*"]}
						onClick={() => navigate("/support")}
						onMouseEnter={hoverSidebarHandle.open}
						withTooltip={sidebarMode === "compact"}
						indicator={unreadConversations}
					/>

					<NavigationIcon
						name="Settings"
						icon={iconCog}
						onClick={openSettings}
						onMouseEnter={hoverSidebarHandle.open}
						withTooltip={sidebarMode === "compact"}
						indicator={!!availableUpdate}
					/>
				</Stack>
			</Flex>
		</ScrollArea>
	);
}
