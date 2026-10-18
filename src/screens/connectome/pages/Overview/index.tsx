import {
	Box,
	Button,
	Center,
	Collapse,
	Divider,
	Group,
	Image,
	Indicator,
	Menu,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useInputState } from "@mantine/hooks";
import { MouseEvent, useState } from "react";
import { Link } from "wouter";
import { adapter } from "~/adapter";
import { ActionButton } from "~/components/ActionButton";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { Spacer } from "~/components/Spacer";
import { useConnectionLabels, useConnectionOverview } from "~/hooks/connection";
import { OVERVIEW, useSavepoint } from "~/hooks/overview";
import { useConnectionNavigator } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { iconCheck, iconReset, iconSearch, iconTune } from "~/icons";
import { pictoBrain, pictoHandsOn, pictoUniversity } from "~/pictograms";
import { Connection } from "~/types";
import { StartConnection } from "./content/connection";
import { StartResource } from "./content/resource";
import classes from "./style.module.scss";

const GRID_COLUMNS = {
	xs: 1,
	sm: 2,
	lg: 3,
};

export function OverviewPage() {
	const knownLabels = useConnectionLabels();
	const navigateConnection = useConnectionNavigator();

	const [search, setSearch] = useInputState("");
	const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
	const [labelMode, setLabelMode] = useState<"any" | "all">("any");
	const [labelInclude, setLabelInclude] = useState(true);

	const toggleLabel = (e: MouseEvent, labelToToggle: string) => {
		if (e.ctrlKey || e.metaKey) {
			setSelectedLabels([labelToToggle]);
			return;
		}

		setSelectedLabels((current) =>
			current.includes(labelToToggle)
				? current.filter((label) => label !== labelToToggle)
				: [...current, labelToToggle],
		);
	};

	const { sandbox, userConnections } = useConnectionOverview({
		search,
		labels: selectedLabels,
		labelMode,
		labelInclude,
	});

	const activateConnection = useStable((con: Connection) => {
		navigateConnection(con.id);
	});

	const showConnections = !!sandbox || userConnections.length > 0;

	useSavepoint(OVERVIEW);

	return (
		<Box
			flex={1}
			pos="relative"
		>
			<ScrollArea
				pos="absolute"
				inset={0}
			>
				<Stack
					className={classes.content}
					justify="center"
					maw={1200}
					px="xl"
					mx="auto"
					pb={68}
				>
					<Stack
						align="center"
						gap={0}
						mb={52}
					>
						<Image
							src={pictoBrain}
							w={74}
						/>

						<Text
							className={classes.heroWordmark}
							mt="md"
							fz={32}
							fw={750}
							lh={1}
						>
							CONNECTOME
						</Text>
						<Text
							className={classes.heroSubtitle}
							mt={6}
							fz="xs"
							fw={650}
						>
							NATIVE RRFLOW CONTROL SURFACE
						</Text>

						<Text
							mt="xs"
							opacity={0.4}
							c="bright"
						>
							Version {import.meta.env.VERSION}
						</Text>
					</Stack>

					<Group>
						<PrimaryTitle fz={22}>RRFlow instances</PrimaryTitle>

						<Spacer />

						<Menu closeOnItemClick={false}>
							<Menu.Target>
								<Indicator
									disabled={selectedLabels.length === 0}
									color="violet"
									size={14}
									label={selectedLabels.length}
								>
									<ActionButton
										variant="subtle"
										color="obsidian"
										label="Filter connections"
									>
										<Icon path={iconTune} />
									</ActionButton>
								</Indicator>
							</Menu.Target>
							<Menu.Dropdown miw={220}>
								<Group justify="space-between">
									<Menu.Label py="xs">Labels</Menu.Label>
									{selectedLabels.length > 0 && (
										<ActionButton
											size="sm"
											mr="xs"
											label="Reset filter"
											variant="subtle"
											onClick={() => setSelectedLabels([])}
										>
											<Icon path={iconReset} />
										</ActionButton>
									)}
								</Group>
								{knownLabels.length === 0 && (
									<Text
										maw={200}
										px="sm"
										pb="sm"
									>
										No labels available. Add labels to your connections to
										filter them here.
									</Text>
								)}
								{knownLabels.map((option) => {
									const isActive = selectedLabels.includes(option);

									return (
										<Menu.Item
											key={option}
											onClick={(e) => toggleLabel(e, option)}
											rightSection={isActive && <Icon path={iconCheck} />}
										>
											{option}
										</Menu.Item>
									);
								})}
								<Collapse in={selectedLabels.length > 0}>
									<Menu.Divider />
									<Menu.Label mt="sm">Visibility</Menu.Label>
									<Menu.Item
										onClick={() => setLabelInclude(true)}
										rightSection={labelInclude && <Icon path={iconCheck} />}
									>
										Show matching items
									</Menu.Item>
									<Menu.Item
										onClick={() => setLabelInclude(false)}
										rightSection={!labelInclude && <Icon path={iconCheck} />}
									>
										Hide matching items
									</Menu.Item>

									<Menu.Divider />
									<Menu.Label mt="sm">Method</Menu.Label>
									<Menu.Item
										onClick={() => setLabelMode("any")}
										rightSection={
											labelMode === "any" && <Icon path={iconCheck} />
										}
									>
										Any selected label
									</Menu.Item>
									<Menu.Item
										onClick={() => setLabelMode("all")}
										rightSection={
											labelMode === "all" && <Icon path={iconCheck} />
										}
									>
										All selected labels
									</Menu.Item>
								</Collapse>
							</Menu.Dropdown>
						</Menu>

						<Paper>
							<TextInput
								value={search}
								onChange={setSearch}
								placeholder="Search instances..."
								leftSection={
									<Icon
										path={iconSearch}
										size="sm"
									/>
								}
								flex={1}
								w={182}
								size="xs"
								variant="unstyled"
								styles={{
									input: { backgroundColor: "unset" },
								}}
							/>
						</Paper>
					</Group>

					{!showConnections && (
						<Center mt={52}>
							<Text>No runtime profiles match the provided filters</Text>
						</Center>
					)}

					<Stack
						gap={36}
						mt="sm"
					>
						{showConnections && (
							<Box>
								<Group gap="xl">
									<Box>
										<Text>Runtime profiles</Text>
										<PrimaryTitle
											fz={18}
											lh="h1"
											fw={600}
										>
											Connected brains
										</PrimaryTitle>
									</Box>
									<Divider
										flex={1}
										className={classes.connectionSpacer}
									/>
									<Link href="/connections/create">
										<Button
											size="xs"
											variant="gradient"
										>
											Connect instance
										</Button>
									</Link>
								</Group>

								<SimpleGrid
									cols={GRID_COLUMNS}
									mt="xl"
								>
									{sandbox && (
										<StartConnection
											connection={sandbox}
											onConnect={activateConnection}
										/>
									)}
									{userConnections.map((connection) => (
										<StartConnection
											key={connection.id}
											connection={connection}
											onConnect={activateConnection}
										/>
									))}
								</SimpleGrid>
							</Box>
						)}
					</Stack>

					<PrimaryTitle
						mt={36}
						fz={22}
					>
						Resources
					</PrimaryTitle>

					<SimpleGrid
						cols={{
							xs: 1,
							sm: 2,
						}}
					>
						<StartResource
							title="Runtime protocol"
							subtitle="RRFlow transport and RRFlowQL reference"
							image={pictoBrain}
							onClick={() =>
								adapter.openUrl(
									"https://github.com/rrflow/rrflow-development/tree/main/docs/reference/protocol",
								)
							}
						/>
						<StartResource
							title="Connectome source"
							subtitle="Inspect and evolve the native desktop client"
							image={pictoHandsOn}
							onClick={() =>
								adapter.openUrl("https://github.com/rrflow/connectome-development")
							}
						/>
						<StartResource
							title="RRFlow engine"
							subtitle="Inspect the runtime, storage, and execution kernel"
							image={pictoUniversity}
							onClick={() =>
								adapter.openUrl("https://github.com/rrflow/rrflow-development")
							}
						/>
					</SimpleGrid>
				</Stack>
			</ScrollArea>
		</Box>
	);
}
