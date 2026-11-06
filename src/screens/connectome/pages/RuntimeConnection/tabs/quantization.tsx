import {
	Alert,
	Badge,
	Box,
	Button,
	Divider,
	Group,
	Loader,
	Modal,
	NumberInput,
	Paper,
	Progress,
	ScrollArea,
	SegmentedControl,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { CodeBlock } from "~/components/CodeBlock";
import { Icon } from "~/components/Icon";
import { Label } from "~/components/Label";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { Section } from "~/components/Section";
import {
	iconCheck,
	iconChevronDown,
	iconChevronUp,
	iconErrorCircle,
	iconPlus,
	iconRefresh,
} from "~/icons";
import type { TurboQuantBits, VectorQuantizationMethod } from "~/rrflow/model";
import {
	isRetryable,
	type RrdCollectionView,
	type RrdComparedSearchView,
	type RrdGenerationView,
	type RrdHitView,
	type RrdMapPointView,
	type RrdNamedVectorView,
	type RrdQuantizationAppliedView,
	type RrdQuantizationProposalView,
	type RrdQuantizationStep,
	type RrdReference,
	type RrdSessionClient,
} from "~/rrflow/session";
import { formatCount, formatSize, formatTime, shortDigest } from "../format";
import { Term } from "../glossary";
import { quantizationsQuery } from "../queries";
import { Stat } from "../stat";
import classes from "../style.module.scss";

/** The bit widths TurboQuant offers, with the packed-vector ratio each gives. */
const TURBOQUANT_BITS: { value: TurboQuantBits; label: string; ratio: number }[] = [
	{ value: "bits4", label: "4 bits", ratio: 8 },
	{ value: "bits2", label: "2 bits", ratio: 16 },
	{ value: "bits1_5", label: "1.5 bits", ratio: 21 },
	{ value: "bits1", label: "1 bit", ratio: 32 },
];
type ProductCompression = Extract<VectorQuantizationMethod, { method: "product" }>["compression"];
const PRODUCT_COMPRESSIONS: ProductCompression[] = ["x4", "x8", "x16", "x32", "x64"];
type MethodName = VectorQuantizationMethod["method"];
const METHODS: { value: MethodName; label: string }[] = [
	{ value: "turbo_quant", label: "TurboQuant" },
	{ value: "scalar", label: "Scalar" },
	{ value: "product", label: "Product" },
	{ value: "binary", label: "Binary" },
];
/** A seed is any 64-bit integer; the form offers the range a number input holds exactly. */
const DEFAULT_SEED = 7;
const STATE_COLOR: Record<RrdGenerationView["state"], string> = {
	ready: "blue",
	active: "green",
	retired: "gray",
};
const COMPARE_COUNTS = ["5", "10", "20"];
/** Exact-rerank widths offered, as multiples of the hits a comparison reads. */
const RERANK_FACTORS = [1, 2, 4];
/** How far apart two exact scores may be and still tie; the native recall uses the same. */
const SCORE_TIE = 1e-6;

export function methodLabel(method: VectorQuantizationMethod) {
	switch (method.method) {
		case "turbo_quant":
			return `TurboQuant ${TURBOQUANT_BITS.find((bits) => bits.value === method.bits)?.label ?? method.bits}`;
		case "scalar":
			return "Scalar 8-bit";
		case "product":
			return `Product ${method.compression.replace("x", "×")}`;
		case "binary":
			return "Binary 1-bit";
	}
}

/** The active generations, newest first: the ones approximate search may read. */
export function activeGenerations(generations: RrdGenerationView[] | undefined) {
	return (generations ?? [])
		.filter((generation) => generation.state === "active")
		.sort((a, b) => b.generation - a.generation);
}

function referenceText(reference: RrdReference) {
	return `${reference.kind}:${reference.id}`;
}

function formatMs(ms: number) {
	return ms < 10 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`;
}

function formatScore(score: number) {
	return score.toFixed(3);
}

/** The packed vectors' size as a fraction of the full-precision vectors'. */
function packedRatio(generation: RrdGenerationView) {
	return generation.packed_vector_bytes > 0
		? generation.full_precision_vector_bytes / generation.packed_vector_bytes
		: null;
}

function buildMethod(
	name: MethodName,
	bits: TurboQuantBits,
	seed: number,
	compression: ProductCompression,
): VectorQuantizationMethod {
	switch (name) {
		case "turbo_quant":
			return { method: "turbo_quant", bits, seed };
		case "product":
			return { method: "product", compression };
		case "scalar":
			return { method: "scalar" };
		case "binary":
			return { method: "binary" };
	}
}

export interface SearchGenerationsProps {
	client: RrdSessionClient;
	sessionKey: string;
	collection: RrdCollectionView;
	vector: RrdNamedVectorView;
	/** The map's point for the selected record, once the map knows it. */
	selectedPoint: RrdMapPointView | undefined;
	/** A record's label by its `kind:id`. */
	labelOf: (subject: string) => string;
	/** A point's map colour by its `kind:id`. */
	colorOf: (point: string) => string;
	onSelect: (subject: string | null) => void;
}

/**
 * The quantized search generations of one named vector: their lifecycle, and
 * exact and approximate search side by side for the selected record.
 */
export function SearchGenerations({
	client,
	sessionKey,
	collection,
	vector,
	selectedPoint,
	labelOf,
	colorOf,
	onSelect,
}: SearchGenerationsProps) {
	const generations = useQuery(
		quantizationsQuery(client, sessionKey, collection.collection_id, vector.name),
	);
	const [step, setStep] = useState<RrdQuantizationStep | "build" | null>(null);
	const listed = generations.data?.generations ?? [];
	const active = activeGenerations(listed);
	const dense = vector.kind === "dense";

	return (
		<Section
			title={
				<>
					Search <Term id="generation">generations</Term>
				</>
			}
			description={
				<>
					Compressed copies of {vector.name} that the engine searches first, then checks
					the best candidates against the full vectors (
					<Term id="rerank">exact rerank</Term>). Building, activating or retiring one
					never changes a stored vector, and exact search stays available.
				</>
			}
			rightSection={
				<Group gap="xs">
					<Button
						variant="light"
						size="xs"
						leftSection={<Icon path={iconRefresh} />}
						loading={generations.isFetching}
						onClick={() => generations.refetch()}
					>
						Refresh
					</Button>
					<Button
						size="xs"
						leftSection={<Icon path={iconPlus} />}
						disabled={!dense}
						title={dense ? undefined : "Only dense vectors can be quantized"}
						onClick={() => setStep("build")}
					>
						Build a generation
					</Button>
				</Group>
			}
		>
			<Paper p="md">
				{generations.isPending ? (
					<Group justify="center">
						<Loader size="sm" />
					</Group>
				) : generations.isError ? (
					<Alert
						color="red"
						title="The generations could not be read"
						icon={<Icon path={iconErrorCircle} />}
					>
						{generations.error instanceof Error
							? generations.error.message
							: "Unknown RRD error"}
					</Alert>
				) : listed.length === 0 ? (
					<Text c="slate">
						{vector.name} has no generations yet, so every search of it is exact. Build
						a <Term id="turboquant">TurboQuant</Term> generation and activate it to
						compare the two.
					</Text>
				) : (
					<GenerationsTable
						generations={listed}
						truncated={generations.data?.truncated ?? false}
						onStep={setStep}
					/>
				)}
			</Paper>

			<Comparison
				client={client}
				sessionKey={sessionKey}
				collection={collection}
				vector={vector}
				selectedPoint={selectedPoint}
				active={active}
				lifecycleRevision={generations.data?.lifecycle_revision}
				labelOf={labelOf}
				colorOf={colorOf}
				onSelect={onSelect}
			/>

			<StepModal
				client={client}
				sessionKey={sessionKey}
				collection={collection}
				vector={vector}
				step={step}
				onClose={() => setStep(null)}
			/>
		</Section>
	);
}

interface GenerationsTableProps {
	generations: RrdGenerationView[];
	truncated: boolean;
	onStep: (step: RrdQuantizationStep) => void;
}

function GenerationsTable({ generations, truncated, onStep }: GenerationsTableProps) {
	const [open, setOpen] = useState<string | null>(null);
	return (
		<>
			<ScrollArea.Autosize mah={420}>
				<Table
					fz="sm"
					verticalSpacing={6}
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Generation</Table.Th>
							<Table.Th>Method</Table.Th>
							<Table.Th>State</Table.Th>
							<Table.Th>
								<Term id="cursor">Source cursor</Term>
							</Table.Th>
							<Table.Th>Vectors</Table.Th>
							<Table.Th>Packed vectors</Table.Th>
							<Table.Th>Built</Table.Th>
							<Table.Th />
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{generations.map((generation) => {
							const key = `${generation.artifact_id}:${generation.generation}`;
							const expanded = open === key;
							const ratio = packedRatio(generation);
							const target = {
								artifact_id: generation.artifact_id,
								generation: generation.generation,
							};
							return (
								<Fragment key={key}>
									<Table.Tr>
										<Table.Td>
											<UnstyledButton
												onClick={() => setOpen(expanded ? null : key)}
												aria-expanded={expanded}
												title="Show its digests"
											>
												<Group
													gap={4}
													wrap="nowrap"
												>
													<Icon
														path={
															expanded
																? iconChevronUp
																: iconChevronDown
														}
														size="sm"
													/>
													<Text
														fz="sm"
														fw={600}
													>
														{formatCount(generation.generation)}
													</Text>
												</Group>
											</UnstyledButton>
										</Table.Td>
										<Table.Td>
											<Text fz="sm">{methodLabel(generation.method)}</Text>
											{generation.method.method === "turbo_quant" && (
												<Text
													fz="xs"
													c="slate"
												>
													seed {generation.method.seed}
												</Text>
											)}
										</Table.Td>
										<Table.Td>
											<Badge
												variant="light"
												color={STATE_COLOR[generation.state]}
											>
												{generation.state}
											</Badge>
										</Table.Td>
										<Table.Td>{formatCount(generation.source_cursor)}</Table.Td>
										<Table.Td>
											{formatCount(generation.indexed_vectors)}
										</Table.Td>
										<Table.Td>
											<Text fz="sm">
												{formatSize(generation.packed_vector_bytes)}
											</Text>
											<Text
												fz="xs"
												c="slate"
											>
												{ratio === null
													? "no vectors"
													: `${ratio.toFixed(ratio < 10 ? 1 : 0)}× smaller than ${formatSize(generation.full_precision_vector_bytes)}`}
											</Text>
										</Table.Td>
										<Table.Td>
											{formatTime(generation.built_at_unix_ms)}
										</Table.Td>
										<Table.Td>
											<Group
												gap={6}
												justify="flex-end"
												wrap="nowrap"
											>
												{generation.state === "ready" && (
													<Button
														size="compact-xs"
														onClick={() =>
															onStep({ step: "activate", ...target })
														}
													>
														Activate
													</Button>
												)}
												{generation.state !== "retired" && (
													<Button
														size="compact-xs"
														variant="light"
														color="gray"
														onClick={() =>
															onStep({ step: "retire", ...target })
														}
													>
														Retire
													</Button>
												)}
											</Group>
										</Table.Td>
									</Table.Tr>
									{expanded && (
										<Table.Tr>
											<Table.Td colSpan={8}>
												<GenerationDetails generation={generation} />
											</Table.Td>
										</Table.Tr>
									)}
								</Fragment>
							);
						})}
					</Table.Tbody>
				</Table>
			</ScrollArea.Autosize>
			{truncated && (
				<Text
					fz="xs"
					c="slate"
					mt="xs"
				>
					The engine holds more generations than it listed; these are the first{" "}
					{formatCount(generations.length)}.
				</Text>
			)}
		</>
	);
}

function GenerationDetails({ generation }: { generation: RrdGenerationView }) {
	const rows: [string, string, string?][] = [
		["Artifact", generation.artifact_id],
		[
			"Artifact digest",
			shortDigest(generation.artifact_sha256, 16),
			generation.artifact_sha256,
		],
		[
			"Configuration digest",
			shortDigest(generation.configuration_sha256, 16),
			generation.configuration_sha256,
		],
		["Object digest", shortDigest(generation.object_sha256, 16), generation.object_sha256],
		["Object size", formatSize(generation.object_length)],
		["Auxiliary bytes", formatSize(generation.auxiliary_bytes)],
		["Largest ratio for its method", `${generation.maximum_compression_ratio}×`],
		["Lifecycle revision", formatCount(generation.lifecycle_revision)],
	];
	return (
		<SimpleGrid
			cols={{ base: 1, md: 2 }}
			spacing={4}
			py={4}
		>
			{rows.map(([label, value, title]) => (
				<Group
					key={label}
					gap="xs"
					wrap="nowrap"
				>
					<Text
						fz="xs"
						c="slate"
						w={170}
					>
						{label}
					</Text>
					<Text
						fz="xs"
						ff="monospace"
						title={title}
						truncate
					>
						{value}
					</Text>
				</Group>
			))}
		</SimpleGrid>
	);
}

interface ComparisonProps {
	client: RrdSessionClient;
	sessionKey: string;
	collection: RrdCollectionView;
	vector: RrdNamedVectorView;
	selectedPoint: RrdMapPointView | undefined;
	active: RrdGenerationView[];
	lifecycleRevision: number | undefined;
	labelOf: (subject: string) => string;
	colorOf: (point: string) => string;
	onSelect: (subject: string | null) => void;
}

function Comparison({
	client,
	sessionKey,
	collection,
	vector,
	selectedPoint,
	active,
	lifecycleRevision,
	labelOf,
	colorOf,
	onSelect,
}: ComparisonProps) {
	const [count, setCount] = useState("10");
	const [factor, setFactor] = useState(String(RERANK_FACTORS[1]));
	const topK = Number(count);
	// The comparison reads the query point too.
	const exactRerank = (topK + 1) * Number(factor);
	const pointId = selectedPoint ? referenceText(selectedPoint.reference) : null;
	const compare = useQuery({
		queryKey: [
			"rrd-vector-compare",
			sessionKey,
			collection.collection_id,
			vector.name,
			pointId,
			topK,
			exactRerank,
			// A lifecycle step changes what the approximate side can read.
			lifecycleRevision,
		],
		enabled: Boolean(selectedPoint),
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: () => {
			if (!selectedPoint) throw new Error("No vector is selected");
			return client.vectorCompare({
				collection_id: collection.collection_id,
				vector_name: vector.name,
				example: selectedPoint.reference,
				top_k: topK,
				exact_rerank: exactRerank,
			});
		},
	});
	const view = compare.data;
	const approximate = view?.approximate ?? null;
	const served = approximate
		? active.find(
				(generation) => generation.generation === approximate.search.selected_generation,
			)
		: undefined;
	const exactHits = view?.exact.search.hits ?? [];
	const approximateHits = approximate?.search.hits ?? [];
	const cut = exactHits.at(-1)?.score;
	const ties = (hit: RrdHitView) => cut !== undefined && Math.abs(hit.score - cut) <= SCORE_TIE;
	const exactKeys = useMemo(
		() => new Set(exactHits.map((hit) => referenceText(hit.reference))),
		[exactHits],
	);
	const approximateKeys = useMemo(
		() => new Set(approximateHits.map((hit) => referenceText(hit.reference))),
		[approximateHits],
	);

	return (
		<Paper p="md">
			<Group
				justify="space-between"
				align="flex-end"
				mb="sm"
			>
				<Box>
					<Label mb={0}>Exact and approximate, side by side</Label>
					<Text
						fz="xs"
						c="slate"
					>
						{selectedPoint
							? `Nearest records to ${labelOf(referenceText(selectedPoint.subject))}`
							: "Select a record on the map to compare its nearest records"}
					</Text>
				</Box>
				<Group
					gap="md"
					align="flex-end"
				>
					<Box>
						<Text
							fz="xs"
							c="slate"
							mb={2}
						>
							Neighbours
						</Text>
						<SegmentedControl
							size="xs"
							value={count}
							onChange={setCount}
							data={COMPARE_COUNTS}
						/>
					</Box>
					<Box>
						<Text
							fz="xs"
							c="slate"
							mb={2}
						>
							<Term id="rerank">Exact rerank</Term>
						</Text>
						<SegmentedControl
							size="xs"
							value={factor}
							onChange={setFactor}
							data={RERANK_FACTORS.map((multiple) => ({
								value: String(multiple),
								label: formatCount((topK + 1) * multiple),
							}))}
						/>
					</Box>
					<Button
						size="xs"
						variant="light"
						leftSection={<Icon path={iconRefresh} />}
						disabled={!selectedPoint}
						loading={compare.isFetching}
						onClick={() => compare.refetch()}
					>
						Run again
					</Button>
				</Group>
			</Group>

			{!selectedPoint ? null : compare.isPending ? (
				<Group justify="center">
					<Loader size="sm" />
				</Group>
			) : compare.isError ? (
				<Alert
					color="red"
					title="The comparison failed"
					icon={<Icon path={iconErrorCircle} />}
				>
					{compare.error instanceof Error ? compare.error.message : "Unknown RRD error"}
				</Alert>
			) : view ? (
				<Stack gap="md">
					{approximate && (
						<SimpleGrid cols={{ base: 2, md: 4 }}>
							<Stat
								label={`Recall@${view.top_k}`}
								value={view.recall === null ? "—" : view.recall.toFixed(2)}
								title={`${view.matched} of ${exactHits.length} exact neighbours found`}
							/>
							<Stat
								label="Round trip"
								value={`${formatMs(view.exact.round_trip_ms)} → ${formatMs(approximate.round_trip_ms)}`}
								title="Exact, then approximate, timed by Connectome's native process"
							/>
							<Stat
								label="Keys examined"
								value={`${formatCount(view.exact.search.keys_examined)} → ${formatCount(approximate.search.keys_examined)}`}
							/>
							<Stat
								label="Full vectors read"
								value={`${formatCount(view.exact.search.canonical_candidates)} → ${formatCount(approximate.search.canonical_candidates)}`}
								title="Vectors each search read at full precision"
							/>
						</SimpleGrid>
					)}
					{approximate && !view.same_cursor && (
						<Text
							fz="xs"
							c="orange"
						>
							The estate changed between the two searches (cursor{" "}
							{formatCount(view.exact.search.known_at_cursor)}, then{" "}
							{formatCount(approximate.search.known_at_cursor)}), so the lists compare
							two states. Run again to compare one.
						</Text>
					)}
					<SimpleGrid cols={{ base: 1, md: 2 }}>
						<HitList
							title={
								<>
									<Term id="exact">Exact search</Term> · every vector compared
								</>
							}
							hits={exactHits}
							mark={(hit) =>
								approximate &&
								!approximateKeys.has(referenceText(hit.reference)) &&
								!ties(hit)
									? "missed"
									: null
							}
							labelOf={labelOf}
							colorOf={colorOf}
							onSelect={onSelect}
						/>
						{approximate ? (
							<HitList
								title={
									<>
										{served
											? methodLabel(served.method)
											: approximate.search.access_path}{" "}
										· generation{" "}
										{formatCount(approximate.search.selected_generation)}
									</>
								}
								hits={approximateHits}
								mark={(hit) =>
									exactKeys.has(referenceText(hit.reference))
										? null
										: ties(hit)
											? "tie"
											: "not exact"
								}
								labelOf={labelOf}
								colorOf={colorOf}
								onSelect={onSelect}
							/>
						) : (
							<Alert
								color="gray"
								title={
									active.length === 0
										? "No generation is active"
										: "The engine searched exactly only"
								}
							>
								<Stack gap={6}>
									<Text fz="sm">
										{active.length === 0
											? "Approximate search needs an active generation of this named vector. Build one above and activate it."
											: "The engine refused the approximate search."}
									</Text>
									{view.approximate_refusal && (
										<Text
											fz="xs"
											ff="monospace"
											c="slate"
										>
											{view.approximate_refusal}
										</Text>
									)}
								</Stack>
							</Alert>
						)}
					</SimpleGrid>
					{approximate && (
						<SearchEvidence
							exact={view.exact}
							approximate={approximate}
						/>
					)}
				</Stack>
			) : null}
		</Paper>
	);
}

interface HitListProps {
	title: ReactNode;
	hits: RrdHitView[];
	mark: (hit: RrdHitView) => "missed" | "not exact" | "tie" | null;
	labelOf: (subject: string) => string;
	colorOf: (point: string) => string;
	onSelect: (subject: string | null) => void;
}

const MARK_COLOR = { missed: "orange", "not exact": "orange", tie: "gray" } as const;
const MARK_TITLE = {
	missed: "An exact neighbour the approximate search did not return",
	"not exact": "Returned by the approximate search but not among the exact neighbours",
	tie: "Scores the same as the exact list's last neighbour, so it is as near",
} as const;

function HitList({ title, hits, mark, labelOf, colorOf, onSelect }: HitListProps) {
	const top = hits[0]?.score ?? 1;
	return (
		<Box>
			<Text
				fz="sm"
				fw={600}
				c="bright"
				mb={4}
			>
				{title}
			</Text>
			<Stack gap={2}>
				{hits.map((hit, index) => {
					const point = referenceText(hit.reference);
					const subject = referenceText(hit.subject);
					const marked = mark(hit);
					return (
						<UnstyledButton
							key={point}
							px={6}
							py={4}
							className={classes.row}
							onClick={() => onSelect(subject)}
						>
							<Group
								gap={8}
								wrap="nowrap"
							>
								<Text
									fz="xs"
									c="slate"
									w={18}
									ta="right"
								>
									{index + 1}
								</Text>
								<Box
									w={9}
									h={9}
									bg={colorOf(point)}
									style={{ borderRadius: "50%", flexShrink: 0 }}
								/>
								<Text
									fz="sm"
									truncate
									title={labelOf(subject)}
								>
									{labelOf(subject)}
								</Text>
								{marked && (
									<Badge
										size="xs"
										variant="light"
										color={MARK_COLOR[marked]}
										title={MARK_TITLE[marked]}
									>
										{marked}
									</Badge>
								)}
								<Text
									fz="xs"
									ff="monospace"
									ml="auto"
								>
									{formatScore(hit.score)}
								</Text>
							</Group>
							<Progress
								mt={4}
								size="xs"
								value={top > 0 ? Math.max(0, (hit.score / top) * 100) : 0}
								color="violet"
							/>
						</UnstyledButton>
					);
				})}
			</Stack>
		</Box>
	);
}

function SearchEvidence({
	exact,
	approximate,
}: {
	exact: RrdComparedSearchView;
	approximate: RrdComparedSearchView;
}) {
	const rows: [ReactNode, string, string][] = [
		["Access path", exact.search.access_path, approximate.search.access_path],
		["Round trip", formatMs(exact.round_trip_ms), formatMs(approximate.round_trip_ms)],
		[
			"Keys examined",
			formatCount(exact.search.keys_examined),
			formatCount(approximate.search.keys_examined),
		],
		[
			"Vectors read at full precision",
			formatCount(exact.search.canonical_candidates),
			formatCount(approximate.search.canonical_candidates),
		],
		[
			"Candidates the plan expected to score",
			formatCount(exact.search.selected_candidates),
			formatCount(approximate.search.selected_candidates),
		],
		[
			<Term
				key="rerank"
				id="rerank"
			>
				Reranked exactly
			</Term>,
			"—",
			formatCount(approximate.search.exact_rerank),
		],
		["Written since the generation", "—", formatCount(approximate.search.overlay_candidates)],
		[
			"Generation bytes loaded",
			formatSize(exact.search.loaded_artifact_bytes),
			formatSize(approximate.search.loaded_artifact_bytes),
		],
		[
			<Term
				key="cursor"
				id="cursor"
			>
				Cursor
			</Term>,
			formatCount(exact.search.known_at_cursor),
			formatCount(approximate.search.known_at_cursor),
		],
	];
	return (
		<Table
			fz="sm"
			verticalSpacing={4}
		>
			<Table.Thead>
				<Table.Tr>
					<Table.Th />
					<Table.Th ta="right">Exact</Table.Th>
					<Table.Th ta="right">Approximate</Table.Th>
				</Table.Tr>
			</Table.Thead>
			<Table.Tbody>
				{rows.map(([label, left, right], index) => (
					<Table.Tr key={index}>
						<Table.Td c="slate">{label}</Table.Td>
						<Table.Td
							ta="right"
							ff="monospace"
						>
							{left}
						</Table.Td>
						<Table.Td
							ta="right"
							ff="monospace"
						>
							{right}
						</Table.Td>
					</Table.Tr>
				))}
			</Table.Tbody>
		</Table>
	);
}

interface StepModalProps {
	client: RrdSessionClient;
	sessionKey: string;
	collection: RrdCollectionView;
	vector: RrdNamedVectorView;
	/** `build` opens the method form first; a step opens its proposal. */
	step: RrdQuantizationStep | "build" | null;
	onClose: () => void;
}

type Phase =
	| { phase: "choose" }
	| { phase: "proposing" }
	| { phase: "proposed"; proposal: RrdQuantizationProposalView }
	| { phase: "applying"; proposal: RrdQuantizationProposalView }
	| { phase: "applied"; applied: RrdQuantizationAppliedView }
	| {
			phase: "failed";
			message: string;
			proposal: RrdQuantizationProposalView | null;
			unsettled: boolean;
	  };

const STEP_TITLE = {
	build: "Build a search generation",
	activate: "Activate this generation",
	retire: "Retire this generation",
} as const;

/** A proposal the native process refused: nothing is held, so there is nothing to retry. */
function refused(error: unknown): Phase {
	return {
		phase: "failed",
		message: error instanceof Error ? error.message : String(error),
		proposal: null,
		unsettled: false,
	};
}

function StepModal({ client, sessionKey, collection, vector, step, onClose }: StepModalProps) {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<Phase>({ phase: "choose" });
	const [method, setMethod] = useState<MethodName>("turbo_quant");
	const [bits, setBits] = useState<TurboQuantBits>("bits4");
	const [seed, setSeed] = useState<number>(DEFAULT_SEED);
	const [compression, setCompression] = useState<ProductCompression>("x16");

	const propose = async (proposed: RrdQuantizationStep) => {
		setPhase({ phase: "proposing" });
		try {
			setPhase({ phase: "proposed", proposal: await client.proposeQuantization(proposed) });
		} catch (error) {
			setPhase(refused(error));
		}
	};

	// A build opens on its method form; a step from the table is proposed as
	// soon as the dialog opens.
	useEffect(() => {
		if (step === null) return;
		if (step === "build") {
			setPhase({ phase: "choose" });
			return;
		}
		let current = true;
		setPhase({ phase: "proposing" });
		client.proposeQuantization(step).then(
			(proposal) => current && setPhase({ phase: "proposed", proposal }),
			(error) => current && setPhase(refused(error)),
		);
		return () => {
			current = false;
		};
	}, [client, step]);

	const apply = async (proposal: RrdQuantizationProposalView) => {
		setPhase({ phase: "applying", proposal });
		try {
			const applied = await client.applyQuantization(proposal);
			setPhase({ phase: "applied", applied });
		} catch (error) {
			// An unsettled step stays held natively; applying it again replays it.
			setPhase({
				phase: "failed",
				message: error instanceof Error ? error.message : String(error),
				proposal,
				unsettled: isRetryable(error),
			});
		} finally {
			await queryClient.invalidateQueries({
				queryKey: ["rrd-vector-quantizations", sessionKey],
			});
		}
	};

	const close = () => {
		const held =
			phase.phase === "proposed" || (phase.phase === "failed" && phase.unsettled)
				? phase.proposal
				: null;
		if (held) void client.discardQuantization(held.handle).catch(() => undefined);
		onClose();
	};

	const title = step === null ? "" : STEP_TITLE[step === "build" ? "build" : step.step];

	return (
		<Modal
			opened={step !== null}
			onClose={close}
			size="lg"
			title={<PrimaryTitle>{title}</PrimaryTitle>}
		>
			{phase.phase === "choose" ? (
				<Stack gap="md">
					<Text fz="sm">
						The engine encodes every vector of {vector.name} in{" "}
						{collection.collection_id} as it is now. The new generation is ready, not
						served: search keeps its current path until you activate it.
					</Text>
					<SegmentedControl
						value={method}
						onChange={(value) => setMethod(value as MethodName)}
						data={METHODS}
					/>
					{method === "turbo_quant" && (
						<Group grow>
							<Select
								label="Bits per number"
								data={TURBOQUANT_BITS.map((option) => ({
									value: option.value,
									label: `${option.label} · ${option.ratio}× smaller`,
								}))}
								value={bits}
								allowDeselect={false}
								onChange={(value) => value && setBits(value as TurboQuantBits)}
							/>
							<NumberInput
								label="Rotation seed"
								description="The same seed and vectors give the same generation"
								min={0}
								max={Number.MAX_SAFE_INTEGER}
								allowDecimal={false}
								allowNegative={false}
								value={seed}
								onChange={(value) => setSeed(typeof value === "number" ? value : 0)}
							/>
						</Group>
					)}
					{method === "product" && (
						<Select
							label="Compression"
							data={PRODUCT_COMPRESSIONS.map((value) => ({
								value,
								label: `${value.replace("x", "")}× smaller`,
							}))}
							value={compression}
							allowDeselect={false}
							onChange={(value) =>
								value && setCompression(value as ProductCompression)
							}
						/>
					)}
					<Group justify="flex-end">
						<Button
							variant="light"
							color="gray"
							onClick={close}
						>
							Cancel
						</Button>
						<Button
							onClick={() =>
								propose({
									step: "build",
									collection_id: collection.collection_id,
									vector_name: vector.name,
									method: buildMethod(method, bits, seed, compression),
								})
							}
						>
							Review the request
						</Button>
					</Group>
				</Stack>
			) : phase.phase === "proposing" ? (
				<Group justify="center">
					<Loader size="sm" />
				</Group>
			) : phase.phase === "proposed" || phase.phase === "applying" ? (
				<Stack gap="md">
					<Text fz="sm">
						{phase.proposal.step === "build"
							? "Applying sends exactly this request. Nothing is served until you activate the generation it builds."
							: phase.proposal.step === "activate"
								? "Applying sends exactly this request. Approximate search starts reading this generation, and a generation it replaces is retired."
								: "Applying sends exactly this request. Approximate search stops reading this generation; the stored vectors are unchanged."}
					</Text>
					<CodeBlock
						title={phase.proposal.operation}
						lang="json"
						value={JSON.stringify(phase.proposal.request, null, 2)}
					/>
					<Group justify="flex-end">
						<Button
							variant="light"
							color="gray"
							disabled={phase.phase === "applying"}
							onClick={close}
						>
							Cancel
						</Button>
						<Button
							loading={phase.phase === "applying"}
							color={phase.proposal.step === "retire" ? "red" : undefined}
							onClick={() => apply(phase.proposal)}
						>
							{phase.proposal.step === "build"
								? "Build"
								: phase.proposal.step === "activate"
									? "Activate"
									: "Retire"}
						</Button>
					</Group>
				</Stack>
			) : phase.phase === "applied" ? (
				<Stack gap="md">
					<Alert
						color="green"
						icon={<Icon path={iconCheck} />}
						title={`Generation ${formatCount(phase.applied.generation.generation)} is ${phase.applied.generation.state}`}
					>
						<Stack gap={4}>
							<Text fz="sm">
								{methodLabel(phase.applied.generation.method)} ·{" "}
								{formatCount(phase.applied.generation.indexed_vectors)} vectors ·
								packed in {formatSize(phase.applied.generation.packed_vector_bytes)}
							</Text>
							{phase.applied.keys_examined !== null && (
								<Text
									fz="xs"
									c="slate"
								>
									The build read {formatCount(phase.applied.selected_versions)}{" "}
									vector versions and examined{" "}
									{formatCount(phase.applied.keys_examined)} keys.
								</Text>
							)}
							{phase.applied.idempotent_replay && (
								<Text
									fz="xs"
									c="slate"
								>
									The engine had already applied this step; this is the result it
									recorded.
								</Text>
							)}
						</Stack>
					</Alert>
					<Group justify="flex-end">
						<Button onClick={onClose}>Done</Button>
					</Group>
				</Stack>
			) : (
				<Stack gap="md">
					<Alert
						color="red"
						title={
							phase.unsettled
								? "The engine's answer did not arrive"
								: "The engine refused"
						}
						icon={<Icon path={iconErrorCircle} />}
					>
						<Stack gap={6}>
							<Text fz="sm">{phase.message}</Text>
							{phase.unsettled && (
								<Text fz="sm">
									The step may have been applied. Applying it again settles it:
									the engine answers with its recorded result instead of applying
									it twice.
								</Text>
							)}
						</Stack>
					</Alert>
					<Divider />
					<Group justify="flex-end">
						<Button
							variant="light"
							color="gray"
							onClick={close}
						>
							Close
						</Button>
						{phase.unsettled && phase.proposal && (
							<Button onClick={() => phase.proposal && apply(phase.proposal)}>
								Apply again
							</Button>
						)}
					</Group>
				</Stack>
			)}
		</Modal>
	);
}
