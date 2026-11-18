import { Alert, Badge, Group, Loader, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "~/components/Icon";
import { Section } from "~/features/runtime/components/Section";
import { describeRrdError } from "~/rrflow/runtime";
import { iconErrorCircle } from "~/shared/assets/icons";
import { busyRetry, databaseQuery } from "../api/queries";
import { useLiveChanges } from "../live/use-live-changes";
import type { RuntimeLensProps } from "../types";
import { formatTime } from "../utils/format";
import { CursorRail } from "./cursor-rail";
import {
	activity,
	agreement,
	axisHead,
	type EngineReading,
	positions,
	probeKind,
	probeQuery,
	type QueryProbe,
	readEngine,
} from "./model";
import { ColdCard, DatabaseCard, QueryCard, StorageCard } from "./parts";

/** Matches the Storage tab, which shares this read and its cache. */
const REFRESH_MS = 5_000;
const PULSE_MS = 1_200;

/**
 * rrflowDB, rrflowKV, rrflowQL and rrflowCLD as one engine: one storage
 * observation and one live rrflowQL answer, placed on their shared cursor.
 * Each committed change on the live stream triggers a fresh reading.
 */
export function EngineTab({ client, sessionKey }: RuntimeLensProps) {
	const queryClient = useQueryClient();
	const storageKey = ["rrd-storage", sessionKey] as const;
	const storage = useQuery({
		queryKey: storageKey,
		queryFn: () => client.storage(),
		refetchInterval: REFRESH_MS,
		...busyRetry,
	});
	const database = useQuery(databaseQuery(client, sessionKey));
	const live = useLiveChanges(client, sessionKey);
	const kind = probeKind(database.data?.graph.nodes);
	const probeKey = ["rrd-engine-probe", sessionKey, kind] as const;
	const probe = useQuery({
		queryKey: probeKey,
		enabled: kind !== null,
		refetchInterval: REFRESH_MS,
		retry: false,
		queryFn: async (): Promise<QueryProbe> => {
			if (kind === null) throw new Error("No record kind to read");
			const began = performance.now();
			const view = await client.query(probeQuery(kind, Date.now()));
			return { view, kind, roundTripMs: performance.now() - began, atMs: Date.now() };
		},
	});

	// A committed change is the moment all four parts should be read again.
	const latest = live.batches[0]?.throughCursor;
	useEffect(() => {
		if (latest === undefined) return;
		queryClient.invalidateQueries({ queryKey: ["rrd-storage", sessionKey] });
		queryClient.invalidateQueries({ queryKey: ["rrd-engine-probe", sessionKey] });
	}, [latest, sessionKey]);

	// Two distinct observations make one activity reading.
	const [history, setHistory] = useState<EngineReading[]>([]);
	useEffect(() => {
		if (!storage.data) return;
		const next = readEngine(storage.data);
		setHistory((previous) =>
			previous.at(-1)?.observedAtMs === next.observedAtMs
				? previous
				: [...previous.slice(-1), next],
		);
	}, [storage.data]);

	const reading = history.at(-1);
	const head = reading ? axisHead(reading, probe.data ?? null) : 0;
	const lastHead = useRef(head);
	const [advanced, setAdvanced] = useState(false);
	useEffect(() => {
		if (head <= lastHead.current) return;
		lastHead.current = head;
		setAdvanced(true);
		const timer = setTimeout(() => setAdvanced(false), PULSE_MS);
		return () => clearTimeout(timer);
	}, [head]);

	if (storage.isPending) {
		return (
			<Stack align="center">
				<Loader />
				<Text c="slate">Reading the engine</Text>
			</Stack>
		);
	}
	if (!storage.data || !reading) {
		return (
			<Alert
				color="red"
				title="The engine could not be read"
				icon={<Icon path={iconErrorCircle} />}
			>
				{storage.error ? describeRrdError(storage.error) : "Unknown RRD error"}
			</Alert>
		);
	}

	const probeError = probe.error ? describeRrdError(probe.error) : null;
	const parts = positions(reading, probe.data ?? null, probeError);
	const change = activity(history.at(-2), reading);
	const coldNotes =
		storage.data.physical.groups.find((group) => group.id === "rrflow_cld")?.notes ?? [];

	return (
		<Stack gap="xl">
			<Section
				title="One engine"
				description="rrflowDB commits each change, rrflowKV stores it, rrflowQL answers from it, and rrflowCLD copies it to the cold tier. They share one change number, the cursor. Each line shows where a part is on it now."
				rightSection={
					<Badge
						variant="dot"
						color={
							live.status.state === "live"
								? "teal"
								: live.status.state === "connecting"
									? "gray"
									: "red"
						}
					>
						{live.status.state === "live"
							? "Following live changes"
							: live.status.state === "connecting"
								? "Connecting to live changes"
								: `Live changes stopped: ${live.status.reason}`}
					</Badge>
				}
			>
				<Paper p="lg">
					<Stack gap="lg">
						<Text
							fw={600}
							c="bright"
							data-engine-agreement
						>
							{agreement(parts, head)}
						</Text>
						<CursorRail
							parts={parts}
							head={head}
							advanced={advanced}
						/>
						<Group justify="space-between">
							<Text
								fz="xs"
								c="slate"
							>
								Storage read {formatTime(reading.observedAtMs)}
								{probe.data
									? `; rrflowQL answered ${formatTime(probe.data.atMs)}`
									: ""}
								. Refreshes every {REFRESH_MS / 1000} s and after every committed
								change.
							</Text>
						</Group>
					</Stack>
				</Paper>
				<SimpleGrid
					cols={{ base: 1, md: 2, xl: 4 }}
					mt="lg"
				>
					<DatabaseCard
						position={parts.db}
						reading={reading}
						activity={change}
						graph={database.data?.graph}
						lastLiveAtMs={live.batches[0]?.atUnixMs ?? null}
					/>
					<StorageCard
						position={parts.kv}
						reading={reading}
						activity={change}
					/>
					<QueryCard
						position={parts.ql}
						probe={probe.data ?? null}
						error={probeError}
						queryIndexes={reading.queryIndexes}
					/>
					<ColdCard
						position={parts.cld}
						reading={reading}
						activity={change}
						notes={coldNotes}
					/>
				</SimpleGrid>
			</Section>
		</Stack>
	);
}
