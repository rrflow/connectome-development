import { Alert, Stack, Text } from "@mantine/core";
import { useLayoutEffect, useRef, useState } from "react";
import { adapter } from "~/adapter";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type {
	WorkbenchRemoteSource,
	WorkbenchRemoteSourceMode,
	WorkbenchRemoteSourceProvider,
} from "~/types";
import { formatTime } from "./format";
import { WorkbenchLinkedCloudPanel } from "./workbenchLinkedCloudPanel";
import { normalizeWorkbenchState } from "./workbenchState";

const providers: { value: WorkbenchRemoteSourceProvider; label: string }[] = [
	{ value: "google-drive", label: "Google Drive" },
	{ value: "google-docs-relay", label: "Google Docs relay" },
];
const modes: { value: WorkbenchRemoteSourceMode; label: string }[] = [
	{ value: "import", label: "Import files" },
	{ value: "rag", label: "RAG source" },
	{ value: "tests", label: "Tests and workloads" },
	{ value: "mixed", label: "Mixed usage" },
];

function sourceUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("Provide a valid HTTPS source URL.");
	}
	if (url.protocol !== "https:" || url.username || url.password) {
		throw new Error("Source URLs must use HTTPS and cannot contain credentials.");
	}
	return url;
}

export function WorkbenchSources({ connectionId }: { connectionId: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((item) => item.id === connectionId),
	);
	const profile = normalizeWorkbenchState(connection?.workbench, newId);
	const [provider, setProvider] = useState<WorkbenchRemoteSourceProvider>("google-drive");
	const [mode, setMode] = useState<WorkbenchRemoteSourceMode>("import");
	const [label, setLabel] = useState("");
	const [url, setUrl] = useState("");
	const [note, setNote] = useState("");
	const [sourceError, setSourceError] = useState<string | null>(null);
	const [linkError, setLinkError] = useState<string | null>(null);
	const [docTitle, setDocTitle] = useState("");
	const [docContent, setDocContent] = useState("");
	const [docError, setDocError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const alive = useRef(false);
	useLayoutEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const update = (
		change: (
			current: ReturnType<typeof normalizeWorkbenchState>,
		) => ReturnType<typeof normalizeWorkbenchState>,
	) => {
		const store = useConfigStore.getState();
		const current = store.connections.find((item) => item.id === connectionId);
		if (!current) throw new Error("Project profile is no longer available.");
		store.updateConnection({
			id: connectionId,
			workbench: change(normalizeWorkbenchState(current.workbench, newId)),
		});
	};

	const addSource = () => {
		try {
			const parsed = sourceUrl(url.trim());
			let relayUrl: string | undefined;
			if (provider === "google-docs-relay") {
				const match = parsed.pathname.match(/^\/document\/d\/([^/]+)(?:\/|$)/);
				if (parsed.hostname !== "docs.google.com" || !match) {
					throw new Error("Provide a Google Docs document URL.");
				}
				relayUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
			}
			const now = Date.now();
			const source: WorkbenchRemoteSource = {
				id: newId(),
				provider,
				mode,
				label: label.trim() || parsed.hostname,
				url: parsed.href,
				relayUrl,
				note: note.trim() || undefined,
				status: "needs-auth",
				createdAtUnixMs: now,
				updatedAtUnixMs: now,
			};
			update((current) => ({
				...current,
				remoteSources: [source, ...(current.remoteSources ?? [])],
			}));
			setLabel("");
			setUrl("");
			setNote("");
			setSourceError(null);
		} catch (error) {
			setSourceError(error instanceof Error ? error.message : String(error));
		}
	};

	const removeSource = (id: string) => {
		try {
			update((current) => {
				if (!current.remoteSources?.some((source) => source.id === id))
					throw new Error("The source is no longer available.");
				return {
					...current,
					remoteSources: current.remoteSources.filter((source) => source.id !== id),
				};
			});
			setSourceError(null);
		} catch (error) {
			setSourceError(error instanceof Error ? error.message : String(error));
		}
	};

	const removeLink = (id: string) => {
		try {
			update((current) => {
				if (!current.linkedPaths.some((path) => path.id === id))
					throw new Error("The link is no longer available.");
				return {
					...current,
					linkedPaths: current.linkedPaths.filter((path) => path.id !== id),
				};
			});
			setLinkError(null);
		} catch (error) {
			setLinkError(error instanceof Error ? error.message : String(error));
		}
	};

	const openSource = async (source: WorkbenchRemoteSource) => {
		try {
			await adapter.openUrl(sourceUrl(source.url).href);
			if (alive.current) setSourceError(null);
		} catch (error) {
			if (alive.current)
				setSourceError(error instanceof Error ? error.message : String(error));
		}
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(docContent);
			if (alive.current) {
				setDocError(null);
				setMessage("Text copied.");
			}
		} catch (error) {
			if (alive.current) setDocError(error instanceof Error ? error.message : String(error));
		}
	};

	const save = async () => {
		setBusy(true);
		setDocError(null);
		setMessage(null);
		const name = docTitle
			.trim()
			.replace(/[^a-zA-Z0-9-_]+/g, "-")
			.replace(/^-+|-+$/g, "");
		try {
			const saved = await adapter.saveFile(
				"Save document text",
				`${name || "document"}.txt`,
				[{ name: "Text file", extensions: ["txt"] }],
				() => docContent,
			);
			if (alive.current) setMessage(saved ? "Save requested." : "Save cancelled.");
		} catch (error) {
			if (!alive.current) return;
			if (error instanceof DOMException && error.name === "AbortError")
				setMessage("Save cancelled.");
			else setDocError(error instanceof Error ? error.message : String(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	return (
		<Stack>
			{message && <Text size="sm">{message}</Text>}
			{!connection && <Alert color="red">Project profile is no longer available.</Alert>}
			<WorkbenchLinkedCloudPanel
				connectionAvailable={Boolean(connection)}
				linkError={linkError}
				linkedPaths={profile.linkedPaths}
				formatWhen={formatTime}
				onRemoveLinkedPath={removeLink}
				remoteSourceProvider={provider}
				remoteSourceProviderOptions={providers}
				onChangeRemoteSourceProvider={setProvider}
				remoteSourceMode={mode}
				remoteSourceModeOptions={modes}
				onChangeRemoteSourceMode={setMode}
				remoteSourceLabel={label}
				onChangeRemoteSourceLabel={setLabel}
				remoteSourceUrl={url}
				onChangeRemoteSourceUrl={setUrl}
				remoteSourceNote={note}
				onChangeRemoteSourceNote={setNote}
				remoteSourceError={sourceError}
				onAddRemoteSource={addSource}
				remoteSources={profile.remoteSources ?? []}
				onOpenSource={(source) => void openSource(source)}
				onRemoveRemoteSource={removeSource}
				docWorkspaceBusy={busy}
				docWorkspaceTitle={docTitle}
				onChangeDocWorkspaceTitle={setDocTitle}
				docWorkspaceContent={docContent}
				onChangeDocWorkspaceContent={setDocContent}
				docWorkspaceError={docError}
				onCopyDocWorkspace={() => void copy()}
				onSaveDocWorkspace={() => void save()}
				canSaveDocWorkspace={!busy && docContent.length > 0}
				selectedDocSourceId={null}
			/>
		</Stack>
	);
}
