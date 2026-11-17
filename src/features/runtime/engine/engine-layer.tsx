import { Alert, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { iconErrorCircle } from "~/shared/assets/icons";
import { busyRetry } from "../api/queries";
import { ReadNotice } from "../components/notice";
import { useProject } from "../project/context";
import { ColdTier, PhysicalStorage } from "../storage/physical";
import { formatTime } from "../utils/format";

/** The engine layer follows the live engine while its view is open. */
const REFRESH_MS = 5_000;

export type EngineLayerId = "lsm" | "kv" | "cld";

/** Each layer names the counter groups the engine reports for it. */
const LAYERS: Record<EngineLayerId, { title: string; purpose: string; groups: readonly string[] }> =
	{
		lsm: {
			title: "rrflowLSM",
			purpose:
				"The hot tier: new writes land in memory, are flushed to sorted files, and are merged in the background. These are its counters, read from the running engine.",
			groups: ["memtable", "segments", "maintenance"],
		},
		kv: {
			title: "rrflowKV",
			purpose:
				"The durable store under every record, relation and document: the write-ahead log, commit sequences, page cache, file reads and write admission. Read from the running engine.",
			groups: ["write_ahead_log", "sequences", "page_cache", "segment_io", "admission"],
		},
		cld: {
			title: "rrflowCLD",
			purpose:
				"The columnar copy of settled history. This shows what the engine has published to it and how far it has caught up.",
			groups: [],
		},
	};

/** One storage layer of this project's engine, with nothing shown that the engine did not report. */
export function EngineLayer({ layer }: { layer: EngineLayerId }) {
	const { session, client, sessionKey } = useProject();
	const storage = useQuery({
		queryKey: ["rrd-storage", sessionKey],
		queryFn: () => client.storage(),
		enabled: Boolean(session),
		refetchInterval: REFRESH_MS,
		...busyRetry,
	});
	const { title, purpose, groups } = LAYERS[layer];

	if (!session) return null;

	return (
		<Stack gap="md">
			<PrimaryTitle fz={26}>{title}</PrimaryTitle>
			<Text>{purpose}</Text>
			{storage.isPending && (
				<Stack align="center">
					<Loader />
					<ReadNotice query={storage} />
				</Stack>
			)}
			{storage.isError && !storage.data && (
				<Alert
					color="red"
					title="The storage engine could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(storage.error)}
				</Alert>
			)}
			{storage.data && (
				<>
					{layer === "cld" ? (
						<ColdTier view={storage.data.physical} />
					) : (
						<PhysicalStorage
							view={storage.data.physical}
							only={groups}
						/>
					)}
					<Text
						fz="xs"
						c="slate"
					>
						Read from the engine at {formatTime(storage.data.observed_at_unix_ms)} and
						refreshed every {REFRESH_MS / 1000} seconds.
					</Text>
				</>
			)}
		</Stack>
	);
}
