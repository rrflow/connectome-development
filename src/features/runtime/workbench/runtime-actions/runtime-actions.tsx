import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import type { RrdSessionClient } from "~/rrflow/session";
import { databaseQueryKey } from "../../types";

type Action = "schema" | "database" | "storage" | "flights" | "note";
type Result = { action: string; elapsedMs: number; message: string; error: boolean };

const groups: { title: string; actions: { id: Action; label: string }[] }[] = [
	{
		title: "Records and schema",
		actions: [
			{ id: "schema", label: "Read schema" },
			{ id: "database", label: "Read database" },
		],
	},
	{ title: "Storage", actions: [{ id: "storage", label: "Read storage" }] },
	{
		title: "Flights and diagnostics",
		actions: [
			{ id: "flights", label: "Read flights" },
			{ id: "note", label: "Capture diagnostic note" },
		],
	},
];

export function WorkbenchRuntimeActions({
	client,
	sessionKey,
	connected,
	canCapture,
	captureDiagnostics,
	onOpenRoute,
}: {
	client: RrdSessionClient;
	sessionKey: string;
	connected: boolean;
	canCapture: boolean;
	captureDiagnostics: () => Promise<void>;
	onOpenRoute: (route: string) => void;
}) {
	const alive = useRef(false);
	const queryClient = useQueryClient();
	const pending = useRef(false);
	const [running, setRunning] = useState<Action | null>(null);
	const [results, setResults] = useState<Result[]>([]);
	useLayoutEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const run = async (action: Action, label: string) => {
		if (!connected || pending.current) return;
		pending.current = true;
		setRunning(action);
		const started = performance.now();
		let message: string;
		let error = false;
		try {
			switch (action) {
				case "schema": {
					const data = await client.schema();
					if (alive.current) queryClient.setQueryData(["rrd-schema", sessionKey], data);
					message = `Schema ${data.schema_revision ?? "not installed"}; ${data.tables.length} tables returned${data.truncated ? " (truncated)" : ""}; cursor ${data.known_at_cursor}.`;
					break;
				}
				case "database": {
					const data = await client.database();
					if (alive.current) queryClient.setQueryData(databaseQueryKey(sessionKey), data);
					message = `Returned graph: ${data.graph.nodes.length} nodes, ${data.graph.edges.length} edges.`;
					break;
				}
				case "storage": {
					const data = await client.storage();
					if (alive.current) queryClient.setQueryData(["rrd-storage", sessionKey], data);
					message = `Storage profile ${data.physical.profile}; cursor ${data.runtime_cursor}.`;
					break;
				}
				case "flights": {
					const data = await client.workbenchSnapshot(0);
					if (alive.current)
						queryClient.setQueryData(["rrd-workbench-snapshot", sessionKey, 0], data);
					message = `${data.flights.length} flights returned${data.truncated ? " (truncated)" : ""} after cursor ${data.after_cursor}.`;
					break;
				}
				case "note":
					if (!canCapture) throw new Error("Select an available local workbench.");
					await captureDiagnostics();
					message = "Local diagnostic note saved; this is not an engine audit receipt.";
					break;
			}
		} catch (cause) {
			error = true;
			message = cause instanceof Error ? cause.message : String(cause);
		}
		if (!alive.current) return;
		setResults((current) =>
			[
				{ action: label, elapsedMs: performance.now() - started, message, error },
				...current,
			].slice(0, 20),
		);
		pending.current = false;
		setRunning(null);
	};

	const openRoute = (route: string) => onOpenRoute(route);

	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack>
				<Title order={4}>Runtime actions</Title>
				<Text size="sm">
					Explicit engine reads and local diagnostics. Elapsed time is measured in this
					UI; engine hops and tool counts are not inferred.
				</Text>
				{!connected && (
					<Alert title="Native session required">Connect to read the engine.</Alert>
				)}
				{groups.map((group) => (
					<Group key={group.title}>
						<Text fw={600}>{group.title}</Text>
						{group.actions.map((action) => (
							<Button
								key={action.id}
								variant="light"
								size="xs"
								disabled={
									!connected ||
									(action.id === "note" && !canCapture) ||
									running !== null
								}
								loading={running === action.id}
								onClick={() => void run(action.id, action.label)}
							>
								{action.label}
							</Button>
						))}
					</Group>
				))}
				<Group>
					<Button
						size="xs"
						variant="subtle"
						onClick={() => openRoute("knowledge/models")}
					>
						Open models
					</Button>
					<Button
						size="xs"
						variant="subtle"
						onClick={() => openRoute("knowledge/records")}
					>
						Open records
					</Button>
					<Button
						size="xs"
						variant="subtle"
						onClick={() => openRoute("system/storage")}
					>
						Open storage
					</Button>
					<Button
						size="xs"
						variant="subtle"
						onClick={() => openRoute("knowledge/vectors")}
					>
						Open vectors
					</Button>
				</Group>
				<Text size="sm">
					Launch an observe flight using the prompt control above. It is not proof of
					cold-storage execution.
				</Text>
				{results.map((result, index) => (
					<Paper
						key={`${result.action}-${index}`}
						withBorder
						p="xs"
					>
						<Group>
							<Text size="sm">{result.action}</Text>
							<Badge color={result.error ? "red" : "green"}>
								{result.error ? "failed" : "completed"}
							</Badge>
							<Text size="xs">UI elapsed {result.elapsedMs.toFixed(1)} ms</Text>
						</Group>
						<Text size="sm">{result.message}</Text>
					</Paper>
				))}
			</Stack>
		</Paper>
	);
}
