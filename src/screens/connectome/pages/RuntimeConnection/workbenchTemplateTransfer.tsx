import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useLayoutEffect, useRef, useState } from "react";
import { adapter } from "~/adapter";
import { JSON_FILTER } from "~/constants";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import { normalizeWorkbenchState } from "./workbenchState";
import { exportWorkbenchTemplates, importWorkbenchTemplates } from "./workbenchTemplateInterchange";

export function WorkbenchTemplateTransfer({ connectionId }: { connectionId: string }) {
	const alive = useRef(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const templateCount = useConfigStore(
		(state) =>
			state.connections.find((connection) => connection.id === connectionId)?.workbench
				?.templates?.length ?? 0,
	);

	useLayoutEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const run = async (operation: "import" | "export") => {
		setBusy(true);
		setError(null);
		setMessage(null);
		try {
			if (operation === "import") {
				const [file] = await adapter.openFile(
					"Import workbench templates",
					[JSON_FILTER],
					false,
				);
				if (!file) {
					if (alive.current) setMessage("Template import cancelled.");
					return;
				}
				const parsed: unknown = JSON.parse(await file.text());
				if (!alive.current) return;
				const imported = importWorkbenchTemplates(parsed, newId);
				const store = useConfigStore.getState();
				const connection = store.connections.find(
					(candidate) => candidate.id === connectionId,
				);
				if (!connection) throw new Error("Project profile is no longer available.");
				const workbench = normalizeWorkbenchState(connection.workbench, newId);
				store.updateConnection({
					id: connectionId,
					workbench: { ...workbench, templates: [...imported, ...workbench.templates] },
				});
				setMessage(
					`Imported ${imported.length} template${imported.length === 1 ? "" : "s"}.`,
				);
			} else {
				const connection = useConfigStore
					.getState()
					.connections.find((candidate) => candidate.id === connectionId);
				if (!connection) throw new Error("Project profile is no longer available.");
				const templates = normalizeWorkbenchState(connection.workbench, newId).templates;
				if (templates.length === 0)
					throw new Error("No saved templates are available to export.");
				const contents = JSON.stringify(
					exportWorkbenchTemplates(templates, Date.now()),
					null,
					2,
				);
				const saved = await adapter.saveFile(
					"Export workbench templates",
					`rrflow-workbench-templates-${connectionId}.json`,
					[JSON_FILTER],
					() => contents,
				);
				if (alive.current)
					setMessage(saved ? "Template export requested." : "Template export cancelled.");
			}
		} catch (cause) {
			if (!alive.current) return;
			if (cause instanceof DOMException && cause.name === "AbortError") {
				setMessage(`Template ${operation} cancelled.`);
			} else {
				setError(cause instanceof Error ? cause.message : String(cause));
			}
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack>
				<Title order={4}>Template import and export</Title>
				<Text size="sm">
					Transfer saved templates as JSON. Linked path references are retained, but a
					reference may need to be configured in the destination profile.
				</Text>
				<Group>
					<Button
						variant="light"
						disabled={busy}
						onClick={() => void run("import")}
					>
						Import templates
					</Button>
					<Button
						variant="light"
						disabled={busy || templateCount === 0}
						onClick={() => void run("export")}
					>
						Export templates
					</Button>
				</Group>
				{message && <Text size="sm">{message}</Text>}
				{error && (
					<Alert
						color="red"
						title="Template transfer failed"
					>
						{error}
					</Alert>
				)}
			</Stack>
		</Paper>
	);
}
