import {
	Badge,
	Button,
	Group,
	HoverCard,
	Modal,
	Select,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useState } from "react";
import { ActionBar } from "~/components/ActionBar";
import { ActionButton } from "~/components/ActionButton";
import { Form } from "~/components/Form";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { SidebarToggle } from "~/components/SidebarToggle";
import { Spacer } from "~/components/Spacer";
import { useBoolean } from "~/hooks/boolean";
import { useConnection, useIsConnected, useMinimumVersion } from "~/hooks/connection";
import { useDatasets } from "~/hooks/dataset";
import { useDatabaseSchema } from "~/hooks/schema";
import { useStable } from "~/hooks/stable";
import { iconChevronRight, iconReset, iconStar, iconTable } from "~/icons";
import { useRequireDatabase } from "~/modals/require-database";
import { useConfirmation } from "~/providers/Confirmation";
import { useFeatureFlags } from "~/shared/util/feature-flags";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { useInterfaceStore } from "~/shell/stores/interface";
import { useDatabaseStore } from "~/stores/database";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { DatabaseList } from "./components/DatabaseList";
import { NamespaceList } from "./components/NamespaceList";
import { resetConnection } from "./connection/connection";

export function ConnectomeToolbar() {
	const { readChangelog } = useInterfaceStore.getState();
	const { updateConnection } = useConfigStore.getState();
	const [flags] = useFeatureFlags();

	const showChangelog = useInterfaceStore((s) => s.showChangelogAlert);
	const hasReadChangelog = useInterfaceStore((s) => s.hasReadChangelog);
	const isSyncingSchema = useDatabaseStore((s) => s.isSyncingSchema);
	const isConnected = useIsConnected();

	const [id, namespace, database] = useConnection((c) => [
		c?.id,
		c?.lastNamespace,
		c?.lastDatabase,
	]);

	const schema = useDatabaseSchema();
	const noTables = schema.tables.length === 0;
	const noFunctions = schema.functions.length === 0;
	const noParams = schema.params.length === 0;
	const noUsers = schema.users.length === 0;
	const isSchemaEmpty = noTables && noFunctions && noParams && noUsers;

	const [datasetModalOpen, datasetModalOpenHandle] = useBoolean();
	const [editingTab, setEditingTab] = useState<string | null>(null);
	const [tabName, setTabName] = useState("");

	const closeEditingTab = useStable(() => {
		setEditingTab(null);
	});

	const saveTabName = useStable(() => {
		if (!editingTab) return;

		updateConnection({
			id: editingTab,
			name: tabName,
		});

		closeEditingTab();
	});

	const resetSandbox = useConfirmation({
		title: "Reset sandbox environment",
		message:
			"This will clear all data and query responses. Your queries will not be affected. Are you sure you want to continue?",
		skippable: true,
		confirmText: "Reset",
		confirmProps: { variant: "gradient" },
		onConfirm: resetConnection,
	});

	const [applyDataset, isDatasetLoading] = useDatasets();

	const openChangelog = useStable(() => {
		dispatchIntent("open-changelog");
		readChangelog();
	});

	const [isSupported, version] = useMinimumVersion(import.meta.env.RRFLOW_ENGINE_VERSION);
	const isSandbox = id === "sandbox";
	const showNS = !isSandbox && id && isConnected;
	const showDB = showNS && namespace;

	const selectDataset = useRequireDatabase(() => datasetModalOpenHandle.open());

	return (
		<>
			<SidebarToggle />

			<ConnectionStatus />

			{showNS && (
				<>
					<Icon
						path={iconChevronRight}
						size="lg"
						color="obsidian.5"
						mx={-8}
					/>

					<NamespaceList />
				</>
			)}

			{showDB && (
				<>
					<Icon
						path={iconChevronRight}
						size="lg"
						color="obsidian.5"
						mx={-8}
					/>

					<DatabaseList />
				</>
			)}

			{isConnected && isSandbox && (
				<ActionButton
					color="obsidian"
					variant="subtle"
					label="Reset sandbox environment"
					onClick={resetSandbox}
				>
					<Icon path={iconReset} />
				</ActionButton>
			)}

			{isConnected && isSchemaEmpty && namespace && database && !isSyncingSchema && (
				<Button
					size="xs"
					variant="light"
					loading={isDatasetLoading}
					onClick={selectDataset}
					leftSection={<Icon path={iconTable} />}
				>
					Import sample data
				</Button>
			)}

			{isConnected && !isSupported && (
				<HoverCard>
					<HoverCard.Target>
						<Badge
							variant="light"
							color="orange"
							h={28}
						>
							Unsupported database version
						</Badge>
					</HoverCard.Target>
					<HoverCard.Dropdown>
						<Text>
							We recommend using at least{" "}
							<Text
								span
								c="bright"
							>
								RRFlow {import.meta.env.RRFLOW_ENGINE_VERSION}
							</Text>
						</Text>
						<Text>
							The current version is{" "}
							<Text
								span
								c="bright"
							>
								RRFlow {version}
							</Text>
						</Text>
					</HoverCard.Dropdown>
				</HoverCard>
			)}

			<Spacer />

			{(flags.changelog === "auto" ? showChangelog : flags.changelog !== "hidden") && (
				<Button
					h={34}
					size="xs"
					variant={
						(flags.changelog === "auto" ? hasReadChangelog : flags.changelog === "read")
							? "light"
							: "gradient"
					}
					style={{ border: "none" }}
					onClick={openChangelog}
					leftSection={
						<Icon
							path={iconStar}
							size="lg"
						/>
					}
				>
					See what's new in {import.meta.env.VERSION}
				</Button>
			)}

			<ActionBar />

			<Modal
				opened={!!editingTab}
				onClose={closeEditingTab}
			>
				<Form onSubmit={saveTabName}>
					<Group>
						<TextInput
							style={{ flex: 1 }}
							placeholder="Enter tab name"
							value={tabName}
							spellCheck={false}
							onChange={(e) => setTabName(e.target.value)}
							autoFocus
							onFocus={(e) => e.target.select()}
						/>
						<Button type="submit">Rename</Button>
					</Group>
				</Form>
			</Modal>

			<Modal
				opened={datasetModalOpen}
				onClose={datasetModalOpenHandle.close}
				title={
					<Group>
						<Icon
							path={iconTable}
							size="lg"
						/>
						<PrimaryTitle>Import sample data</PrimaryTitle>
					</Group>
				}
			>
				<Stack gap="xl">
					<Text>
						Initialize your empty database with an official sample dataset to provide a
						starting point for your project.
					</Text>

					<Select
						placeholder="Select a dataset"
						value="rrflow-deal-store-mini"
						data={[
							{
								label: "RRFlow Deal Store (Mini)",
								value: "rrflow-deal-store-mini",
							},
						]}
					/>

					<Group>
						<Button
							onClick={datasetModalOpenHandle.close}
							color="obsidian"
							variant="light"
							flex={1}
						>
							Close
						</Button>
						<Button
							type="submit"
							variant="gradient"
							flex={1}
							onClick={async () => {
								await applyDataset(version);
								datasetModalOpenHandle.close();
							}}
							loading={isDatasetLoading}
						>
							Apply
						</Button>
					</Group>
				</Stack>
			</Modal>
		</>
	);
}
