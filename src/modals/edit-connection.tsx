import { Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { closeModal, openModal } from "@mantine/modals";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo } from "react";
import { useImmer } from "use-immer";
import { ConnectionAddressDetails } from "~/components/ConnectionDetails/address";
import { ConnectionAuthDetails } from "~/components/ConnectionDetails/authentication";
import { ConnectionNameDetails } from "~/components/ConnectionDetails/connection";
import { ConnectionLabelsDetails } from "~/components/ConnectionDetails/labels";
import { Form } from "~/components/Form";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useStable } from "~/hooks/stable";
import { openConnection } from "~/screens/connectome/connection/connection";
import { SESSION_QUERY_KEY } from "~/screens/connectome/pages/RuntimeConnection/session";
import { getActiveConnection, isConnectionValid } from "~/shared/util/connection";
import { useConfigStore } from "~/shell/stores/config";
import { Connection } from "~/types";

export function openConnectionEditModal(connection: Connection) {
	openModal({
		modalId: "connection-edit",
		title: <PrimaryTitle>Edit connection</PrimaryTitle>,
		size: connection.authentication.mode === "cloud" ? "md" : "xl",
		withCloseButton: true,
		children: <ConnectionEditor value={connection} />,
	});
}

interface ConnectionEditorProps {
	value: Connection;
}

function ConnectionEditor({ value }: ConnectionEditorProps) {
	const { updateConnection } = useConfigStore.getState();
	const queryClient = useQueryClient();

	const [connection, setConnection] = useImmer(value);
	const isRuntime = connection.target === "runtime";

	const isValid = useMemo(() => {
		if (isRuntime) {
			if (!connection.name || !["http", "https"].includes(connection.authentication.protocol))
				return false;
			try {
				const endpoint = new URL(
					`${connection.authentication.protocol}://${connection.authentication.hostname}`,
				);
				return (
					endpoint.pathname === "/" &&
					!endpoint.username &&
					!endpoint.password &&
					!endpoint.search &&
					!endpoint.hash
				);
			} catch {
				return false;
			}
		}
		return connection.name && isConnectionValid(connection.authentication);
	}, [connection.authentication, connection.name, isRuntime]);

	const handleSave = useStable(async () => {
		updateConnection(connection);
		closeModal("connection-edit");
		if (isRuntime) {
			await Promise.all([
				queryClient.resetQueries({
					predicate: (query) =>
						query.queryKey[0] === "rrd-runtime-handshake" &&
						query.queryKey[1] === connection.id,
				}),
				queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY, refetchType: "all" }),
			]);
		} else if (getActiveConnection() === connection.id) await openConnection({ connection });
	});

	const browseProject = useStable(async () => {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Select the existing installed RRFlow project",
		});
		if (typeof selected === "string")
			setConnection((draft) => {
				draft.runtimeProject = selected;
			});
	});
	const isCloud = !isRuntime && value.authentication.mode === "cloud";

	return (
		<Form onSubmit={handleSave}>
			<Stack gap="xl">
				<Box>
					<Text
						fz="xl"
						fw={600}
						c="bright"
					>
						Connection
					</Text>
					<Text>Specify an icon and name for this connection</Text>
				</Box>

				<ConnectionNameDetails
					value={connection}
					onChange={setConnection}
				/>

				{isCloud ? (
					<>
						<Box mt="xl">
							<Text
								fz="xl"
								fw={600}
								c="bright"
							>
								Protocol
							</Text>
							<Text>Select a communication protocol for this connection</Text>
						</Box>

						<ConnectionAddressDetails
							value={connection}
							onChange={setConnection}
							withHostname={false}
						/>
					</>
				) : (
					<>
						<Box mt="xl">
							<Text
								fz="xl"
								fw={600}
								c="bright"
							>
								{isRuntime ? "RRD HTTP address" : "Remote address"}
							</Text>
							<Text>
								Select a communication protocol and specify instance address
							</Text>
						</Box>

						<ConnectionAddressDetails
							value={connection}
							onChange={setConnection}
						/>

						<Box mt="xl">
							<Text
								fz="xl"
								fw={600}
								c="bright"
							>
								{isRuntime
									? "Installed RRFlow project and session"
									: "Authentication"}
							</Text>
							<Text>
								{isRuntime
									? "Open this saved instance from an existing installed project. Credentials stay in the native process."
									: "Specify how you want to access your instance"}
							</Text>
						</Box>

						{isRuntime ? (
							<Stack>
								<TextInput
									label="SSH host (optional)"
									placeholder="devstation"
									value={connection.runtimeSshHost ?? ""}
									onChange={(event) => {
										const host = event.currentTarget.value;
										setConnection((draft) => {
											draft.runtimeSshHost = host || undefined;
										});
									}}
									description="Use an existing SSH config host. Reconnect restores access to its running RRFlow instance."
								/>
								{!connection.runtimeSshHost && (
									<Group align="flex-end">
										<TextInput
											flex={1}
											label="Existing installed project"
											value={connection.runtimeProject ?? ""}
											placeholder="Directory containing .rrflow/config.toml"
											description="Opening this profile never creates or installs a project."
											onChange={(event) => {
												const path = event.currentTarget.value;
												setConnection((draft) => {
													draft.runtimeProject = path || undefined;
												});
											}}
										/>
										<Button
											disabled={!isTauri()}
											variant="light"
											onClick={browseProject}
										>
											Browse
										</Button>
									</Group>
								)}
								<TextInput
									label="Expected instance ID (optional)"
									value={connection.runtimeInstance ?? ""}
									onChange={(event) => {
										const instance = event.currentTarget.value;
										setConnection((draft) => {
											draft.runtimeInstance = instance || undefined;
										});
									}}
									description="A different instance is rejected; this does not rename or replace an estate."
								/>
								<TextInput
									label="Operator credential file"
									value={connection.runtimeCredential ?? ""}
									onChange={(event) => {
										const credential = event.currentTarget.value;
										setConnection((draft) => {
											draft.runtimeCredential = credential || undefined;
										});
									}}
									description="A native file reference only. Its contents are never read by this window."
								/>
							</Stack>
						) : (
							<ConnectionAuthDetails
								value={connection}
								onChange={setConnection}
							/>
						)}
					</>
				)}

				<Box mt="xl">
					<Text
						fz="xl"
						fw={600}
						c="bright"
					>
						Labels
					</Text>
					<Text>Add filtering labels to this connection</Text>
				</Box>

				<ConnectionLabelsDetails
					value={connection}
					onChange={setConnection}
				/>

				<Group mt="xl">
					<Button
						flex={1}
						color="obsidian"
						variant="light"
						onClick={() => closeModal("connection-edit")}
					>
						Close
					</Button>
					<Button
						flex={1}
						variant="gradient"
						disabled={!isValid}
						type="submit"
					>
						Save changes
					</Button>
				</Group>
			</Stack>
		</Form>
	);
}
