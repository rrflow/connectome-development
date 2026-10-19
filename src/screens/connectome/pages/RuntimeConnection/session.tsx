import { Alert, Badge, Button, Group, Paper, Text, TextInput } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { RrdHandshake } from "~/rrflow/runtime";
import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";
import { useConfigStore } from "~/shell/stores/config";
import type { Connection } from "~/types";
import {
	Icon,
	iconErrorCircle,
	iconKey,
	iconOpenFolder,
	iconPower,
} from "../../../../rrflow/ui/index";
import { formatMoment, formatSpan } from "./format";
import { Hint } from "./glossary";
import classes from "./style.module.scss";

export const SESSION_QUERY_KEY = ["rrd-session"] as const;

/** A saved credential may reopen on arrival, but never after an operator sign-out. */
const closedByOperator = new Set<string>();

/** Explicit Reconnect permits the saved credential to reopen this session. */
export function allowSessionReconnect(connectionId: string) {
	closedByOperator.delete(connectionId);
}

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

interface OpenSessionAttempt {
	connectionId: string;
	request: Parameters<RrdSessionClient["connect"]>[0];
	foreign: RrdConnectionView | null;
}

interface CloseSessionAttempt {
	connectionId: string;
	target: Pick<RrdConnectionView, "endpoint" | "instance">;
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
	const profileKey = JSON.stringify([
		connection.id,
		endpoint,
		connection.runtimeInstance,
		credentialPath,
	]);
	const [credentialInput, setCredentialInput] = useState({
		profileKey,
		value: credentialPath,
	});
	const credentialDraft =
		credentialInput.profileKey === profileKey ? credentialInput.value : credentialPath;
	const setCredentialDraft = (value: string) => setCredentialInput({ profileKey, value });
	const [browsing, setBrowsing] = useState(false);
	const [browseError, setBrowseError] = useState<Error | null>(null);
	const pendingAction = useRef<"connect" | "disconnect" | "browse" | null>(null);
	const currentProfile = useRef(profileKey);
	currentProfile.current = profileKey;

	useEffect(() => {
		setCredentialInput({
			profileKey,
			value: credentialPath,
		});
		setBrowseError(null);
	}, [profileKey, credentialPath]);

	const connect = useMutation({
		mutationFn: async (attempt: OpenSessionAttempt) => {
			// Close only the exact foreign session observed for this attempt.
			if (attempt.foreign) await client.disconnect(attempt.foreign);
			return client.connect(attempt.request);
		},
		onSuccess: (view) => queryClient.setQueryData(SESSION_QUERY_KEY, view),
		onSettled: () => {
			pendingAction.current = null;
			return queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
		},
	});

	const disconnect = useMutation({
		mutationFn: (attempt: CloseSessionAttempt) => client.disconnect(attempt.target),
		onSettled: () => {
			pendingAction.current = null;
			return queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
		},
	});
	const busy = connect.isPending || disconnect.isPending || browsing;

	// Only the saved path opens automatically. Editing the local draft cannot
	// submit partial paths or schedule another native attempt behind this one.
	const attempted = useRef<string | null>(null);
	const attemptKey = `${connection.id}:${endpoint}:${handshake?.service.instance.id ?? ""}:${handshake?.connected_at_unix_ms ?? ""}:${credentialPath}`;
	const { mutate: openSession } = connect;
	const canAutoOpen =
		isTauri() &&
		ready &&
		!session &&
		!foreign &&
		!busy &&
		Boolean(handshake) &&
		Boolean(credentialPath) &&
		!closedByOperator.has(connection.id);
	useEffect(() => {
		if (
			!canAutoOpen ||
			!handshake ||
			attempted.current === attemptKey ||
			pendingAction.current
		) {
			return;
		}
		attempted.current = attemptKey;
		pendingAction.current = "connect";
		openSession({
			connectionId: connection.id,
			request: {
				endpoint,
				instance: handshake.service.instance.id,
				credential_path: credentialPath,
			},
			foreign: null,
		});
	}, [canAutoOpen, openSession, attemptKey, connection.id, endpoint, handshake, credentialPath]);

	const signIn = () => {
		if (!handshake || !credentialDraft || pendingAction.current) return;
		closedByOperator.delete(connection.id);
		attempted.current = `${connection.id}:${endpoint}:${handshake.service.instance.id}:${handshake.connected_at_unix_ms}:${credentialDraft}`;
		pendingAction.current = "connect";
		setBrowseError(null);
		updateConnection({ id: connection.id, runtimeCredential: credentialDraft });
		connect.mutate({
			connectionId: connection.id,
			request: {
				endpoint,
				instance: handshake.service.instance.id,
				credential_path: credentialDraft,
			},
			foreign,
		});
	};

	const signOut = (attempt: CloseSessionAttempt) => {
		if (pendingAction.current) return;
		pendingAction.current = "disconnect";
		closedByOperator.add(attempt.connectionId);
		disconnect.mutate(attempt);
	};

	const browse = async () => {
		if (pendingAction.current) return;
		pendingAction.current = "browse";
		setBrowsing(true);
		setBrowseError(null);
		const selectedProfile = profileKey;
		try {
			const selected = await open({
				title: "Choose the RRFlow sign-in file",
				multiple: false,
				directory: false,
				filters: [{ name: "RRFlow credential", extensions: ["json"] }],
			});
			if (currentProfile.current === selectedProfile && typeof selected === "string") {
				setCredentialDraft(selected);
				connect.reset();
			}
		} catch (error) {
			if (currentProfile.current === selectedProfile) {
				setBrowseError(error instanceof Error ? error : new Error(String(error)));
			}
		} finally {
			pendingAction.current = null;
			setBrowsing(false);
		}
	};

	const failedClose =
		disconnect.isError &&
		disconnect.variables.connectionId === connection.id &&
		disconnect.variables.target.endpoint === endpoint
			? disconnect.variables
			: null;
	const disconnectNotice = failedClose && (
		<Alert
			mt="sm"
			color="red"
			title="Could not sign out"
			icon={<Icon path={iconErrorCircle} />}
		>
			<Text
				fz="sm"
				style={{ overflowWrap: "anywhere" }}
			>
				{disconnect.error instanceof Error
					? disconnect.error.message
					: String(disconnect.error)}
			</Text>
			<Button
				mt="xs"
				size="xs"
				variant="light"
				disabled={busy}
				onClick={() => signOut(failedClose)}
			>
				Try again
			</Button>
		</Alert>
	);

	if (!isTauri()) {
		return (
			<Alert
				color="blue"
				title="Sign in through the desktop app"
			>
				The desktop app keeps your credential and session token in its native process. Use
				it to open the records, vectors, and storage views.
			</Alert>
		);
	}

	if (session) {
		return (
			<Paper
				px="md"
				py="sm"
				className={classes.session}
				miw={0}
			>
				<Group
					justify="space-between"
					gap="xs"
				>
					<Group
						gap="xs"
						style={{ flex: "1 1 16rem", minWidth: 0 }}
						wrap="nowrap"
					>
						<Badge
							variant="dot"
							color="green"
							style={{ flexShrink: 0 }}
						>
							Signed in
						</Badge>
						<Text
							fz="sm"
							truncate
							miw={0}
							title={session.principal}
						>
							<Hint
								label={`Signed in as ${session.principal} since ${formatMoment(session.connected_at_unix_ms)}. Connectome renews the session automatically. The engine's idle limit is ${formatSpan(session.session.idle_timeout_ms)} and its absolute limit is ${formatSpan(session.session.absolute_timeout_ms)}.`}
							>
								{session.principal}
							</Hint>
						</Text>
					</Group>
					<Button
						variant="subtle"
						color="red"
						size="xs"
						leftSection={<Icon path={iconPower} />}
						loading={disconnect.isPending}
						disabled={busy}
						onClick={() => signOut({ connectionId: connection.id, target: session })}
					>
						Sign out
					</Button>
				</Group>
				{disconnectNotice}
			</Paper>
		);
	}

	return (
		<Paper
			p="md"
			className={classes.session}
			miw={0}
		>
			<Group gap="xs">
				<Text
					fz="md"
					fw={650}
				>
					Sign in to explore this estate
				</Text>
				<Badge
					variant="dot"
					color={connect.isPending ? "yellow" : "gray"}
				>
					{connect.isPending ? "Signing in" : "Signed out"}
				</Badge>
			</Group>
			<Text
				fz="sm"
				mt={4}
			>
				Choose the credential file RRFlow created for this estate. Its contents stay in
				Connectome's native process.
			</Text>
			<Group
				mt="sm"
				align="flex-end"
			>
				<TextInput
					style={{ flex: "1 1 20rem", minWidth: 0 }}
					label="Credential file"
					placeholder="<project>/.rrflow/credentials/local-operator.json"
					leftSection={<Icon path={iconKey} />}
					value={credentialDraft}
					disabled={busy}
					onChange={(event) => {
						setCredentialDraft(event.currentTarget.value);
						setBrowseError(null);
						connect.reset();
					}}
				/>
				<Button
					variant="light"
					leftSection={<Icon path={iconOpenFolder} />}
					disabled={busy}
					loading={browsing}
					onClick={browse}
				>
					Browse
				</Button>
				<Button
					disabled={!handshake || !credentialDraft || disconnect.isPending || browsing}
					loading={connect.isPending}
					onClick={signIn}
				>
					Sign in
				</Button>
			</Group>

			{foreign && (
				<Text
					fz="sm"
					mt="sm"
					c="slate"
					style={{ overflowWrap: "anywhere" }}
				>
					Signing in here closes the session to {foreign.instance} at {foreign.endpoint}.
				</Text>
			)}
			{connect.isError &&
				connect.variables.connectionId === connection.id &&
				connect.variables.request.endpoint === endpoint &&
				connect.variables.request.credential_path === credentialPath && (
					<Alert
						mt="sm"
						color="red"
						title="Could not sign in"
						icon={<Icon path={iconErrorCircle} />}
					>
						<Text
							fz="sm"
							style={{ overflowWrap: "anywhere" }}
						>
							{connect.error instanceof Error
								? connect.error.message
								: String(connect.error)}
						</Text>
						<Button
							mt="xs"
							size="xs"
							variant="light"
							disabled={busy || !handshake || !credentialDraft}
							onClick={signIn}
						>
							Try again
						</Button>
					</Alert>
				)}
			{browseError && (
				<Alert
					mt="sm"
					color="red"
					title="Could not choose a credential file"
					icon={<Icon path={iconErrorCircle} />}
				>
					<Text
						fz="sm"
						style={{ overflowWrap: "anywhere" }}
					>
						{browseError.message}
					</Text>
				</Alert>
			)}
			{disconnectNotice}
		</Paper>
	);
}
