import { ActionIcon, Button, Group, Menu, Modal, Select, Stack, Text } from "@mantine/core";
import { useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { type ProjectTab, projectAreas } from "~/app/router/project-menu";
import { Icon } from "~/components/Icon";
import { NavigationIcon } from "~/components/NavigationIcon";
import { useAbsoluteLocation } from "~/hooks/app/routing";
import { iconChevronRight, iconPlay, iconPlus } from "~/shared/assets/icons";
import { dispatchIntent } from "~/shared/util/platform/intents";
import { useConfigStore } from "~/shell/stores/config";

/** The project's existing route catalogue stays discoverable before an engine is selected. */
export function ProjectNavigation({ compact }: { compact: boolean }) {
	const router = useRouter();
	const areas = useMemo(() => projectAreas(Object.values(router.routesById)), [router]);
	const [location, navigate] = useAbsoluteLocation();
	const connections = useConfigStore((state) => state.connections);
	const projects = connections.filter((connection) => connection.target === "runtime");
	const active = projects.find(
		(project) =>
			location.startsWith(`/runtime/${project.id}/`) || location === `/runtime/${project.id}`,
	);
	const [pending, setPending] = useState<ProjectTab | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const open = (tab: ProjectTab) => {
		if (active) navigate(`/runtime/${active.id}/${tab.path}`);
		else {
			setSelected(null);
			setPending(tab);
		}
	};
	const workbench = areas
		.flatMap((area) => area.tabs)
		.find((tab) => tab.path === "reasoning/workbench");
	return (
		<>
			<Stack
				gap={2}
				role="navigation"
				aria-label="Project areas"
			>
				<NavigationIcon
					name="Local engines"
					icon={iconPlay}
					withTooltip={compact}
					onClick={() => dispatchIntent("toggle-serving")}
				/>
				{workbench && (
					<NavigationIcon
						name="Workbench"
						icon={workbench.icon}
						withTooltip={compact}
						onClick={() => open(workbench)}
						match={["/runtime/*/reasoning/workbench"]}
					/>
				)}
				{areas.map((area) => (
					<Group
						key={area.id}
						gap={0}
						wrap="nowrap"
						miw={183}
					>
						<div style={{ flex: 1, minWidth: 0 }}>
							<NavigationIcon
								name={area.label}
								icon={area.icon}
								withTooltip={compact}
								onClick={() => open(area.tabs[0])}
								match={area.tabs.map((tab) => `/runtime/*/${tab.path}`)}
							/>
						</div>
						<Menu
							position="right-start"
							withinPortal
						>
							<Menu.Target>
								<ActionIcon
									variant="subtle"
									color="obsidian"
									aria-label={`${area.label} views`}
								>
									<Icon path={iconChevronRight} />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown>
								<Menu.Label>{area.label}</Menu.Label>
								{area.tabs.map((tab) => (
									<Menu.Item
										key={tab.path}
										leftSection={<Icon path={tab.icon} />}
										onClick={() => open(tab)}
									>
										{tab.label}
									</Menu.Item>
								))}
							</Menu.Dropdown>
						</Menu>
					</Group>
				))}
			</Stack>
			<Modal
				opened={pending !== null}
				onClose={() => setPending(null)}
				title={`Open ${pending?.label ?? "workspace"}`}
			>
				<Stack>
					<Text size="sm">{pending?.hint}</Text>
					<Text size="sm">
						Choose the project whose data you want to use. Opening a view does not start
						an engine or share data between projects.
					</Text>
					{projects.length > 0 ? (
						<>
							<Select
								label="Project"
								placeholder="Choose a project"
								searchable
								value={selected}
								onChange={setSelected}
								data={projects.map((project) => ({
									value: project.id,
									label: project.name,
								}))}
							/>
							<Button
								disabled={!projects.some((project) => project.id === selected)}
								onClick={() => {
									if (
										pending &&
										projects.some((project) => project.id === selected)
									) {
										navigate(`/runtime/${selected}/${pending.path}`);
										setPending(null);
									}
								}}
							>
								Open {pending?.label}
							</Button>
						</>
					) : (
						<Text size="sm">
							No project has been added yet. Start a local engine or connect to an
							existing one.
						</Text>
					)}
					<Group>
						<Button
							variant="light"
							leftSection={<Icon path={iconPlay} />}
							onClick={() => {
								setPending(null);
								dispatchIntent("toggle-serving");
							}}
						>
							Start local RRFlow
						</Button>
						<Button
							variant="subtle"
							leftSection={<Icon path={iconPlus} />}
							onClick={() => {
								setPending(null);
								navigate("/connections/create");
							}}
						>
							Connect remote engine
						</Button>
					</Group>
				</Stack>
			</Modal>
		</>
	);
}
