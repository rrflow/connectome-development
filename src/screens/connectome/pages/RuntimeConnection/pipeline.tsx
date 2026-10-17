import { Badge, Box, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import { Icon, iconChevronRight } from "@surrealdb/ui";
import type { RrdMetricView, RrdPhysicalStorageView } from "~/rrflow/session";
import { formatCount } from "./format";
import { type GlossaryTerm, Term } from "./glossary";
import { fill, fillColor, formatMetric } from "./physical";
import classes from "./style.module.scss";

/*
 * rrflowKV's data path drawn as four stages, fed by the engine's storage
 * observation. Metrics are looked up by the ids `src-tauri/src/rrd/view.rs`
 * assigns; a missing metric renders as "not reported", never as zero.
 */

/** Two lines of purpose text, so every stage's reading starts at one height. */
const PURPOSE_HEIGHT = 44;

function metric(view: RrdPhysicalStorageView, group: string, id: string) {
	return view.groups
		.find((candidate) => candidate.id === group)
		?.metrics.find((candidate) => candidate.id === id);
}

function value(entry: RrdMetricView | undefined): string {
	return entry ? formatMetric(entry.unit, entry.value) : "not reported";
}

function limit(entry: RrdMetricView | undefined): string {
	return typeof entry?.limit === "number"
		? formatMetric(entry.unit, entry.limit)
		: "not reported";
}

interface StageProps {
	step: number;
	term: GlossaryTerm;
	title: string;
	purpose: string;
	reading: string;
	gauge?: RrdMetricView;
	details: string[];
}

function Stage({ step, term, title, purpose, reading, gauge, details }: StageProps) {
	const percent = gauge ? fill(gauge) : null;
	return (
		<Paper
			p="md"
			flex={1}
			miw={0}
			className={classes.stat}
		>
			<Stack
				gap={6}
				h="100%"
			>
				<Group
					gap={8}
					wrap="nowrap"
				>
					<Badge
						size="sm"
						circle
						variant="filled"
						color="violet"
					>
						{step}
					</Badge>
					<Text
						fw={700}
						c="bright"
						truncate
					>
						<Term id={term}>{title}</Term>
					</Text>
				</Group>
				<Text
					fz="sm"
					c="slate"
					mih={PURPOSE_HEIGHT}
				>
					{purpose}
				</Text>
				<Text
					fz="xl"
					fw={700}
					ff="monospace"
					c="bright"
				>
					{reading}
				</Text>
				{percent !== null && (
					<Progress
						value={percent}
						color={fillColor(percent)}
					/>
				)}
				{details.map((detail) => (
					<Text
						key={detail}
						fz="xs"
						c="slate"
					>
						{detail}
					</Text>
				))}
			</Stack>
		</Paper>
	);
}

function Arrow() {
	return (
		<Box
			c="slate"
			style={{ alignSelf: "center", flexShrink: 0 }}
		>
			<Icon path={iconChevronRight} />
		</Box>
	);
}

export function StoragePipeline({ view }: { view: RrdPhysicalStorageView }) {
	if (view.groups.length === 0) {
		return (
			<Text c="slate">
				The {view.profile} profile reports {view.evidence_level} evidence: it keeps no
				physical counters to show here.
			</Text>
		);
	}

	const wal = metric(view, "write_ahead_log", "payload");
	const versions = metric(view, "memtable", "versions");
	const keys = metric(view, "memtable", "keys");
	const memory = metric(view, "memtable", "approximate_bytes");
	const segments = metric(view, "segments", "segments");
	const segmentBytes = metric(view, "segments", "segment_bytes");
	const flushes = metric(view, "maintenance", "automatic_flushes");
	const compactions = metric(view, "maintenance", "automatic_compactions");
	const resident = metric(view, "page_cache", "resident");
	const hits = metric(view, "page_cache", "hits");
	const misses = metric(view, "page_cache", "misses");
	const lookups = (hits?.value ?? 0) + (misses?.value ?? 0);
	const hitRatio = view.headline.find((entry) => entry.id === "page_cache_hit_ratio");

	const onDisk = (segments?.value ?? 0) > 0;
	const summary = onDisk ? (
		<>
			{value(segments)} <Term id="segment">segments</Term> hold {value(segmentBytes)} on disk.
			The <Term id="pageCache">page cache</Term> holds {value(resident)} of {limit(resident)}
			{hitRatio
				? ` and answered ${formatMetric("ratio", hitRatio.value)} of ${formatCount(lookups)} lookups from memory.`
				: " and has not been asked for a page yet."}
		</>
	) : (
		<>
			Everything is still in memory: {value(versions)} <Term id="version">versions</Term> sit
			in the <Term id="memtable">memtable</Term>. rrflowKV writes its first{" "}
			<Term id="segment">segment</Term> to disk when the memtable reaches {limit(versions)}{" "}
			versions or the <Term id="wal">write-ahead log</Term> reaches {limit(wal)}. Until then
			there is nothing on disk to read, so the <Term id="pageCache">page cache</Term> stays
			empty.
		</>
	);

	return (
		<Stack gap="md">
			<Text>{summary}</Text>
			<Group
				gap="xs"
				align="stretch"
				wrap="nowrap"
			>
				<Stage
					step={1}
					term="wal"
					title="Write-ahead log"
					purpose="Every change is written here first, so it survives a crash."
					reading={value(wal)}
					gauge={wal}
					details={[`of ${limit(wal)} before a flush`]}
				/>
				<Arrow />
				<Stage
					step={2}
					term="memtable"
					title="Memtable"
					purpose="Recent changes kept in memory, sorted and ready to read."
					reading={`${value(versions)} versions`}
					gauge={versions}
					details={[
						`of ${limit(versions)} before a flush`,
						`${value(keys)} keys · about ${value(memory)}`,
					]}
				/>
				<Arrow />
				<Stage
					step={3}
					term="segment"
					title="Segments on disk"
					purpose="A flush writes the memtable to disk as a sorted, read-only file."
					reading={`${value(segments)} segments`}
					details={[
						`${value(segmentBytes)} on disk`,
						`${value(flushes)} flushes · ${value(compactions)} compactions since the engine opened`,
					]}
				/>
				<Arrow />
				<Stage
					step={4}
					term="pageCache"
					title="Page cache"
					purpose="Recently read pages of segments, kept in memory so repeat reads skip the disk."
					reading={value(resident)}
					gauge={resident}
					details={[
						`of ${limit(resident)} in use`,
						hitRatio
							? `${formatMetric("ratio", hitRatio.value)} of ${formatCount(lookups)} lookups served from memory`
							: "No segment reads yet",
					]}
				/>
			</Group>
			<Text
				fz="xs"
				c="slate"
			>
				Writes pass through steps 1 to 3. Reads look in the memtable first, then in segments
				through the page cache. Counters come from the engine's live storage observation and
				count from when the engine last opened its store.
			</Text>
		</Stack>
	);
}
