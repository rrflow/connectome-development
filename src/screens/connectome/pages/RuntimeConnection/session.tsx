import { Alert, Badge, Button, Group, Paper, Text, TextInput } from "@mantine/core";
import { Icon, iconErrorCircle, iconKey, iconOpenFolder, iconPower } from "@rrflow/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef } from "react";
import type { RrdHandshake } from "~/rrflow/runtime";
import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";
import { useConfigStore } from "~/shell/stores/config";
import type { Connection } from "~/types";
import { formatTime } from "./format";
import classes from "./style.module.scss";

export const SESSION_QUERY_KEY = ["rrd-session"] as const;

/**
 * Connections whose session the operator closed in this app run. A saved
 * credential reopens a session automatically on arrival, but never after the
 * operator chose to disconnect.
 */
const closedByOperator = new Set<string>();

export interface SessionPanelProps {
	client: RrdSessionClient;
	connection: Connection;
	endpoint: string;
	handshake: RrdHandshake | undefined;
	/** The native session when it belongs to this endpoint and instance. */
	session: RrdConnectionView | null;
	/** A native session held for another endpoint or instance. */
	foreign: RrdConnectionView | null;
	/** Whether the native session state has been read, so `session` is known. */
	ready: boolean;
}

export function SessionPanel({
	client,
	connection,
	endpoint,
	handshake,
	session,
	foreign,
	ready,
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
		onMutate: () => closedByOperator.add(connection.id),
		onSettled: () => queryClient.setQueryData(SESSION_QUERY_KEY, null),
	});

	// Reopen the session from the saved credential once per visit, unless the
	// operator closed it or another instance's session is open.
	const attempted = useRef(false);
	const { mutate: openSession } = connect;
	const canAutoOpen =
		isTauri() &&
		ready &&
		!session &&
		!foreign &&
		Boolean(handshake) &&
		Boolean(credentialPath) &&
		!closedByOperator.has(connection.id);
	useEffect(() => {
		if (!canAutoOpen || attempted.current) return;
		attempted.current = true;
		openSession();
	}, [canAutoOpen, openSession]);

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
				title="Looking inside the estate needs the desktop app"
			>
				The operator credential and session token stay in Connectome's native process, so
				the records, vectors, and storage views run only in the desktop build.
			</Alert>
		);
	}

	if (session) {
		return (
			<Paper
				px="lg"
				py="sm"
				className={classes.session}
			>
				<Group justify="space-between">
					<Group gap="sm">
						<Badge
							variant="dot"
							color="green"
						>
							Session open
						</Badge>
						<Text fz="sm">
							Signed in as{" "}
							<Text
								span
								inherit
								fw={600}
							>
								{session.principal}
							</Text>{" "}
							· renews automatically · idle expiry{" "}
							{formatTime(session.session.idle_expires_at_unix_ms)}
						</Text>
					</Group>
					<Button
						variant="subtle"
						color="red"
						size="xs"
						leftSection={<Icon path={iconPower} />}
						loading={disconnect.isPending}
						onClick={() => disconnect.mutate()}
					>
						Disconnect
					</Button>
				</Group>
			</Paper>
		);
	}

	return (
		<Paper
			p="lg"
			className={classes.session}
		>
			<Group gap="xs">
				<Text
					fz="lg"
					fw={650}
				>
					Sign in to look inside this estate
				</Text>
				<Badge
					variant="dot"
					color={connect.isPending ? "yellow" : "gray"}
				>
					{connect.isPending ? "Opening" : "No session"}
				</Badge>
			</Group>
			<Text
				fz="sm"
				mt={4}
			>
				Choose the operator credential file RRFlow created when it installed this estate.
				Connectome's native process reads it; the credential and the session token never
				reach this window.
			</Text>
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
					onClick={() => {
						closedByOperator.delete(connection.id);
						connect.mutate();
					}}
				>
					Open session
				</Button>
			</Group>

			{foreign && (
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
