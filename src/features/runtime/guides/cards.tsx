import { Button, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { GUIDES, type Guide, useGuides } from "./engine";

function blockedBy(guide: Guide, session: boolean, records: boolean) {
	if (guide.requires.includes("session") && !session) {
		return "Open a session to start this guide.";
	}
	if (guide.requires.includes("records") && !records) {
		return "This project holds no records yet. This guide starts once RRFlow has read it.";
	}
	return null;
}

export interface GuideCardsProps {
	session: boolean;
	records: boolean;
}

/** Guides ready to run on this project. */
export function GuideCards({ session, records }: GuideCardsProps) {
	const guides = useGuides();

	return (
		<Stack gap="xs">
			<Title order={4}>Guides</Title>
			<SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
				{GUIDES.map((guide) => {
					const blocked = blockedBy(guide, session, records);
					return (
						<Paper
							key={guide.id}
							withBorder
							p="md"
						>
							<Stack gap="xs">
								<Text
									fw={650}
									c="bright"
								>
									{guide.title}
								</Text>
								<Text fz="sm">{guide.summary}</Text>
								{blocked && (
									<Text
										fz="sm"
										c="slate"
									>
										{blocked}
									</Text>
								)}
								<Button
									size="xs"
									variant="gradient"
									w="fit-content"
									disabled={Boolean(blocked)}
									onClick={() => guides?.start(guide)}
								>
									Start guide
								</Button>
							</Stack>
						</Paper>
					);
				})}
			</SimpleGrid>
		</Stack>
	);
}
