import { Box, Button, Divider, Modal, Paper, Stack, Text } from "@mantine/core";
import { Icon, iconChevronRight, iconClose } from "@surrealdb/ui";
import { useEffect } from "react";
import { ActionButton } from "~/components/ActionButton";
import { SANDBOX } from "~/constants";
import { useBoolean } from "~/hooks/boolean";
import { useOnboarding } from "~/hooks/onboarding";
import { useConnectionAndView } from "~/hooks/routing";

export function SandboxModal() {
	const [isOpen, openHandle] = useBoolean();
	const [completed, complete] = useOnboarding("sandbox");
	const [connection] = useConnectionAndView();

	useEffect(() => {
		if (connection === SANDBOX && !completed) {
			openHandle.open();
			complete();
		}
	}, [connection, completed]);

	return (
		<Modal
			opened={isOpen}
			onClose={openHandle.close}
			trapFocus={false}
			padding={0}
			size={475}
		>
			<ActionButton
				pos="absolute"
				top={16}
				right={16}
				label="Close"
				onClick={openHandle.close}
			>
				<Icon path={iconClose} />
			</ActionButton>

			<Box
				px={28}
				py={34}
				style={{
					background:
						"radial-gradient(circle at 82% 18%, rgba(102, 217, 255, 0.34), transparent 34%), linear-gradient(135deg, rgba(116, 47, 232, 0.95), rgba(32, 15, 69, 0.95))",
				}}
			>
				<Text
					fz={30}
					fw={750}
					lh={1}
					c="white"
					style={{ letterSpacing: "0.08em" }}
				>
					CONNECTOME
				</Text>
				<Text
					fz="xs"
					fw={650}
					c="white"
					opacity={0.72}
					mt={8}
					style={{ letterSpacing: "0.15em" }}
				>
					OFFLINE RRFLOW SANDBOX
				</Text>
			</Box>

			<Divider />

			<Paper
				p={24}
				withBorder={false}
				radius={0}
			>
				<Stack gap="xl">
					<Text
						c="bright"
						fw={500}
						fz="xl"
					>
						Test RRFlow queries, records, graph paths, and visual models without
						configuring a remote runtime.
					</Text>

					<Text>
						The sandbox runs locally and clears its data when you close Connectome. Use
						the toolbar to reset it or load sample data, then move to a persisted RRFlow
						instance when you are ready.
					</Text>

					<Button
						fullWidth
						variant="gradient"
						onClick={openHandle.close}
						rightSection={<Icon path={iconChevronRight} />}
					>
						Continue
					</Button>
				</Stack>
			</Paper>
		</Modal>
	);
}
