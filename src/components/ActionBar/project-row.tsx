import { Alert, Badge, Button, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import { useId } from "react";
import {
	type ProjectRow as Row,
	type RowActivity,
	removalStatement,
	rowControls,
} from "~/rrflow/project-manager";
import type {
	EngramPreview,
	EngramSelection,
	InstanceState,
	ProjectInstance,
} from "~/shared/types";
import { displayPath } from "./installation-facts";
import { InstallationSummary } from "./installation-summary";

/** An installation the engine planned for one project, waiting for its review. */
export interface Review {
	value: EngramPreview;
	/** The exact selection the plan was made with; applying uses nothing else. */
	selection: EngramSelection;
}

const STAGE_LABEL: Record<NonNullable<ProjectInstance["stage"]>, string> = {
	engine: "Resolving the engine",
	attach: "Proving a running instance",
	install: "Installing",
	serve: "Starting the engine",
	ready: "Proving readiness",
	stop: "Stopping",
};

const STATE_COLOR: Record<InstanceState, string> = {
	starting: "blue",
	ready: "green",
	stopping: "orange",
	stopped: "gray",
	failed: "red",
};

function stateLabel(instance: ProjectInstance, reviewing: boolean) {
	const stage = instance.stage ? STAGE_LABEL[instance.stage] : undefined;
	switch (instance.state) {
		case "starting":
			return stage ?? "Starting";
		case "ready":
			return instance.origin === "elsewhere"
				? "Running · started outside Connectome"
				: "Running";
		case "stopping":
			return "Stopping";
		case "stopped":
			return reviewing ? "Not installed yet" : "Stopped";
		case "failed":
			return stage ? `Failed · ${stage.toLowerCase()}` : "Failed";
	}
}

/** What removing this project does, said before it is done. */
export function RemovalStatement({ row }: { row: Row }) {
	return (
		<Stack gap="xs">
			{removalStatement(row, displayPath(row.project)).map((sentence) => (
				<Text
					key={sentence}
					style={{ overflowWrap: "anywhere" }}
				>
					{sentence}
				</Text>
			))}
		</Stack>
	);
}

export interface ProjectRowProps {
	row: Row;
	activity: RowActivity | undefined;
	review: Review | undefined;
	canServe: boolean;
	onOpen: () => void;
	onStart: () => void;
	onStop: () => void;
	onDismiss: () => void;
	onRemove: () => void;
	onInstall: () => void;
	onCancelReview: () => void;
}

/**
 * One project. Everything here is decided from this project's own instance and
 * its own action in flight (`rowControls`); its error is shown here and nowhere
 * else.
 */
export function ProjectRow(props: ProjectRowProps) {
	const { row, activity, review } = props;
	const { instance, project } = row;
	const controls = rowControls(instance, activity, review !== undefined);
	const moving = instance.state === "starting" || instance.state === "stopping";
	const act = activity?.action;
	// The row is one named group, so each button is heard with its project.
	const nameId = useId();
	const noteId = useId();
	const note = [controls.limitation, controls.removeBlocked].filter(Boolean).join(" ");
	const removeOff = controls.remove === "disabled" && act !== "removing";
	return (
		<Paper
			withBorder
			p="md"
			role="group"
			aria-labelledby={nameId}
			aria-describedby={controls.limitation ? noteId : undefined}
			data-testid="project-row"
			data-project={row.name}
		>
			<Group
				justify="space-between"
				wrap="nowrap"
				align="flex-start"
			>
				<Text
					id={nameId}
					fw={600}
					style={{ overflowWrap: "anywhere" }}
				>
					{row.name}
				</Text>
				<Badge
					variant="light"
					color={STATE_COLOR[instance.state]}
					leftSection={
						moving ? (
							<Loader
								size={10}
								color={STATE_COLOR[instance.state]}
							/>
						) : undefined
					}
					style={{ flexShrink: 0 }}
				>
					{stateLabel(instance, review !== undefined)}
				</Badge>
			</Group>
			<Text
				size="xs"
				c="dimmed"
				style={{ overflowWrap: "anywhere" }}
			>
				{displayPath(project)}
			</Text>
			<Text
				size="sm"
				mt={4}
				style={{ overflowWrap: "anywhere" }}
			>
				{review
					? "Review the installation below to install and start it."
					: instance.detail}
			</Text>
			{instance.engram?.endpoint_credentials && (
				<Text
					size="sm"
					style={{ overflowWrap: "anywhere" }}
				>
					Endpoint mapping used at startup: {instance.engram.endpoint_credentials}. Stop
					and restart to apply changes.
				</Text>
			)}
			{activity?.error && (
				<Alert
					color="red"
					mt="sm"
					title={`${row.name} could not do that`}
				>
					{activity.error}
				</Alert>
			)}
			{review && (
				<Stack
					mt="sm"
					gap="xs"
				>
					<Text fw={700}>Review your local RRFlow installation</Text>
					{review.selection.endpointCredentialMapping && (
						<Text
							size="sm"
							style={{ overflowWrap: "anywhere" }}
						>
							Endpoint mapping for startup:{" "}
							{review.selection.endpointCredentialMapping}
						</Text>
					)}
					<InstallationSummary preview={review.value.installation} />
				</Stack>
			)}
			<Group mt="sm">
				{review && (
					<>
						<Button
							loading={act === "starting"}
							disabled={act !== undefined && act !== "starting"}
							onClick={props.onInstall}
						>
							Install and open RRFlow
						</Button>
						<Button
							variant="subtle"
							disabled={act !== undefined}
							onClick={props.onCancelReview}
						>
							Cancel
						</Button>
					</>
				)}
				{controls.open !== "hidden" && (
					<Button
						variant="light"
						loading={act === "opening"}
						disabled={controls.open === "disabled" && act !== "opening"}
						onClick={props.onOpen}
					>
						Open project
					</Button>
				)}
				{controls.stop !== "hidden" && (
					<Button
						variant="subtle"
						color="red"
						loading={act === "stopping"}
						disabled={controls.stop === "disabled" && act !== "stopping"}
						onClick={props.onStop}
					>
						Stop this engine
					</Button>
				)}
				{controls.start !== "hidden" && (
					<Button
						variant="light"
						loading={act === "starting"}
						disabled={
							!props.canServe || (controls.start === "disabled" && act !== "starting")
						}
						onClick={props.onStart}
					>
						Start
					</Button>
				)}
				{controls.retry !== "hidden" && (
					<Button
						variant="light"
						loading={act === "starting"}
						disabled={
							!props.canServe || (controls.retry === "disabled" && act !== "starting")
						}
						onClick={props.onStart}
					>
						Try again
					</Button>
				)}
				{controls.dismiss !== "hidden" && (
					<Button
						variant="subtle"
						color="gray"
						disabled={controls.dismiss === "disabled"}
						onClick={props.onDismiss}
					>
						Dismiss
					</Button>
				)}
				{!review && (
					// Unavailable, not `disabled`: it stays reachable by keyboard so
					// the reason it cannot be used yet is read out with it.
					<Button
						variant="subtle"
						color="red"
						loading={act === "removing"}
						data-disabled={removeOff || undefined}
						aria-disabled={removeOff || undefined}
						aria-describedby={controls.removeBlocked ? noteId : undefined}
						onClick={removeOff ? undefined : props.onRemove}
					>
						Remove project
					</Button>
				)}
			</Group>
			{note && (
				<Text
					id={noteId}
					size="sm"
					c="dimmed"
					mt="xs"
				>
					{note}
				</Text>
			)}
		</Paper>
	);
}
