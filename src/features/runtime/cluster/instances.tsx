import { Badge, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { RrdEngramInstanceView } from "~/rrflow/session";
import { formatCount, formatTime, shortDigest } from "../utils/format";

/** Badge colour for a phase, status or state word the engine reported. */
export function stateColor(word: string): string {
	switch (word) {
		case "running":
		case "ready":
		case "succeeded":
		case "completed":
		case "active":
			return "green";
		case "failed":
			return "red";
		case "degraded":
		case "stale":
		case "neglected":
			return "orange";
		case "stopped":
		case "absent":
		case "retired":
		case "superseded":
		case "unknown":
		case "idle":
			return "gray";
		default:
			return "blue";
	}
}

/** One labelled line inside a table cell. */
export function Line({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Text fz="sm">
			<Text
				span
				c="slate"
			>
				{label}{" "}
			</Text>
			{children}
		</Text>
	);
}

/** A digest as a recognisable prefix; the full value shows on hover. */
export function Digest({ value }: { value: string }) {
	return (
		<Text
			span
			ff="monospace"
			fz="sm"
			title={value}
		>
			{shortDigest(value)}
		</Text>
	);
}

/** An optional instant: its time, or the plain fact that the engine recorded none. */
function instant(unixMs: number | null): string {
	return unixMs === null ? "none recorded" : formatTime(unixMs);
}

export function Instances({ instances }: { instances: RrdEngramInstanceView[] }) {
	if (instances.length === 0) {
		return <Text c="slate">The engine returned zero instances for this engram.</Text>;
	}
	return (
		<Paper p="md">
			<ScrollArea>
				<Table
					verticalSpacing="sm"
					miw={980}
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Instance</Table.Th>
							<Table.Th>Asked for</Table.Th>
							<Table.Th>Last observed</Table.Th>
							<Table.Th>Activity</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{instances.map(({ id, desired, observed, activity }) => (
							<Table.Tr
								key={id}
								style={{ verticalAlign: "top" }}
							>
								<Table.Td>
									<Text
										ff="monospace"
										fz="sm"
									>
										{id}
									</Text>
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Badge
											variant="light"
											color={stateColor(desired.phase)}
										>
											{desired.phase}
										</Badge>
										<Line label="version">{desired.version}</Line>
										<Line label="generation">
											{formatCount(desired.generation)}
										</Line>
										<Line label="deployment">{desired.deployment_ref}</Line>
										<Line label="configuration">
											<Digest value={desired.configuration_sha256} />
										</Line>
										<Line label="asked">
											{formatTime(desired.updated_at_unix_ms)}
										</Line>
									</Stack>
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Badge
											variant="light"
											color={stateColor(observed.phase)}
										>
											{observed.phase}
										</Badge>
										<Line label="version">
											{observed.version ?? "none reported"}
										</Line>
										<Line label="generation">
											{formatCount(observed.generation)}
										</Line>
										<Line label="process id">
											{observed.process_id ?? "none reported"}
										</Line>
										<Line label="evidence">
											{observed.evidence_sha256 ? (
												<Digest value={observed.evidence_sha256} />
											) : (
												"none recorded"
											)}
										</Line>
										<Line label="observed">
											{formatTime(observed.observed_at_unix_ms)}
										</Line>
										{observed.error && (
											<Text
												fz="sm"
												c="red"
											>
												{observed.error}
											</Text>
										)}
									</Stack>
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Badge
											variant="light"
											color={stateColor(activity.class)}
										>
											{activity.class}
										</Badge>
										<Line label="last heartbeat">
											{instant(activity.last_heartbeat_at_unix_ms)}
										</Line>
										<Line label="last real work">
											{instant(activity.last_meaningful_runtime_at_unix_ms)}
										</Line>
										<Line label="judged">
											{formatTime(activity.evaluated_at_unix_ms)}
										</Line>
									</Stack>
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}
