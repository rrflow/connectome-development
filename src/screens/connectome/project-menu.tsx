import { Badge, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMenuCounts } from "~/app/router/menu-counts";
import { projectMenu } from "~/app/router/project-menu";
import { NavigationIcon } from "~/components/NavigationIcon";

export interface ProjectMenuProps {
	project: string;
	collapsed: boolean;
	onOpen: (location: string) => void;
	onMouseEnter: () => void;
}

/**
 * The one menu of a project: every view, grouped, built from the route tree.
 * A count appears only when the project's engine has just reported it.
 */
export function ProjectMenu({ project, collapsed, onOpen, onMouseEnter }: ProjectMenuProps) {
	const router = useRouter();
	const groups = useMemo(() => projectMenu(Object.values(router.routesById)), [router]);
	const counts = useMenuCounts((state) => (state.project === project ? state.counts : undefined));
	const base = `/runtime/${project}`;

	return (
		<Stack
			gap="sm"
			component="nav"
			aria-label="Project views"
		>
			{groups.map((group) => (
				<Stack
					key={group.id}
					gap={4}
				>
					{!collapsed && (
						<Text
							fz={10}
							fw={700}
							tt="uppercase"
							c="slate"
							pl={6}
						>
							{group.label}
						</Text>
					)}
					{group.items.map((item) => {
						const location = item.path ? `${base}/${item.path}` : base;
						const count = item.count ? counts?.[item.count] : undefined;
						return (
							<Tooltip
								key={item.path}
								label={item.hint}
								position="right"
								openDelay={500}
								multiline
								w={240}
							>
								<div>
									<NavigationIcon
										name={
											<Group
												wrap="nowrap"
												justify="space-between"
												gap="xs"
												w="100%"
											>
												<span>{item.label}</span>
												{count !== undefined && (
													<Badge
														size="xs"
														variant="light"
														color="slate"
													>
														{count}
													</Badge>
												)}
											</Group>
										}
										icon={item.icon}
										match={[location]}
										onClick={() => onOpen(location)}
										onMouseEnter={onMouseEnter}
									/>
								</div>
							</Tooltip>
						);
					})}
				</Stack>
			))}
		</Stack>
	);
}
