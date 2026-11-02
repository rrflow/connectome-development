import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

export function ProjectOverview({
	connected,
	onOpen,
}: {
	connected: boolean;
	onOpen: (route: string) => void;
}) {
	return (
		<Stack>
			<Paper
				withBorder
				p="lg"
			>
				<Title order={3}>Your project's reasoning workspace</Title>
				<Text mt="sm">
					Inspect records in rrflowDB, follow their relationships through rrflowQL,
					compare vectors, and inspect rrflowKV storage. These are views of one project
					estate, not independent copies of its knowledge.
				</Text>
				<Text mt="sm">
					Running another project in parallel does not share its records, credentials, or
					context. Context sharing needs an explicit engine contract and authorization.
				</Text>
			</Paper>
			<Group>
				<Button
					variant="light"
					onClick={() => onOpen("knowledge/records")}
				>
					Explore project knowledge
				</Button>
			</Group>
			{!connected && (
				<Alert title="Project data requires a native session">
					The public handshake identifies the engine. Open this project in the desktop app
					with its operator credential to inspect authenticated data.
				</Alert>
			)}
		</Stack>
	);
}
