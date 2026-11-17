import { Alert, Badge, Group, Loader, Paper, SimpleGrid, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "~/components/Icon";
import { describeRrdError } from "~/rrflow/runtime";
import { readTaskRecovery } from "~/rrflow/tasks";
import { iconErrorCircle } from "~/shared/assets/icons";
import { busyRetry } from "../api/queries";
import { Section } from "../components/Section";
import { Stat } from "../components/stat";
import { useProject } from "../project/context";
import { shortDigest } from "../utils/format";

/**
 * The routing decision of the last attempt this window made, read back from
 * the engine. Connectome keeps only that attempt's coordinates; the decision
 * itself is always the engine's record.
 */
export function LastProposal() {
	const { session, client, sessionKey } = useProject();
	// The Tasks view saves the coordinates of its last attempt under this key.
	const recoveryKey = `rrd-task-recovery:${client.profile}:${session?.instance ?? ""}`;
	const attempt = useQuery({
		queryKey: ["rrd-routes-attempt", sessionKey, recoveryKey],
		queryFn: async () => {
			const saved = readTaskRecovery(recoveryKey);
			if (!saved) return null;
			const reply = await client.task({
				action: "attempt",
				task_id: saved.task_id,
				attempt_id: saved.attempt_id,
			});
			if (reply.kind !== "attempt") throw new Error("Unexpected attempt response");
			return { saved, status: reply.status, proposal: reply.proposal };
		},
		enabled: Boolean(session),
		...busyRetry,
	});

	if (!session) return null;

	const read = attempt.data;
	const proposal = read?.proposal ?? null;

	return (
		<Section
			title="The last routing decision made from this window"
			description="When you ask for a route under Tasks, the controller answers with a proposal. This is the engine's record of the most recent one this window asked for."
		>
			{attempt.isPending && <Loader />}
			{attempt.isError && (
				<Alert
					color="red"
					title="The last routing decision could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(attempt.error)}
				</Alert>
			)}
			{read === null && (
				<Paper p="md">
					<Text c="slate">
						This window has not asked the engine for a route in this project, so there
						is no decision to read back.
					</Text>
				</Paper>
			)}
			{read && (
				<Paper p="md">
					<Group
						gap="xs"
						mb="sm"
					>
						<Badge variant="light">
							attempt {read.status ?? "not recorded by the engine"}
						</Badge>
						<Text
							ff="monospace"
							fz="xs"
							c="slate"
						>
							task {read.saved.task_id} · attempt {read.saved.attempt_id}
						</Text>
					</Group>
					{proposal === null ? (
						<Text c="slate">
							The engine holds no routing proposal for this attempt.
						</Text>
					) : (
						<>
							<Text
								fw={650}
								mb="sm"
							>
								{proposal.choice.kind === "select"
									? `The controller chose endpoint ${proposal.choice.binding_id}${
											proposal.choice.effort
												? ` at ${proposal.choice.effort} effort`
												: ""
										}.`
									: `The controller declined to choose: ${proposal.choice.reason}`}
							</Text>
							<SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
								<Stat
									label="Controller endpoint"
									value={proposal.controller_binding_id}
									title={proposal.controller_binding_id}
								/>
								<Stat
									label="Service"
									value={proposal.service_id}
									title={proposal.service_id}
								/>
								<Stat
									label="Controller took"
									value={
										proposal.elapsed_ms === null
											? "not reported"
											: `${Number(proposal.elapsed_ms).toLocaleString()} ms`
									}
								/>
								<Stat
									label="Configuration digest"
									value={shortDigest(proposal.configuration_sha256)}
									title={proposal.configuration_sha256}
								/>
								<Stat
									label="Task digest"
									value={shortDigest(proposal.task_sha256)}
									title={proposal.task_sha256}
								/>
								<Stat
									label="Response digest"
									value={shortDigest(proposal.response_sha256)}
									title={proposal.response_sha256}
								/>
							</SimpleGrid>
						</>
					)}
				</Paper>
			)}
		</Section>
	);
}
