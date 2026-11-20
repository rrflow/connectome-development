import { Alert, Button, Code, Text } from "@mantine/core";
import type { TaskReply } from "~/rrflow/tasks";

export function ControllerReview({
	prepared,
	disabled,
	onPropose,
}: {
	prepared: Extract<TaskReply, { kind: "prepared" }>;
	disabled: boolean;
	onPropose: () => void;
}) {
	return (
		<>
			<Text>Controller: {prepared.controller ?? "Not configured"}</Text>
			<Text>
				Configured protocol:{" "}
				{prepared.controller_protocol === "system_one"
					? "System One ? typed choice"
					: prepared.controller_protocol === "chat_completions"
						? "Chat completions ? structured choice"
						: "Not configured"}
			</Text>
			<Text
				size="sm"
				c="dimmed"
			>
				This is the engine configuration. A recorded proposal shows whether the controller
				participated.
			</Text>
			<Text>Configured candidates: {prepared.candidates.join(", ") || "None"}</Text>
			<Text>Task: {prepared.task.title}</Text>
			<Text>{prepared.task.goal}</Text>
			<Code
				block
			>{`Task digest: ${prepared.task_sha256}\nConfiguration digest: ${prepared.configuration_sha256}`}</Code>
			{prepared.unavailable ? (
				<Alert color="orange">{prepared.unavailable}</Alert>
			) : (
				<Text>
					Native request timeout: {prepared.wait_timeout_ms} ms. Requesting sends this
					task to the configured controller under the engine policy.
				</Text>
			)}
			<Button
				disabled={disabled}
				onClick={onPropose}
			>
				Request one experimental proposal
			</Button>
		</>
	);
}
