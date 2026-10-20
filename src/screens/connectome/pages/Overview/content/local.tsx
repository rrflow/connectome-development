import { Alert, Button, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { adapter } from "~/adapter";
import { resolveServedConnection } from "~/components/ActionBar/serving";
import { useConnectionNavigator } from "~/hooks/routing";
import { dispatchIntent } from "~/shared/util/intents";
import { useDatabaseStore } from "~/stores/database";

export function LocalStart() {
	const isServing = useDatabaseStore((s) => s.isServing);
	const pending = useDatabaseStore((s) => s.servePending);
	const navigate = useConnectionNavigator();
	const [learn, setLearn] = useState(false);
	const open = async () => {
		if (isServing) {
			const estate = await adapter.servedEstate();
			if (estate) {
				navigate(resolveServedConnection(estate));
				return;
			}
		}
		dispatchIntent("toggle-serving");
	};
	return (
		<Paper
			withBorder
			p="xl"
			radius="md"
			mb="xl"
		>
			<Stack>
				<Text
					size="xl"
					fw={700}
				>
					Your AI data, running locally
				</Text>
				<Text>
					Start RRFlow, explore your data, and learn how records, relationships and
					vectors fit together. Your local database works without a cloud account.
				</Text>
				<Group>
					<Button
						size="md"
						disabled={!adapter.isServeSupported}
						loading={pending}
						onClick={open}
					>
						{isServing ? "Open local RRFlow" : "Start local RRFlow"}
					</Button>
					<Button
						variant="light"
						onClick={() => setLearn(!learn)}
						aria-expanded={learn}
					>
						How RRFlow fits together
					</Button>
				</Group>
				{!adapter.isServeSupported && (
					<Text size="sm">
						Local startup uses the Connectome desktop bundle. This browser view can
						preview the interface and connect to public discovery endpoints.
					</Text>
				)}
				{learn && (
					<>
						<SimpleGrid cols={{ base: 1, sm: 3 }}>
							<Paper
								withBorder
								p="md"
							>
								<Text fw={700}>rrflowDB - Your data</Text>
								<Text size="sm">
									One database for typed records, graph relationships, vectors,
									events, time series and spatial data.
								</Text>
							</Paper>
							<Paper
								withBorder
								p="md"
							>
								<Text fw={700}>rrflowQL - Your questions</Text>
								<Text size="sm">
									Query the engine with explicit time and bounded work. Inspect
									results and their read cursor.
								</Text>
							</Paper>
							<Paper
								withBorder
								p="md"
							>
								<Text fw={700}>rrflowKV - Your persistence</Text>
								<Text size="sm">
									The native Rust storage layer keeps committed data across
									restarts.
								</Text>
							</Paper>
						</SimpleGrid>
						<Alert
							title="Start here"
							color="violet"
						>
							Review the installation, open Data models, select a table, then browse
							its rows. Use Records & relations for connections, Vectors for
							similarity, and Storage engine for persistence evidence. Image, audio
							and video understanding require a separately configured model; storing
							their metadata does not enable inference. PostgreSQL clients and cloud
							sync are not available yet.
						</Alert>
					</>
				)}
			</Stack>
		</Paper>
	);
}
