import { Badge, Group, Paper, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import type { RrdQueryAnalysisView, RrdQueryView } from "~/rrflow/session";
import { plural } from "~/shared/util/text/helpers";
import { Section } from "../components/Section";
import { Stat } from "../components/stat";
import { formatCount, formatSize, shortDigest } from "../utils/format";

function Candidates({ result }: { result: RrdQueryView }) {
	const { candidates } = result.plan;
	const chosen = candidates.filter((candidate) => candidate.selected);
	const rejected = candidates.filter((candidate) => !candidate.selected);
	if (candidates.length === 0) {
		return (
			<Paper p="md">
				<Text c="slate">
					The engine listed zero candidate access paths in the plan for this query.
				</Text>
			</Paper>
		);
	}
	return (
		<Paper p="md">
			<Text
				fw={650}
				mb="xs"
			>
				{chosen.length === 0
					? "The engine marked none of its candidates as chosen."
					: `The engine chose ${chosen.map((candidate) => candidate.name).join(", ")} and rejected ${formatCount(rejected.length)} other ${plural(rejected.length, "path")}.`}
			</Text>
			<Table fz="sm">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Access path</Table.Th>
						<Table.Th>Decision</Table.Th>
						<Table.Th>Answer</Table.Th>
						<Table.Th>The engine's reason</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{[...chosen, ...rejected].map((candidate) => (
						<Table.Tr key={candidate.name}>
							<Table.Td ff="monospace">{candidate.name}</Table.Td>
							<Table.Td>
								<Badge
									variant={candidate.selected ? "filled" : "light"}
									color={candidate.selected ? "green" : "gray"}
								>
									{candidate.selected ? "chosen" : "rejected"}
								</Badge>
							</Table.Td>
							<Table.Td>{candidate.exact ? "exact" : "approximate"}</Table.Td>
							<Table.Td>{candidate.reason}</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Paper>
	);
}

function ReadPaths({ result }: { result: RrdQueryView }) {
	const evidence = result.execution.read_evidence;
	const proof =
		evidence.stamp_validation_change_reads > 0 || evidence.stamp_validation_proof_nodes > 0
			? ` (${formatCount(evidence.stamp_validation_change_reads)} change reads, ${formatCount(evidence.stamp_validation_proof_nodes)} proof nodes)`
			: "";
	return (
		<Paper p="md">
			<Text
				fw={650}
				mb="xs"
			>
				What the engine read from storage
			</Text>
			<Text
				fz="sm"
				c="slate"
				mb="sm"
			>
				{formatCount(evidence.keys_examined)} of a budget of{" "}
				{formatCount(evidence.key_budget)} storage keys examined;{" "}
				{formatCount(evidence.values_decoded)} values decoded (
				{formatSize(evidence.decoded_bytes)}). Read point checked by{" "}
				{evidence.stamp_validation_method}
				{proof}.
			</Text>
			{evidence.paths.length === 0 ? (
				<Text c="slate">The engine attributed these reads to zero storage paths.</Text>
			) : (
				<Table fz="sm">
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Storage path</Table.Th>
							<Table.Th>Point reads</Table.Th>
							<Table.Th>Range scans</Table.Th>
							<Table.Th>Keys examined</Table.Th>
							<Table.Th>Values decoded</Table.Th>
							<Table.Th>Decoded</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{evidence.paths.map((path) => (
							<Table.Tr key={path.path}>
								<Table.Td ff="monospace">{path.path}</Table.Td>
								<Table.Td>{formatCount(path.point_reads)}</Table.Td>
								<Table.Td>{formatCount(path.range_scans)}</Table.Td>
								<Table.Td>{formatCount(path.keys_examined)}</Table.Td>
								<Table.Td>{formatCount(path.values_decoded)}</Table.Td>
								<Table.Td>{formatSize(path.decoded_bytes)}</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			)}
		</Paper>
	);
}

function Analysis({ analysis }: { analysis: RrdQueryAnalysisView }) {
	const stats: [string, string][] = [
		["Execution engine", analysis.engine],
		["Elapsed", `${formatCount(analysis.elapsed_micros)} µs`],
		["Provider scans", formatCount(analysis.provider_scans)],
		["Physical operators", formatCount(analysis.physical_operators)],
		["Input rows", formatCount(analysis.input_rows)],
		["Input batches", formatCount(analysis.input_batches)],
		["Input memory", formatSize(analysis.input_memory_bytes)],
		["Output batches", formatCount(analysis.output_batches)],
		["Peak memory", formatSize(analysis.peak_memory_bytes)],
		["Projection pushdown", analysis.projection_pushdown],
		["Filter pushdown", analysis.filter_pushdown],
		["Limit pushdown", analysis.limit_pushdown],
		["Spills", formatCount(analysis.spill_count)],
		["Spilled rows", formatCount(analysis.spilled_rows)],
		["Spilled", formatSize(analysis.spilled_bytes)],
	];
	return (
		<Paper p="md">
			<Text
				fw={650}
				mb="sm"
			>
				The engine's analysis of this run
			</Text>
			<SimpleGrid cols={{ base: 2, md: 3, xl: 5 }}>
				{stats.map(([label, value]) => (
					<Stat
						key={label}
						label={label}
						value={value}
						title={value}
					/>
				))}
			</SimpleGrid>
		</Paper>
	);
}

/** How the engine chose to answer one query, from that query's own result. */
export function QueryAnswer({ result }: { result: RrdQueryView }) {
	const { plan, execution } = result;
	return (
		<Section
			title="How the engine answered"
			description="The plan the engine bound for this query and what running it cost. Every value here came back with the rows above."
		>
			<Stack gap="md">
				<Group gap="xs">
					<Badge
						variant="light"
						color={plan.exact ? "green" : "orange"}
					>
						{plan.exact ? "exact answer" : "approximate answer"}
					</Badge>
					<Badge variant="outline">order: {plan.deterministic_order}</Badge>
					<Badge variant="outline">access: {plan.authorization_boundary}</Badge>
					{execution.truncated && <Badge color="orange">truncated</Badge>}
				</Group>
				<Candidates result={result} />
				<SimpleGrid cols={{ base: 2, md: 4, xl: 6 }}>
					<Stat
						label="Versions read"
						value={formatCount(execution.selected_versions)}
					/>
					<Stat
						label="Rows returned"
						value={formatCount(execution.returned_rows)}
					/>
					<Stat
						label="Bytes returned"
						value={formatSize(execution.output_bytes)}
						title={`${formatCount(execution.output_bytes)} bytes`}
					/>
					<Stat
						label="Known at cursor"
						value={formatCount(result.known_at_cursor)}
					/>
					<Stat
						label="Schema revision"
						value={formatCount(result.schema_revision)}
					/>
					<Stat
						label="Security policy revision"
						value={formatCount(plan.security_policy_revision)}
						title="Zero means an explicitly unsecured local development engine"
					/>
					<Stat
						label="Plan digest"
						value={shortDigest(plan.plan_sha256)}
						title={plan.plan_sha256}
					/>
					<Stat
						label="Authorization digest"
						value={shortDigest(plan.authorization_sha256)}
						title={plan.authorization_sha256}
					/>
				</SimpleGrid>
				<ReadPaths result={result} />
				{execution.analysis ? (
					<Analysis analysis={execution.analysis} />
				) : (
					<Text
						fz="sm"
						c="slate"
					>
						The engine attached no run analysis to this result.
					</Text>
				)}
			</Stack>
		</Section>
	);
}
