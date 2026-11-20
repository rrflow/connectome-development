import { Badge, Box, Button, ScrollArea, Stack, Tooltip, UnstyledButton } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import { useMenuCounts } from "~/app/router/menu-counts";
import { areaOf, projectAreas } from "~/app/router/project-menu";
import { InspectorContext } from "../components/inspector";
import { GuideProvider } from "../guides/engine";
import classes from "../style.module.scss";

export interface WorkspaceShellProps {
	project: string;
	route: string;
	onOpen: (route: string) => void;
	top: ReactNode;
	children: ReactNode;
}

/**
 * The project bar and tabs stay in place; the application sidebar owns the area
 * navigation, including before a project is open. Tabs use the same route tree. The work pane and the inspector each scroll by
 * themselves (sprint 016).
 */
export function WorkspaceShell({ project, route, onOpen, top, children }: WorkspaceShellProps) {
	const router = useRouter();
	const areas = useMemo(() => projectAreas(Object.values(router.routesById)), [router]);
	const active = areaOf(areas, route) ?? areas[0];
	const counts = useMenuCounts((state) => (state.project === project ? state.counts : undefined));
	const [target, setTarget] = useState<HTMLElement | null>(null);
	const [open, setOpen] = useState(true);
	const [presented, setPresented] = useState(0);
	const host = useMemo(
		() => ({
			target,
			close: () => setOpen(false),
			present: () => {
				setPresented((count) => count + 1);
				return () => setPresented((count) => count - 1);
			},
		}),
		[target],
	);

	return (
		<GuideProvider
			route={route}
			onOpen={onOpen}
		>
			<Box
				flex={1}
				pos="relative"
				miw={0}
			>
				<div className={classes.workspace}>
					<div className={classes.workspaceTop}>{top}</div>
					<div className={classes.workspaceBody}>
						<div className={classes.workspaceMain}>
							<div
								role="tablist"
								aria-label={`${active?.label ?? "Project"} views`}
								className={classes.areaTabs}
							>
								{active?.tabs.map((tab) => {
									const count = tab.count ? counts?.[tab.count] : undefined;
									return (
										<Tooltip
											key={tab.path}
											label={tab.hint}
											openDelay={500}
											multiline
											w={240}
										>
											<UnstyledButton
												role="tab"
												className={classes.areaTab}
												data-active={tab.path === route || undefined}
												aria-selected={tab.path === route}
												aria-label={tab.label}
												onClick={() => onOpen(tab.path)}
											>
												{tab.label}
												{count !== undefined && (
													<Badge
														aria-hidden
														ml={6}
														size="xs"
														variant="light"
														color="slate"
													>
														{count}
													</Badge>
												)}
											</UnstyledButton>
										</Tooltip>
									);
								})}
								{!open && presented > 0 && (
									<Button
										ml="auto"
										size="compact-xs"
										variant="subtle"
										color="obsidian"
										onClick={() => setOpen(true)}
									>
										Show details
									</Button>
								)}
							</div>
							<div className={classes.workspacePane}>
								<ScrollArea
									key={route}
									pos="absolute"
									inset={0}
									type="scroll"
									scrollbars="y"
								>
									<InspectorContext.Provider value={host}>
										<Stack
											px="lg"
											py="md"
											pb="xl"
											mx="auto"
											maw={1400}
										>
											{children}
										</Stack>
									</InspectorContext.Provider>
								</ScrollArea>
							</div>
						</div>
						<aside
							ref={setTarget}
							aria-label="Details"
							className={classes.inspector}
							data-closed={!open || undefined}
						/>
					</div>
				</div>
			</Box>
		</GuideProvider>
	);
}
