import {
	Alert,
	Badge,
	Button,
	Group,
	Modal,
	Paper,
	ScrollArea,
	Select,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { adapter } from "~/adapter";
import { ActionButton } from "~/components/ActionButton";
import { Icon } from "~/components/Icon";
import { useConnectionNavigator, useIntent } from "~/hooks/routing";
import { iconPlay } from "~/icons";
import { describeRrdError } from "~/rrflow/runtime";
import { RrdSessionClient } from "~/rrflow/session";
import { sessionQueryKey } from "~/screens/connectome/pages/RuntimeConnection/session";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import type { engramPreview, engramSelection, Servedengram } from "~/types";
import { resolveServedConnection } from "./served-connection";

export function DatabaseServing() {
	const [opened, setOpened] = useState(false);
	const [selection, setSelection] = useState<engramSelection>(() => ({
		...useConfigStore.getState().settings.serving,
	}));
	const [preview, setPreview] = useState<{
		value: engramPreview;
		selection: engramSelection;
	} | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const navigate = useConnectionNavigator();
	const engrams = useQuery({
		queryKey: ["owned-project-engines"],
		queryFn: () => adapter.servedengrams(),
		enabled: adapter.isServeSupported,
		refetchInterval: opened ? 3000 : false,
	});
	useEffect(() => {
		if (engrams.data?.[0]) useDatabaseStore.getState().confirmServing(engrams.data[0]);
		else if (engrams.data) useDatabaseStore.getState().stopServing();
	}, [engrams.data]);
	useIntent("toggle-serving", () => setOpened(true));
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["owned-project-engines"] });
	const run = async (action: () => Promise<void>) => {
		setPending(true);
		setError(null);
		try {
			await action();
		} catch (cause) {
			setError(describeRrdError(cause));
		} finally {
			setPending(false);
			await refresh();
		}
	};
	const start = async (request: engramSelection, digest?: string) => {
		const engram = await adapter.serveengram(digest, request);
		setPreview(null);
		useDatabaseStore.getState().confirmServing(engram);
		navigate(resolveServedConnection(engram));
		setOpened(false);
	};
	const prepare = () =>
		run(async () => {
			const request = { ...selection };
			const value = await adapter.previewengram(request);
			// Freeze the resolved directory, mode and executable with the preview.
			const resolved = { ...request, project: value.project };
			if (value.installation) setPreview({ value, selection: resolved });
			else await start(resolved);
		});
	const stop = (engram: Servedengram) =>
		run(async () => {
			const profiles = useConfigStore
				.getState()
				.connections.filter(
					(c) =>
						c.target === "runtime" &&
						c.runtimeCredential === engram.credential_path &&
						`${c.authentication.protocol}://${c.authentication.hostname}` ===
							engram.endpoint,
				);
			for (const profile of profiles) {
				await new RrdSessionClient(profile.id).disconnect();
				queryClient.setQueryData(sessionQueryKey(profile.id), null);
			}
			await adapter.stopengram(engram.project);
		});
	return (
		<>
			<ActionButton
				label="Manage project engines"
				aria-label="Manage project engines"
				variant="subtle"
				onClick={() => setOpened(true)}
			>
				<Icon path={iconPlay} />
			</ActionButton>
			<Modal
				opened={opened}
				onClose={() => {
					if (!pending) {
						setOpened(false);
						setPreview(null);
					}
				}}
				title="Project engines"
				size="xl"
				closeOnEscape={!pending}
				closeOnClickOutside={!pending}
			>
				<Stack>
					<Text>
						Run independent RRFlow engines for your projects. Opening or running
						projects together does not share their context.
					</Text>
					<Badge variant="light">
						Up to 4 local engines · 8 authenticated connections
					</Badge>
					<Text size="sm">
						Each engine uses its configured resources. This desktop limit does not
						reserve combined CPU or memory for your machine.
					</Text>
					{(error || engrams.error) && (
						<Alert
							color="red"
							title="Project operation failed"
						>
							{error ?? describeRrdError(engrams.error)}
						</Alert>
					)}
					{engrams.data?.map((engram) => (
						<Paper
							key={engram.project}
							withBorder
							p="md"
						>
							<Text
								fw={600}
								style={{ overflowWrap: "anywhere" }}
							>
								{engram.project}
							</Text>
							<Text size="sm">Running · {engram.endpoint}</Text>
							<Group mt="sm">
								<Button
									variant="light"
									disabled={pending}
									onClick={() => {
										navigate(resolveServedConnection(engram));
										setOpened(false);
									}}
								>
									Open project
								</Button>
								<Button
									variant="subtle"
									color="red"
									disabled={pending}
									onClick={() => stop(engram)}
								>
									Stop this engine
								</Button>
							</Group>
						</Paper>
					))}
					{engrams.data?.length === 0 && (
						<Text c="dimmed">No local project engines are running.</Text>
					)}
					{preview ? (
						<>
							<Text fw={700}>Review your local RRFlow installation</Text>
							<Text style={{ overflowWrap: "anywhere" }}>
								{preview.value.project}
							</Text>
							<Alert title="Exact installation preview">
								Review the paths, permissions and configuration. Installing creates
								project-local data and credentials. It enables no cloud upload or
								training.
							</Alert>
							<ScrollArea h={260}>
								<pre
									style={{
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										fontSize: 12,
									}}
								>
									{JSON.stringify(preview.value.installation, null, 2)}
								</pre>
							</ScrollArea>
							<Group>
								<Button
									variant="subtle"
									disabled={pending}
									onClick={() => setPreview(null)}
								>
									Cancel
								</Button>
								<Button
									loading={pending}
									onClick={() =>
										run(() =>
											start(
												preview.selection,
												preview.value.installation?.installation
													.plan_sha256,
											),
										)
									}
								>
									Install and open RRFlow
								</Button>
							</Group>
						</>
					) : (
						<>
							<Text fw={700}>Open another project</Text>
							<Group align="end">
								<TextInput
									flex={1}
									label="Project directory"
									description="An absolute project folder; leave empty for Connectome's local engram."
									value={selection.project}
									disabled={pending}
									onChange={(e) =>
										setSelection({
											...selection,
											project: e.currentTarget.value,
										})
									}
								/>
								<Button
									variant="light"
									disabled={!adapter.isServeSupported || pending}
									onClick={() =>
										run(async () => {
											const path = await open({
												directory: true,
												multiple: false,
											});
											if (typeof path === "string")
												setSelection({ ...selection, project: path });
										})
									}
								>
									Choose folder
								</Button>
							</Group>
							<Select
								label="Project mode"
								value={selection.mode}
								disabled={pending}
								data={[
									{ value: "fresh", label: "Fresh project" },
									{ value: "existing", label: "Existing project" },
								]}
								onChange={(mode) => {
									if (mode === "fresh" || mode === "existing")
										setSelection({ ...selection, mode });
								}}
							/>
							<Button
								loading={pending}
								disabled={
									!adapter.isServeSupported || (engrams.data?.length ?? 0) >= 4
								}
								onClick={prepare}
							>
								Preview or open project
							</Button>
						</>
					)}
					{!adapter.isServeSupported && (
						<Text size="sm">Starting local processes requires the desktop app.</Text>
					)}
				</Stack>
			</Modal>
		</>
	);
}
