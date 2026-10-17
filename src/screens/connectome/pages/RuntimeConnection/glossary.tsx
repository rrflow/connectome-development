import { Box, Drawer, Stack, Text, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

/*
 * Plain-language meanings of the RRFlow terms the runtime lenses use. The
 * terms themselves stay canonical (RRFlow's component terminology); only the
 * explanations are written for someone meeting them for the first time.
 */

export type GlossaryTerm =
	| "rrd"
	| "estate"
	| "record"
	| "relation"
	| "kind"
	| "schema"
	| "cluster"
	| "cursor"
	| "query"
	| "vector"
	| "collection"
	| "point"
	| "embedding"
	| "similarity"
	| "exact"
	| "neighbours"
	| "rrflowKV"
	| "wal"
	| "memtable"
	| "version"
	| "flush"
	| "segment"
	| "pageCache"
	| "compaction";

interface GlossaryEntry {
	term: string;
	meaning: string;
}

export const GLOSSARY: Record<GlossaryTerm, GlossaryEntry> = {
	rrd: {
		term: "RRD",
		meaning:
			"The RRFlow daemon: the server process that hosts the estate and answers Connectome's requests.",
	},
	estate: {
		term: "Estate (rrflowDB)",
		meaning:
			"One project's database in RRFlow. Its records, relations, vectors, and evidence live together and change together in one transaction.",
	},
	record: {
		term: "Record",
		meaning:
			"One stored item, such as a document. It has a kind, an identity, named fields, and the time from which it is valid.",
	},
	relation: {
		term: "Relation",
		meaning: "A typed, one-way link from one record to another, such as links_to.",
	},
	kind: {
		term: "Kind",
		meaning:
			"The type of a record or relation. The schema registry lists every kind and its rules.",
	},
	schema: {
		term: "Schema registry",
		meaning:
			"The estate's list of record, relation, and vector kinds, and whether each one is strict or schemaless.",
	},
	cluster: {
		term: "Cluster",
		meaning:
			"A group of records that link to each other more than to the rest. Connectome works clusters out from the relations to color the graph; the estate does not store them.",
	},
	cursor: {
		term: "Cursor",
		meaning:
			"A position in the estate's history. Every committed change moves it forward, and every read reports the cursor it saw.",
	},
	query: {
		term: "RRFlowQL",
		meaning: "RRFlow's query language for reading records, relations, and graph traversals.",
	},
	vector: {
		term: "Vector",
		meaning:
			"A list of numbers an embedding model computes from a record's content. Similar content gives vectors that point in similar directions.",
	},
	collection: {
		term: "Collection",
		meaning:
			"A named set of vectors that share a length, a similarity measure, and an embedding model.",
	},
	point: {
		term: "Point",
		meaning: "One stored vector in a collection, tied to the record it describes.",
	},
	embedding: {
		term: "Embedding model",
		meaning:
			"The model that turns content into vectors. The collection records which model produced its vectors.",
	},
	similarity: {
		term: "Similarity score",
		meaning:
			"How close two vectors are under the collection's metric. With cosine, 1 means the same direction and 0 means unrelated.",
	},
	exact: {
		term: "Exact search",
		meaning:
			"The engine compares the query with every stored vector, so the result is the true closest match rather than an estimate.",
	},
	neighbours: {
		term: "Nearest neighbours",
		meaning:
			"The stored vectors most similar to a given one, as the engine's search returns them.",
	},
	rrflowKV: {
		term: "rrflowKV",
		meaning:
			"RRFlow's storage engine. It logs every change, keeps recent changes in memory, and stores sorted files on disk.",
	},
	wal: {
		term: "Write-ahead log",
		meaning:
			"An append-only file on disk. Each change is written here before it is applied, so the engine can recover recent changes after a crash.",
	},
	memtable: {
		term: "Memtable",
		meaning: "Recent changes kept in memory, sorted by key, so they can be read straight away.",
	},
	version: {
		term: "Version",
		meaning:
			"Each change to a key adds a new version instead of overwriting the old one, so a read at an earlier cursor still sees the earlier value.",
	},
	flush: {
		term: "Flush",
		meaning:
			"Writing the memtable to disk as a new segment. rrflowKV flushes when the memtable or the write-ahead log reaches its limit.",
	},
	segment: {
		term: "Segment",
		meaning: "A sorted, read-only file on disk, created by a flush or a compaction.",
	},
	pageCache: {
		term: "Page cache (KV cache)",
		meaning:
			"Recently read pages of segment files kept in memory, so repeat reads skip the disk. It stays empty until a flush has written segments.",
	},
	compaction: {
		term: "Compaction",
		meaning:
			"Merging segments in the background to keep reads fast and reclaim the space of replaced versions.",
	},
};

const SECTIONS: { title: string; terms: GlossaryTerm[] }[] = [
	{
		title: "The estate",
		terms: [
			"rrd",
			"estate",
			"record",
			"relation",
			"kind",
			"schema",
			"cluster",
			"cursor",
			"query",
		],
	},
	{
		title: "Vectors",
		terms: ["vector", "collection", "point", "embedding", "similarity", "exact", "neighbours"],
	},
	{
		title: "Storage engine",
		terms: [
			"rrflowKV",
			"wal",
			"memtable",
			"version",
			"flush",
			"segment",
			"pageCache",
			"compaction",
		],
	},
];

export interface TermProps {
	id: GlossaryTerm;
	/** Text to show instead of the term's own name. */
	children?: ReactNode;
}

/** A term with its plain-language meaning one hover away. */
export function Term({ id, children }: TermProps) {
	const entry = GLOSSARY[id];
	return (
		<Tooltip
			label={entry.meaning}
			multiline
			w={300}
			withArrow
			openDelay={150}
		>
			<Text
				span
				inherit
				style={{
					textDecoration: "underline dotted",
					textUnderlineOffset: 3,
					cursor: "help",
				}}
			>
				{children ?? entry.term}
			</Text>
		</Tooltip>
	);
}

export interface GlossaryDrawerProps {
	opened: boolean;
	onClose: () => void;
}

export function GlossaryDrawer({ opened, onClose }: GlossaryDrawerProps) {
	return (
		<Drawer
			opened={opened}
			onClose={onClose}
			position="right"
			size="md"
			title="What these words mean"
		>
			<Stack gap="xl">
				{SECTIONS.map((section) => (
					<Box key={section.title}>
						<Text
							fw={700}
							c="bright"
							mb="sm"
						>
							{section.title}
						</Text>
						<Stack gap="md">
							{section.terms.map((id) => (
								<Box key={id}>
									<Text
										fw={600}
										fz="sm"
									>
										{GLOSSARY[id].term}
									</Text>
									<Text
										fz="sm"
										c="slate"
									>
										{GLOSSARY[id].meaning}
									</Text>
								</Box>
							))}
						</Stack>
					</Box>
				))}
			</Stack>
		</Drawer>
	);
}
