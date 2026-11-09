import {
	Alert,
	Badge,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type {
	WorkbenchLinkedPath,
	WorkbenchRemoteSource,
	WorkbenchRemoteSourceMode,
	WorkbenchRemoteSourceProvider,
} from "~/types";

export function WorkbenchLinkedCloudPanel({
	connectionAvailable,
	linkLabelDraft,
	onChangeLinkLabelDraft,
	onAddLinkedFile,
	onAddLinkedFolder,
	onRefreshLinks,
	linkError,
	linkedPaths,
	formatWhen,
	onReconnectLinkedPath,
	onRemoveLinkedPath,
	remoteSourceProvider,
	remoteSourceProviderOptions,
	onChangeRemoteSourceProvider,
	remoteSourceMode,
	remoteSourceModeOptions,
	onChangeRemoteSourceMode,
	remoteSourceLabel,
	onChangeRemoteSourceLabel,
	remoteSourceUrl,
	onChangeRemoteSourceUrl,
	remoteSourceNote,
	onChangeRemoteSourceNote,
	remoteSourceError,
	onAddRemoteSource,
	remoteSources,
	onLoadDocIntoWorkspace,
	onRemoveRemoteSource,
	docWorkspaceBusy,
	docWorkspaceTitle,
	onChangeDocWorkspaceTitle,
	docWorkspaceContent,
	onChangeDocWorkspaceContent,
	docWorkspaceError,
	onCopyDocWorkspace,
	onSaveDocWorkspaceToLinkedFolder,
	canSaveDocWorkspaceToLinkedFolder,
	selectedDocSourceId,
}: {
	connectionAvailable: boolean;
	linkLabelDraft: string;
	onChangeLinkLabelDraft: (value: string) => void;
	onAddLinkedFile: () => void;
	onAddLinkedFolder: () => void;
	onRefreshLinks: () => void;
	linkError: string | null;
	linkedPaths: WorkbenchLinkedPath[];
	formatWhen: (unixMs?: number) => string;
	onReconnectLinkedPath: (linkedPathId: string) => void;
	onRemoveLinkedPath: (linkedPathId: string) => void;
	remoteSourceProvider: WorkbenchRemoteSourceProvider;
	remoteSourceProviderOptions: { value: WorkbenchRemoteSourceProvider; label: string }[];
	onChangeRemoteSourceProvider: (next: WorkbenchRemoteSourceProvider) => void;
	remoteSourceMode: WorkbenchRemoteSourceMode;
	remoteSourceModeOptions: { value: WorkbenchRemoteSourceMode; label: string }[];
	onChangeRemoteSourceMode: (next: WorkbenchRemoteSourceMode) => void;
	remoteSourceLabel: string;
	onChangeRemoteSourceLabel: (value: string) => void;
	remoteSourceUrl: string;
	onChangeRemoteSourceUrl: (value: string) => void;
	remoteSourceNote: string;
	onChangeRemoteSourceNote: (value: string) => void;
	remoteSourceError: string | null;
	onAddRemoteSource: () => void;
	remoteSources: WorkbenchRemoteSource[];
	onLoadDocIntoWorkspace: (source: WorkbenchRemoteSource) => void;
	onRemoveRemoteSource: (sourceId: string) => void;
	docWorkspaceBusy: boolean;
	docWorkspaceTitle: string;
	onChangeDocWorkspaceTitle: (value: string) => void;
	docWorkspaceContent: string;
	onChangeDocWorkspaceContent: (value: string) => void;
	docWorkspaceError: string | null;
	onCopyDocWorkspace: () => void;
	onSaveDocWorkspaceToLinkedFolder: () => void;
	canSaveDocWorkspaceToLinkedFolder: boolean;
	selectedDocSourceId: string | null;
}) {
	return (
		<Paper
			withBorder
			p="lg"
		>
			<Stack>
				<Title order={4}>Linked external files and folders</Title>
				<Text size="sm">
					Link external datasets once, then let Workbench auto-check availability and
					reconnect paths when a drive disconnects.
				</Text>
				<TextInput
					label="Link label (optional)"
					placeholder="USB benchmark pack"
					value={linkLabelDraft}
					onChange={(event) => onChangeLinkLabelDraft(event.currentTarget.value)}
				/>
				<Group>
					<Button
						variant="light"
						onClick={onAddLinkedFile}
						disabled={!connectionAvailable}
					>
						Link file
					</Button>
					<Button
						variant="light"
						onClick={onAddLinkedFolder}
						disabled={!connectionAvailable}
					>
						Link folder
					</Button>
					<Button
						variant="subtle"
						onClick={onRefreshLinks}
						disabled={!connectionAvailable}
					>
						Refresh links
					</Button>
				</Group>
				{linkError && (
					<Alert
						color="red"
						title="External path link failed"
					>
						{linkError}
					</Alert>
				)}
				{linkedPaths.length === 0 && (
					<Text
						size="sm"
						c="slate"
					>
						No external links yet.
					</Text>
				)}
				{linkedPaths.map((entry) => (
					<Paper
						key={entry.id}
						withBorder
						p="sm"
					>
						<Stack gap="xs">
							<Group justify="space-between">
								<Text fw={650}>{entry.label}</Text>
								<Badge
									color={
										entry.status === "available"
											? "green"
											: entry.status === "missing"
												? "red"
												: "gray"
									}
									variant="light"
								>
									{entry.status}
								</Badge>
							</Group>
							<Text
								size="xs"
								ff="monospace"
							>
								{entry.path}
							</Text>
							<Text
								size="xs"
								c="slate"
							>
								Last checked: {formatWhen(entry.lastCheckedAtUnixMs)} · Last
								connected: {formatWhen(entry.lastConnectedAtUnixMs)}
							</Text>
							{entry.message && (
								<Text
									size="xs"
									c="orange"
								>
									{entry.message}
								</Text>
							)}
							<Group>
								{entry.status !== "available" && (
									<Button
										size="xs"
										variant="light"
										onClick={() => onReconnectLinkedPath(entry.id)}
									>
										Reconnect
									</Button>
								)}
								<Button
									size="xs"
									variant="subtle"
									color="red"
									onClick={() => onRemoveLinkedPath(entry.id)}
								>
									Remove link
								</Button>
							</Group>
						</Stack>
					</Paper>
				))}
				<Title order={5}>Cloud sources foundation</Title>
				<Text size="sm">
					Register Google Drive and Google Docs relay sources for import, RAG, and test
					dataset generation with minimal setup.
				</Text>
				<Group grow>
					<Select
						label="Provider"
						value={remoteSourceProvider}
						data={remoteSourceProviderOptions}
						onChange={(next) =>
							onChangeRemoteSourceProvider(
								(next as WorkbenchRemoteSourceProvider | null) ?? "google-drive",
							)
						}
					/>
					<Select
						label="Usage mode"
						value={remoteSourceMode}
						data={remoteSourceModeOptions}
						onChange={(next) =>
							onChangeRemoteSourceMode(
								(next as WorkbenchRemoteSourceMode | null) ?? "import",
							)
						}
					/>
				</Group>
				<TextInput
					label="Label (optional)"
					placeholder="Drive benchmark corpus"
					value={remoteSourceLabel}
					onChange={(event) => onChangeRemoteSourceLabel(event.currentTarget.value)}
				/>
				<TextInput
					label="Source URL"
					placeholder={
						remoteSourceProvider === "google-docs-relay"
							? "https://docs.google.com/document/d/<id>/edit"
							: "https://drive.google.com/drive/folders/<id>"
					}
					value={remoteSourceUrl}
					onChange={(event) => onChangeRemoteSourceUrl(event.currentTarget.value)}
				/>
				<Textarea
					label="Notes (optional)"
					minRows={2}
					value={remoteSourceNote}
					onChange={(event) => onChangeRemoteSourceNote(event.currentTarget.value)}
				/>
				{remoteSourceError && (
					<Alert
						color="red"
						title="Cloud source setup failed"
					>
						{remoteSourceError}
					</Alert>
				)}
				<Group justify="flex-end">
					<Button
						size="xs"
						variant="light"
						onClick={onAddRemoteSource}
						disabled={remoteSourceUrl.trim().length === 0}
					>
						Add cloud source
					</Button>
				</Group>
				{remoteSources.length === 0 && (
					<Text
						size="sm"
						c="slate"
					>
						No cloud sources configured yet.
					</Text>
				)}
				{remoteSources.map((source) => (
					<Paper
						key={source.id}
						withBorder
						p="xs"
					>
						<Stack gap="xs">
							<Group justify="space-between">
								<Text fw={650}>{source.label}</Text>
								<Badge variant="light">
									{source.provider} · {source.mode}
								</Badge>
							</Group>
							<Text
								size="xs"
								ff="monospace"
							>
								{source.url}
							</Text>
							{source.relayUrl && (
								<Text
									size="xs"
									ff="monospace"
								>
									relay={source.relayUrl}
								</Text>
							)}
							{source.note && (
								<Text
									size="xs"
									c="slate"
								>
									{source.note}
								</Text>
							)}
							<Group>
								<Button
									size="xs"
									variant="subtle"
									onClick={() =>
										window.open(source.relayUrl ?? source.url, "_blank")
									}
								>
									Open source
								</Button>
								{(source.provider === "google-docs-relay" || source.relayUrl) && (
									<Button
										size="xs"
										variant="subtle"
										onClick={() => onLoadDocIntoWorkspace(source)}
										loading={docWorkspaceBusy}
									>
										Load doc
									</Button>
								)}
								<Button
									size="xs"
									variant="subtle"
									color="red"
									onClick={() => onRemoveRemoteSource(source.id)}
								>
									Remove
								</Button>
							</Group>
						</Stack>
					</Paper>
				))}
				<Paper
					withBorder
					p="sm"
				>
					<Stack>
						<Title order={6}>Doc workspace (pull/edit/copy/save)</Title>
						<Text size="xs">
							Use this to relay a Google Doc into Workbench, edit it for dataset prep,
							then copy or save into a linked folder.
						</Text>
						<TextInput
							label="Title"
							value={docWorkspaceTitle}
							onChange={(event) =>
								onChangeDocWorkspaceTitle(event.currentTarget.value)
							}
						/>
						<Textarea
							label="Content"
							minRows={8}
							value={docWorkspaceContent}
							onChange={(event) =>
								onChangeDocWorkspaceContent(event.currentTarget.value)
							}
						/>
						{docWorkspaceError && (
							<Alert
								color="red"
								title="Doc workspace error"
							>
								{docWorkspaceError}
							</Alert>
						)}
						<Group>
							<Button
								size="xs"
								variant="light"
								onClick={onCopyDocWorkspace}
								disabled={docWorkspaceContent.length === 0}
							>
								Copy text
							</Button>
							<Button
								size="xs"
								variant="light"
								onClick={onSaveDocWorkspaceToLinkedFolder}
								disabled={!canSaveDocWorkspaceToLinkedFolder}
							>
								Save to linked folder
							</Button>
							{selectedDocSourceId && <Badge variant="light">source linked</Badge>}
						</Group>
					</Stack>
				</Paper>
			</Stack>
		</Paper>
	);
}
