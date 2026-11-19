import {
	ActionIcon,
	Anchor,
	Badge,
	BoxProps,
	Group,
	Menu,
	Paper,
	Stack,
	Text,
	ThemeIcon,
	UnstyledButton,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { PropsWithChildren, useRef } from "react";
import { removeProject } from "~/components/ActionBar/project-actions";
import { RemovalStatement } from "~/components/ActionBar/project-row";
import { Icon } from "~/components/Icon";
import { Spacer } from "~/components/Spacer";
import { useStable } from "~/hooks/state/stable";
import { openConnectionEditModal } from "~/modals/edit-connection";
import { useConfirmation } from "~/providers/Confirmation";
import { connectionProject } from "~/rrflow/instances";
import { projectRows, rowControls } from "~/rrflow/project-manager";
import { describeRrdError } from "~/rrflow/runtime";
import {
	iconCopy,
	iconDatabase,
	iconDelete,
	iconDotsVertical,
	iconEdit,
} from "~/shared/assets/icons";
import { SANDBOX } from "~/shared/config/constants";
import { Connection } from "~/shared/types";
import { newId, ON_STOP_PROPAGATION, showErrorNotification } from "~/shared/util/text/helpers";
import { USER_ICONS } from "~/shared/util/ui/user-icons";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";

export interface StartConnectionProps extends BoxProps {
	connection: Connection;
	onConnect: (connection: Connection) => void;
}

export function StartConnection({
	connection,
	onConnect,
	children,
	...other
}: PropsWithChildren<StartConnectionProps>) {
	const { addConnection, removeConnection } = useConfigStore.getState();
	const { protocol, hostname } = connection.authentication;

	const containerRef = useRef<HTMLDivElement>(null);
	const isSandbox = connection.id === SANDBOX;
	const isManaged = isSandbox || connection.instance;
	const target = protocol === "mem" ? "In-Memory" : protocol === "indxdb" ? "IndexDB" : hostname;

	const handleConnect = useStable(() => {
		onConnect(connection);
	});

	const handleEdit = useStable(() => {
		openConnectionEditModal(connection);
	});

	const handleDuplicate = useStable(() => {
		addConnection({
			...connection,
			lastNamespace: "",
			lastDatabase: "",
			id: newId(),
		});
	});

	const queryClient = useQueryClient();
	// A project's connection is removed the way the project manager removes
	// the project, with the same statement of what happens.
	const project = connectionProject(connection);
	const instances = useDatabaseStore((state) => state.instances);
	const [row] = project ? projectRows([{ project, name: connection.name }], [], instances) : [];
	// The same rule the manager's row applies: not while it is starting or stopping.
	const removeBlocked = row && rowControls(row.instance, undefined, false).removeBlocked;

	const handleDelete = useConfirmation({
		title: row ? "Remove this project from Connectome?" : "Remove connection",
		message: row ? (
			<RemovalStatement row={row} />
		) : (
			"Are you sure you want to remove this connection?"
		),
		dismissText: row ? "Keep project" : undefined,
		confirmText: row ? "Remove project" : undefined,
		skippable: !row,
		onConfirm() {
			if (!row) return removeConnection(connection.id);
			removeProject(row.project, queryClient).catch((cause) =>
				showErrorNotification({
					title: `${row.name} was not removed`,
					content: describeRrdError(cause),
				}),
			);
		},
	});

	const labels = connection?.labels?.map((label, i) => (
		<Badge
			key={i}
			size="sm"
			color="violet"
			variant="light"
		>
			{label}
		</Badge>
	));

	return (
		<UnstyledButton
			onClick={handleConnect}
			{...other}
		>
			<Anchor
				variant="glow"
				c="var(--mantine-color-text)"
			>
				<Paper
					p="lg"
					ref={containerRef}
				>
					<Group
						wrap="nowrap"
						align="strech"
						flex={1}
						mt={-3}
					>
						<Group wrap="nowrap">
							<ThemeIcon
								size="xl"
								variant="light"
							>
								<Icon
									size={isSandbox ? "lg" : "md"}
									path={isSandbox ? iconDatabase : USER_ICONS[connection.icon]}
								/>
							</ThemeIcon>
							<Stack gap={0}>
								<Group gap="sm">
									<Text
										c="bright"
										fw={600}
										fz="xl"
										truncate
									>
										{connection.name}
									</Text>

									{isManaged ? (
										<Text
											fw={600}
											fz="xs"
											variant="gradient"
										>
											LOCAL
										</Text>
									) : (
										<Group gap="xs">{labels}</Group>
									)}
								</Group>
								<Text truncate>
									{isSandbox ? "Offline RRFlow sandbox" : target}
								</Text>
							</Stack>
						</Group>
						{!isManaged && (
							<>
								<Spacer />
								{/** biome-ignore lint/a11y/noStaticElementInteractions: It's fine */}
								<div
									onClick={ON_STOP_PROPAGATION}
									onKeyDown={ON_STOP_PROPAGATION}
								>
									<Menu
										transitionProps={{
											transition: "scale-y",
										}}
									>
										<Menu.Target>
											<ActionIcon
												color="slate"
												variant="subtle"
												component="div"
											>
												<Icon path={iconDotsVertical} />
											</ActionIcon>
										</Menu.Target>
										<Menu.Dropdown>
											<Menu.Item
												leftSection={<Icon path={iconEdit} />}
												onClick={handleEdit}
											>
												Edit connection
											</Menu.Item>
											<Menu.Item
												leftSection={<Icon path={iconCopy} />}
												onClick={handleDuplicate}
											>
												Duplicate
											</Menu.Item>
											<Menu.Divider />
											<Menu.Item
												leftSection={
													<Icon
														path={iconDelete}
														c="red"
													/>
												}
												onClick={handleDelete}
												disabled={removeBlocked !== undefined}
												c="red"
											>
												{row ? "Remove project" : "Delete"}
												{removeBlocked && (
													<Text size="xs">{removeBlocked}</Text>
												)}
											</Menu.Item>
										</Menu.Dropdown>
									</Menu>
								</div>
							</>
						)}
					</Group>
				</Paper>
			</Anchor>
		</UnstyledButton>
	);
}
