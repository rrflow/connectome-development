import { Alert, Box, Button, Divider, Image, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { adapter } from "~/adapter";
import { Link } from "~/components/Link";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { Scaffold } from "~/components/Scaffold";
import { TopGlow } from "~/components/TopGlow";
import { JSON_FILTER } from "~/constants";
import { useStable } from "~/hooks/stable";
import { useIsLight, useThemeImage } from "~/hooks/theme";
import logoDarkUrl from "~/shared/assets/images/dark/logo.webp";
import logoLightUrl from "~/shared/assets/images/light/logo.webp";
import { backupConfig } from "~/shared/util/config";
import { Icon, iconArrowUpRight, iconDownload, pictoBrain } from "../../rrflow/ui/index";

export function NewDomainScreen() {
	const isLight = useIsLight();
	const [targetLink, setTargetLink] = useState("https://github.com/EonsofStupid/connectome");

	const saveBackup = useStable(() => {
		setTargetLink("https://github.com/EonsofStupid/connectome");
		adapter.saveFile(
			"Save config backup",
			"Connectome-backup.json",
			[JSON_FILTER],
			async () => {
				return backupConfig({
					stripSensitive: false,
					connections: [],
				});
			},
		);
	});

	const logoUrl = useThemeImage({
		light: logoLightUrl,
		dark: logoDarkUrl,
	});

	return (
		<Scaffold>
			<Box
				h="100vh"
				bg={`var(--mantine-color-obsidian-${isLight ? 0 : 9})`}
			>
				<TopGlow />
				<Box
					pt={68}
					pos="relative"
				>
					<Stack
						align="center"
						gap={0}
					>
						<Image
							src={pictoBrain}
							w={85}
						/>

						<Image
							src={logoUrl}
							w={225}
							mt="md"
						/>
					</Stack>
					<Paper
						p="xl"
						mt={38}
						maw={500}
						mx="auto"
					>
						<Stack gap="xl">
							<PrimaryTitle fz={32}>Connectome has moved!</PrimaryTitle>
							<Text fz="lg">
								We've moved to{" "}
								<Link
									inherit
									href="https://github.com/EonsofStupid/connectome"
								>
									127.0.0.1:8000
								</Link>{" "}
								as part of our ongoing efforts to improve Connectome and consolidate
								our products into a single, unified platform.
							</Text>
							<Divider />
							<Alert
								color="orange"
								title="Export your web configuration"
							>
								You can export your current web app configuration and import it into
								127.0.0.1:8000 to keep your existing connections, queries, and other
								settings.
							</Alert>
							<SimpleGrid cols={2}>
								<Button
									rightSection={<Icon path={iconDownload} />}
									variant="light"
									color="obsidian"
									onClick={saveBackup}
								>
									Export config
								</Button>
								<a href={targetLink}>
									<Button
										rightSection={<Icon path={iconArrowUpRight} />}
										variant="gradient"
										fullWidth
										flex={1}
									>
										Go to 127.0.0.1:8000
									</Button>
								</a>
							</SimpleGrid>
						</Stack>
					</Paper>
				</Box>
			</Box>
		</Scaffold>
	);
}
