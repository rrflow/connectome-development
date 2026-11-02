import { Box, ScrollArea, Stack, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";
import { Icon } from "~/components/Icon";
import { WORKSPACE_AREAS, workspaceArea } from "./areas";
import classes from "./style.module.scss";

export interface WorkspaceShellProps {
	route: string;
	onOpen: (route: string) => void;
	top: ReactNode;
	children: ReactNode;
}

/**
 * One window: the project bar, the area rail and the tabs stay in place, and only
 * the work pane scrolls (sprint 016).
 */
export function WorkspaceShell({ route, onOpen, top, children }: WorkspaceShellProps) {
	const active = workspaceArea(route);

	return (
		<Box
			flex={1}
			pos="relative"
			miw={0}
		>
			<div className={classes.workspace}>
				<div className={classes.workspaceTop}>{top}</div>
				<div className={classes.workspaceBody}>
					<nav
						aria-label="Project areas"
						className={classes.areaRail}
					>
						{WORKSPACE_AREAS.map((area) => (
							<UnstyledButton
								key={area.id}
								className={classes.area}
								data-active={area.id === active.id || undefined}
								aria-current={area.id === active.id ? "page" : undefined}
								onClick={() => onOpen(area.tabs[0].route)}
							>
								<Icon path={area.icon} />
								<span>{area.label}</span>
							</UnstyledButton>
						))}
					</nav>
					<div className={classes.workspaceMain}>
						<div
							role="tablist"
							aria-label={`${active.label} views`}
							className={classes.areaTabs}
						>
							{active.tabs.map((tab) => (
								<UnstyledButton
									key={tab.route}
									role="tab"
									className={classes.areaTab}
									data-active={tab.route === route || undefined}
									aria-selected={tab.route === route}
									onClick={() => onOpen(tab.route)}
								>
									{tab.label}
								</UnstyledButton>
							))}
						</div>
						<div className={classes.workspacePane}>
							<ScrollArea
								key={route}
								pos="absolute"
								inset={0}
								type="scroll"
								scrollbars="y"
							>
								<Stack
									px="lg"
									py="md"
									pb="xl"
									mx="auto"
									maw={1400}
								>
									{children}
								</Stack>
							</ScrollArea>
						</div>
					</div>
				</div>
			</div>
		</Box>
	);
}
