import { Alert, Badge, Box, Button, Group, Paper, Text, TextInput } from "@mantine/core";
import { Icon, iconErrorCircle, iconKey, iconOpenFolder, iconPower } from "@rrflow/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { RrdHandshake } from "~/rrflow/runtime";
import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";
import { useConfigStore } from "~/shell/stores/config";
import type { Connection } from "~/types";
import { formatTime } from "./format";
import classes from "./style.module.scss";

export const SESSION_QUERY_KEY = ["rrd-session"] as const;

export interface SessionPanelProps {
	client: RrdSessionClient;
	connection: Connection;
	endpoint: string;
	handshake: RrdHandshake | undefined;
	/** The native session when it belongs to this endpoint and instance. */
	session: RrdConnectionView | null;
	/** A native session held for another endpoint or instance. */
	foreign: RrdConnectionView | null;
}

export function SessionPanel({
	client,
	connection,
	endpoint,
	handshake,
	session,
	foreign,
}: SessionPanelProps) {
	const queryClient = useQueryClient();
	const updateConnection = useConfigStore((state) => state.updateConnection);
	const credentialPath = connection.runtimeCredential ?? "";

	const connect = useMutation({
		mutationFn: async () => {
			if (!handshake) {
				throw new Error("Complete the public RRD handshake first");
			}
			// Connectome holds one native session; a session for another
			// endpoint or instance is closed before this one opens.
			if (foreign) {
				await client.disconnect();
			}
			return client.connect({
				endpoint,
				instance: handshake.service.instance.id,
				credential_path: credentialPath,
			});
		},
		onSuccess: (view) => queryClient.setQueryData(SESSION_QUERY_KEY, view),
	});

	const disconnect = useMutation({
		mutationFn: () => client.disconnect(),
		onSettled: () => queryClient.setQueryData(SESSION_QUERY_KEY, null),
	});

	const browse = async () => {
		const selected = await open({
			title: "Select the RRD operator credential file",
			multiple: false,
			directory: false,
			filters: [{ name: "RRD credential", extensions: ["json"] }],
		});
		if (typeof selected === "string") {
			updateConnection({ id: connection.id, runtimeCredential: selected });
		}
	};

	if (!isTauri()) {
		return (
			<Alert
				color="blue"
				title="Authenticated lenses need the desktop app"
			>
				The operator credential and session token stay in Connectome's native process, so
				the Database, Vectors, and Storage lenses run only in the desktop build.
			</Alert>
		);
	}

	return (
		<Paper
			p="lg"
			className={classes.session}
		>
			<Group
				justify="space-between"
				align="flex-start"
			>
				<Box>
					<Group gap="xs">
						<Text
							fz="lg"
							fw={650}
						>
							Authenticated session
						</Text>
						<Badge
							variant="dot"
							color={session ? "green" : "gray"}
						>
							{session ? "Open" : "Closed"}
						</Badge>
					</Group>
					{session ? (
						<Text
							fz="sm"
							mt={4}
						>
							{session.principal} · session {session.session.session_id} · idle expiry{" "}
							{formatTime(session.session.idle_expires_at_unix_ms)}
						</Text>
					) : (
						<Text
							fz="sm"
							mt={4}
						>
							The native process reads the credential file; neither the credential nor
							the session token reaches this interface.
						</Text>
					)}
				</Box>
				{session && (
					<Button
						variant="light"
						color="red"
						leftSection={<Icon path={iconPower} />}
						loading={disconnect.isPending}
						onClick={() => disconnect.mutate()}
					>
						Disconnect
					</Button>
				)}
			</Group>

			{!session && (
				<Group
					mt="md"
					align="flex-end"
				>
					<TextInput
						flex={1}
						label="Operator credential file"
						placeholder="<project>/.rrflow/credentials/local-operator.json"
						leftSection={<Icon path={iconKey} />}
						value={credentialPath}
						onChange={(event) =>
							updateConnection({
								id: connection.id,
								runtimeCredential: event.currentTarget.value || undefined,
							})
						}
					/>
					<Button
						variant="light"
						leftSection={<Icon path={iconOpenFolder} />}
						onClick={browse}
					>
						Browse
					</Button>
					<Button
						disabled={!handshake || !credentialPath}
						loading={connect.isPending}
						onClick={() => connect.mutate()}
					>
						Open session
					</Button>
				</Group>
			)}

			{!session && foreign && (
				<Text
					fz="sm"
					mt="sm"
					c="slate"
				>
					A session to {foreign.instance} at {foreign.endpoint} is open; opening this one
					closes it.
				</Text>
			)}

			{connect.isError && (
				<Alert
					mt="md"
					color="red"
					title="Session rejected"
					icon={<Icon path={iconErrorCircle} />}
				>
					{connect.error instanceof Error ? connect.error.message : "Unknown RRD error"}
				</Alert>
			)}
		</Paper>
	);
}
