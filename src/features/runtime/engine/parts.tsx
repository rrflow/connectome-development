import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { RrdGraphView } from "~/rrflow/session";
import { Term } from "../components/glossary";
import { formatCount, formatSize, formatTime } from "../utils/format";
import { PARTS } from "./cursor-rail";
import classes from "./engine.module.scss";
import {
	type Activity,
	type EngineReading,
	type PartId,
	type PartPosition,
	type QueryProbe,
	unsyncedWrites,
} from "./model";

function plural(count: number, one: string, many = `${one}s`): string {
	return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

function since(activity: Activity | null): string {
	return activity ? ` in the last ${Math.round(activity.seconds)} s` : "";
}

interface PartCardProps {
	id: PartId;
	position: PartPosition;
	headline: string;
	children: ReactNode;
}

function PartCard({ id, position, headline, children }: PartCardProps) {
	const part = PARTS.find((entry) => entry.id === id);
	if (!part) return null;
	return (
		<Paper
			p="md"
			className={classes.part}
			data-state={position.kind}
			data-part-card={id}
		>
			<Stack gap={6}>
				<Group
					justify="space-between"
					wrap="nowrap"
				>
					<Text
						fw={700}
						c="bright"
					>
						<Term id={part.term}>{part.name}</Term>
					</Text>
					<Badge
						size="sm"
						variant="light"
						color={
							position.kind === "at"
								? "teal"
								: position.kind === "behind"
									? "rrflow"
									: "slate"
						}
					>
						{position.kind === "at"
							? "at the head"
							: position.kind === "behind"
								? `${position.by.toLocaleString()} behind`
								: position.kind === "off"
									? "off"
									: "not reported"}
					</Badge>
				</Group>
				<Text
					fz="xl"
					fw={700}
					ff="monospace"
					c="bright"
				>
					{headline}
				</Text>
				{children}
			</Stack>
		</Paper>
	);
}

function Line({ children }: { children: ReactNode }) {
	return (
		<Text
			fz="sm"
			c="slate"
		>
			{children}
		</Text>
	);
}

export function DatabaseCard({
	position,
	reading,
	activity,
	graph,
	lastLiveAtMs,
}: {
	position: PartPosition;
	reading: EngineReading;
	activity: Activity | null;
	graph: RrdGraphView | undefined;
	lastLiveAtMs: number | null;
}) {
	const cursor = position.kind === "at" ? position.cursor : reading.head;
	return (
		<PartCard
			id="db"
			position={position}
			headline={`change ${cursor.toLocaleString()}`}
		>
			<Line>
				{graph?.records_total !== undefined
					? `Holds ${plural(graph.records_total, "record")} and ${plural(graph.relations_total ?? 0, "relation")}.`
					: "The record count was not reported."}
			</Line>
			<Line>
				{activity
					? activity.commits > 0
						? `Committed ${plural(activity.commits, "change")}${since(activity)}.`
						: `No new changes${since(activity)}.`
					: "Measuring: the next reading shows what changed."}
			</Line>
			<Line>
				{lastLiveAtMs
					? `Last change seen live at ${formatTime(lastLiveAtMs)}.`
					: "No change has arrived on the live stream since this view opened."}
			</Line>
		</PartCard>
	);
}

export function StorageCard({
	position,
	reading,
	activity,
}: {
	position: PartPosition;
	reading: EngineReading;
	activity: Activity | null;
}) {
	const kv = reading.kv;
	const unsynced = unsyncedWrites(kv);
	return (
		<PartCard
			id="kv"
			position={position}
			headline={
				kv.durableSequence === null
					? "not reported"
					: `sequence ${kv.durableSequence.toLocaleString()}`
			}
		>
			<Line>
				{unsynced === null
					? "Whether every write is on disk was not reported."
					: unsynced === 0
						? "Every write it has applied is on disk."
						: `${plural(unsynced, "write")} applied and waiting to reach disk.`}
			</Line>
			<Line>
				<Term id="memtable">Memtable</Term>: {formatCount(kv.memtableKeys)} keys,{" "}
				{formatSize(kv.memtableBytes)}. <Term id="segment">Segments</Term>:{" "}
				{formatCount(kv.segments)}, {formatSize(kv.segmentBytes)}.{" "}
				<Term id="wal">Write-ahead log</Term>: {formatSize(kv.walBytes)}.
			</Line>
			<Line>
				{activity && activity.kvWrites !== null
					? `${plural(activity.kvWrites, "write")}, ${plural(activity.flushes ?? 0, "flush", "flushes")} and ${plural(activity.compactions ?? 0, "compaction")}${since(activity)}.`
					: "Measuring: the next reading shows what changed."}
			</Line>
		</PartCard>
	);
}

export function QueryCard({
	position,
	probe,
	error,
	queryIndexes,
}: {
	position: PartPosition;
	probe: QueryProbe | null;
	error: string | null;
	queryIndexes: number;
}) {
	if (!probe) {
		return (
			<PartCard
				id="ql"
				position={position}
				headline="no answer yet"
			>
				<Line>{error ?? "rrflowQL is asked once the engram holds a record to read."}</Line>
			</PartCard>
		);
	}
	const { view } = probe;
	const { analysis, read_evidence: read } = view.execution;
	const chosen = view.plan.candidates.find((candidate) => candidate.selected);
	const engineTime = analysis
		? ` The engine's own timing was ${(analysis.elapsed_micros / 1000).toFixed(1)} ms.`
		: "";
	return (
		<PartCard
			id="ql"
			position={position}
			headline={`answered at ${view.known_at_cursor.toLocaleString()}`}
		>
			<Line>
				Read {plural(view.returned_rows, "record")} of kind <code>{probe.kind}</code> in{" "}
				{probe.roundTripMs.toFixed(1)} ms, as Connectome timed the round trip.{engineTime}
			</Line>
			<Line>
				It read rrflowKV with {plural(read.range_scans, "range scan")} and{" "}
				{plural(read.point_reads, "point read")}: {plural(read.keys_examined, "key")}{" "}
				examined, {plural(read.values_decoded, "value")} decoded (
				{formatSize(read.decoded_bytes)}).
			</Line>
			<Line>
				{chosen
					? `Plan: ${chosen.name}${chosen.reason ? `, because ${chosen.reason}` : ""}.`
					: view.plan.exact
						? "The plan is exact; the engine named no access path."
						: "The plan is approximate; the engine named no access path."}{" "}
				{plural(queryIndexes, "query index", "query indexes")} defined.
			</Line>
		</PartCard>
	);
}

export function ColdCard({
	position,
	reading,
	activity,
	notes,
}: {
	position: PartPosition;
	reading: EngineReading;
	activity: Activity | null;
	notes: string[];
}) {
	const cld = reading.cld;
	return (
		<PartCard
			id="cld"
			position={position}
			headline={cld ? `through ${cld.through_cursor.toLocaleString()}` : "not reported"}
		>
			{cld ? (
				<>
					<Line>
						{!cld.enabled
							? "Off for this installation: nothing is copied to the cold tier."
							: cld.stopped
								? `Stopped at change ${cld.through_cursor.toLocaleString()}: ${cld.stopped}.`
								: cld.pending
									? "A prepared file is waiting to be published."
									: `${plural(cld.files, "published file")}.`}
					</Line>
					<Line>
						{activity && activity.cldCopied !== null
							? activity.cldCopied > 0
								? `Copied ${plural(activity.cldCopied, "change")}${since(activity)}.`
								: `Copied nothing new${since(activity)}.`
							: "Measuring: the next reading shows what changed."}
					</Line>
				</>
			) : (
				<Line>The engine did not report the cold tier.</Line>
			)}
			{notes.map((note) => (
				<Text
					key={note}
					fz="xs"
					c="slate"
					ff="monospace"
					style={{ overflowWrap: "anywhere" }}
				>
					{note}
				</Text>
			))}
		</PartCard>
	);
}
