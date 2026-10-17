import { Badge, Box, Group, Paper, Progress, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import { Label } from "~/components/Label";
import type { RrdMetricView, RrdPhysicalStorageView } from "~/rrflow/session";
import { formatCount, formatSize } from "./format";
import classes from "./style.module.scss";

export function formatMetric(unit: RrdMetricView["unit"], value: number): string {
	switch (unit) {
		case "bytes":
			return formatSize(value);
		case "ratio":
			return `${(value * 100).toFixed(1)}%`;
		default:
			return formatCount(value);
	}
}

export function fill(metric: RrdMetricView): number | null {
	if (metric.limit === null || metric.limit <= 0) return null;
	return Math.min(100, (metric.value / metric.limit) * 100);
}

export function fillColor(percent: number): string {
	return percent >= 90 ? "red" : percent >= 70 ? "orange" : "violet";
}

/** Change of each cumulative counter since the previous observation. */
function useCounterDeltas(view: RrdPhysicalStorageView) {
	const previous = useRef<RrdPhysicalStorageView | null>(null);
	const deltas = useMemo(() => {
		const changes = new Map<string, number>();
		const before = previous.current;
		if (!before || before.observed_at_unix_ms >= view.observed_at_unix_ms) {
			return changes;
		}
		const prior = new Map<string, number>(
			before.groups.flatMap((group) =>
				group.metrics.map((metric): [string, number] => [
					`${group.id}.${metric.id}`,
					metric.value,
				]),
			),
		);
		for (const group of view.groups) {
			for (const metric of group.metrics) {
				const key = `${group.id}.${metric.id}`;
				const old = prior.get(key);
				if (metric.cumulative && old !== undefined) {
					changes.set(key, metric.value - old);
				}
			}
		}
		return changes;
	}, [view]);

	useEffect(() => {
		previous.current = view;
	}, [view]);

	return deltas;
}

function HeadlineGauge({ metric }: { metric: RrdMetricView }) {
	const percent = fill(metric);
	return (
		<Paper
			p="md"
			className={classes.stat}
		>
			<Text
				fz="xs"
				tt="uppercase"
				c="slate"
			>
				{metric.label}
			</Text>
			<Text
				fz="xl"
				fw={700}
				ff="monospace"
				c="bright"
			>
				{formatMetric(metric.unit, metric.value)}
			</Text>
			{percent !== null && metric.unit !== "ratio" && metric.limit !== null && (
				<>
					<Progress
						mt={6}
						value={percent}
						color={fillColor(percent)}
					/>
					<Text
						fz="xs"
						c="slate"
						mt={4}
					>
						{percent.toFixed(0)}% of {formatMetric(metric.unit, metric.limit)}
					</Text>
				</>
			)}
			{metric.unit === "ratio" && (
				<Progress
					mt={6}
					value={metric.value * 100}
					color="green"
				/>
			)}
		</Paper>
	);
}

export function PhysicalStorage({ view }: { view: RrdPhysicalStorageView }) {
	const deltas = useCounterDeltas(view);

	if (view.groups.length === 0) {
		return (
			<Text c="slate">
				The {view.profile} profile reports {view.evidence_level} evidence: it keeps no
				physical counters.
			</Text>
		);
	}

	return (
		<Stack gap="md">
			<SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
				{view.headline.map((metric) => (
					<HeadlineGauge
						key={metric.id}
						metric={metric}
					/>
				))}
			</SimpleGrid>
			<SimpleGrid cols={{ base: 1, lg: 2 }}>
				{view.groups.map((group) => (
					<Paper
						key={group.id}
						p="md"
					>
						<Label>{group.label}</Label>
						<Table
							fz="sm"
							verticalSpacing={4}
						>
							<Table.Tbody>
								{group.metrics.map((metric) => {
									const percent = fill(metric);
									const delta = deltas.get(`${group.id}.${metric.id}`);
									return (
										<Table.Tr key={metric.id}>
											<Table.Td c="slate">{metric.label}</Table.Td>
											<Table.Td
												ff="monospace"
												ta="right"
											>
												{formatMetric(metric.unit, metric.value)}
											</Table.Td>
											<Table.Td w={140}>
												{percent !== null && metric.unit !== "ratio" ? (
													<Progress
														value={percent}
														color={fillColor(percent)}
													/>
												) : delta !== undefined && delta !== 0 ? (
													<Badge
														variant="light"
														color="green"
														ff="monospace"
													>
														+{formatMetric(metric.unit, delta)}
													</Badge>
												) : metric.cumulative ? (
													<Text
														fz="xs"
														c="slate"
													>
														since open
													</Text>
												) : null}
											</Table.Td>
										</Table.Tr>
									);
								})}
							</Table.Tbody>
						</Table>
						{group.notes.length > 0 && (
							<Box mt="xs">
								{group.notes.map((note) => (
									<Text
										key={note}
										fz="xs"
										c="slate"
										ff="monospace"
									>
										{note}
									</Text>
								))}
							</Box>
						)}
					</Paper>
				))}
			</SimpleGrid>
			<Group gap="xs">
				<Badge variant="outline">{view.profile}</Badge>
				<Badge variant="outline">{view.evidence_level}</Badge>
				<Text
					fz="xs"
					c="slate"
				>
					Observation authority: process-local counters, not bound to the read stamp; a
					green badge is the change since the previous refresh.
				</Text>
			</Group>
		</Stack>
	);
}
