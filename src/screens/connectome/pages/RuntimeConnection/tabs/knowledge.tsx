import {
	Accordion,
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Modal,
	NumberInput,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Text,
	TextInput,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	knowledgeDescendants,
	knowledgeId,
	knowledgeParentOptions,
	knowledgeTreeAvailability,
	knowledgeUnplacedPaths,
	putKnowledgePath,
	putKnowledgeTree,
	readKnowledgeTrees,
	rebaseKnowledgeTrees,
	removeKnowledgePath,
	saveKnowledgeTrees,
} from "../../../../../rrflow/knowledge";
import type {
	RrdKnowledgePathBindingView,
	RrdKnowledgePathView,
	RrdKnowledgeTreeCatalogueView,
	RrdKnowledgeTreeView,
} from "../../../../../rrflow/session";
import type { RuntimeLensProps } from "../types";

function errorText(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

type ExternalBinding = Extract<RrdKnowledgePathBindingView, { kind: "external" }>;

function externalBinding(): ExternalBinding {
	return {
		kind: "external",
		provider_id: "",
		namespace: null,
		index: null,
		collection: null,
		endpoint: {
			id: knowledgeId("binding"),
			class: "vector_store",
			kind: "api",
			endpoint: { kind: "url", url: "" },
			service_id: "",
			manifest_sha256: null,
			credential: { provider: "", name: "" },
			placement: null,
			footprint: { memory_bytes: 1024 * 1024, gpu: { kind: "none" } },
			limits: { max_concurrency: 4, timeout_ms: 10_000, max_input_bytes: 1024 * 1024 },
		},
	};
}

const providerNames = new Map([
	["postgres-pgvector", "PostgreSQL (pgvector)"],
	["hydradb", "HydraDB"],
	["mongodb-atlas", "MongoDB Atlas"],
	["pinecone-nexus", "Pinecone Nexus"],
]);

function ExternalPathEditor({
	binding,
	onChange,
}: {
	binding: ExternalBinding;
	onChange: (binding: ExternalBinding) => void;
}) {
	const endpoint = binding.endpoint;
	const [customProvider, setCustomProvider] = useState(
		Boolean(binding.provider_id && !providerNames.has(binding.provider_id)),
	);
	const isCustom =
		customProvider || Boolean(binding.provider_id && !providerNames.has(binding.provider_id));
	const credentialRequired = ["api", "subscription"].includes(endpoint.kind);
	const updateEndpoint = (change: Partial<typeof endpoint>) =>
		onChange({ ...binding, endpoint: { ...endpoint, ...change } });
	function updateProvider(provider_id: string) {
		onChange({
			...binding,
			provider_id,
			endpoint: {
				...endpoint,
				service_id:
					endpoint.service_id === binding.provider_id ? provider_id : endpoint.service_id,
			},
		});
	}
	return (
		<Stack gap="sm">
			<Alert
				color="blue"
				title="Connection setup only"
			>
				Save a reference to your service. Provider choices are setup labels; a working
				connector, connection check, import and sync are not available here yet.
			</Alert>
			<Select
				label="Service provider"
				placeholder="Choose a provider"
				searchable
				data={[
					...[...providerNames].map(([value, label]) => ({ value, label })),
					{ value: "__custom__", label: "Other provider" },
				]}
				value={isCustom ? "__custom__" : binding.provider_id || null}
				onChange={(value) => {
					if (!value) return;
					setCustomProvider(value === "__custom__");
					updateProvider(value === "__custom__" ? "" : value);
				}}
			/>
			{isCustom && (
				<TextInput
					label="Provider identifier"
					description="The identifier used by your provider configuration."
					value={binding.provider_id}
					onChange={(event) => updateProvider(event.currentTarget.value)}
				/>
			)}
			<TextInput
				label="Service address"
				placeholder="https://service.example/vectors"
				description="Use the endpoint URL without passwords, API keys, query strings or fragments."
				value={endpoint.endpoint.url}
				onChange={(event) =>
					updateEndpoint({ endpoint: { kind: "url", url: event.currentTarget.value } })
				}
			/>
			<SimpleGrid cols={{ base: 1, sm: 3 }}>
				{(["namespace", "index", "collection"] as const).map((field) => (
					<TextInput
						key={field}
						label={`${field[0].toUpperCase()}${field.slice(1)}`}
						value={binding[field] ?? ""}
						onChange={(event) =>
							onChange({ ...binding, [field]: event.currentTarget.value || null })
						}
					/>
				))}
			</SimpleGrid>
			<Text
				fz="xs"
				c="slate"
			>
				Enter at least one location name from your service. Use its exact spelling and case.
			</Text>
			<Paper
				withBorder
				p="sm"
			>
				<Stack gap="xs">
					<Switch
						label="Use a stored credential reference"
						description={
							credentialRequired
								? "Required for API and subscription connections. Only the reference is saved."
								: "Optional for this connection type. Only the reference is saved."
						}
						checked={endpoint.credential !== null}
						disabled={credentialRequired}
						onChange={(event) =>
							updateEndpoint({
								credential: event.currentTarget.checked
									? { provider: "", name: "" }
									: null,
							})
						}
					/>
					{endpoint.credential && (
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput
								label="Credential storage identifier"
								description="Where the existing credential is stored."
								value={endpoint.credential.provider}
								onChange={(event) =>
									updateEndpoint({
										credential: {
											provider: event.currentTarget.value,
											name: endpoint.credential?.name ?? "",
										},
									})
								}
							/>
							<TextInput
								label="Credential name"
								description="The stored name. Never paste the secret itself."
								value={endpoint.credential.name}
								onChange={(event) =>
									updateEndpoint({
										credential: {
											provider: endpoint.credential?.provider ?? "",
											name: event.currentTarget.value,
										},
									})
								}
							/>
						</SimpleGrid>
					)}
				</Stack>
			</Paper>
			<Accordion
				variant="separated"
				multiple
			>
				<Accordion.Item value="connection">
					<Accordion.Control>Advanced connection settings</Accordion.Control>
					<Accordion.Panel>
						<Stack gap="sm">
							<SimpleGrid cols={{ base: 1, sm: 2 }}>
								<Select
									label="Connection type"
									value={endpoint.kind}
									data={[
										{ value: "api", label: "Hosted API" },
										{ value: "subscription", label: "Subscription service" },
										{ value: "self_hosted", label: "Self-hosted service" },
										{ value: "local", label: "Local service" },
									]}
									onChange={(value) => {
										if (!value) return;
										const kind = value as typeof endpoint.kind;
										const remote = kind === "api" || kind === "subscription";
										updateEndpoint({
											kind,
											placement: remote ? null : (endpoint.placement ?? ""),
											credential: remote
												? (endpoint.credential ?? {
														provider: "",
														name: "",
													})
												: endpoint.credential,
										});
									}}
								/>
								<TextInput
									label="Service identifier"
									value={endpoint.service_id}
									onChange={(event) =>
										updateEndpoint({ service_id: event.currentTarget.value })
									}
								/>
							</SimpleGrid>
							{endpoint.placement !== null && (
								<TextInput
									label="Machine identifier"
									description="The configured machine for this local or self-hosted service."
									value={endpoint.placement}
									onChange={(event) =>
										updateEndpoint({ placement: event.currentTarget.value })
									}
								/>
							)}
							<Text
								fz="xs"
								c="slate"
								style={{ overflowWrap: "anywhere" }}
							>
								Provider ID: {binding.provider_id || "Not set"} · Binding ID:{" "}
								{endpoint.id}
							</Text>
						</Stack>
					</Accordion.Panel>
				</Accordion.Item>
				<Accordion.Item value="limits">
					<Accordion.Control>Resource limits</Accordion.Control>
					<Accordion.Panel>
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<NumberInput
								label="Declared memory (bytes)"
								min={1}
								max={64 * 1024 ** 4}
								allowDecimal={false}
								value={endpoint.footprint.memory_bytes}
								onChange={(value) =>
									updateEndpoint({
										footprint: {
											...endpoint.footprint,
											memory_bytes: Number(value),
										},
									})
								}
							/>
							<NumberInput
								label="Concurrent requests"
								min={1}
								max={65536}
								allowDecimal={false}
								value={endpoint.limits.max_concurrency}
								onChange={(value) =>
									updateEndpoint({
										limits: {
											...endpoint.limits,
											max_concurrency: Number(value),
										},
									})
								}
							/>
							<NumberInput
								label="Timeout (ms)"
								min={1}
								max={3_600_000}
								allowDecimal={false}
								value={endpoint.limits.timeout_ms}
								onChange={(value) =>
									updateEndpoint({
										limits: { ...endpoint.limits, timeout_ms: Number(value) },
									})
								}
							/>
							<NumberInput
								label="Maximum input (bytes)"
								min={1}
								max={64 * 1024 ** 3}
								allowDecimal={false}
								value={endpoint.limits.max_input_bytes}
								onChange={(value) =>
									updateEndpoint({
										limits: {
											...endpoint.limits,
											max_input_bytes: Number(value),
										},
									})
								}
							/>
						</SimpleGrid>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</Stack>
	);
}

function PathSummary({ path }: { path: RrdKnowledgePathView }) {
	if (path.binding.kind === "group")
		return (
			<Text
				fz="xs"
				c="slate"
			>
				Group · organizes other paths
			</Text>
		);
	if (path.binding.kind === "native")
		return (
			<Text
				fz="xs"
				c="slate"
				style={{ overflowWrap: "anywhere" }}
			>
				RRFlow vectors · {path.binding.collection_id} / {path.binding.vector_name} · source
				reference
			</Text>
		);
	return (
		<Text
			fz="xs"
			c="slate"
			style={{ overflowWrap: "anywhere" }}
		>
			{providerNames.get(path.binding.provider_id) ?? path.binding.provider_id} ·{" "}
			{[path.binding.namespace, path.binding.index, path.binding.collection]
				.filter(Boolean)
				.join(" / ")}{" "}
			· connection unverified
		</Text>
	);
}

function PathRows({
	tree,
	parentId,
	disabled,
	onEdit,
	onRemove,
	depth = 0,
}: {
	tree: RrdKnowledgeTreeView;
	parentId: string | null;
	disabled: boolean;
	depth?: number;
	onEdit: (path: RrdKnowledgePathView) => void;
	onRemove: (path: RrdKnowledgePathView) => void;
}) {
	if (depth > 64) return null;
	return (
		<Stack gap="xs">
			{tree.paths
				.filter((path) => path.parent_id === parentId)
				.map((path) => (
					<Box
						key={path.id}
						ml={depth > 0 && depth < 4 ? "sm" : 0}
					>
						<Paper
							withBorder
							p="xs"
						>
							<Group
								justify="space-between"
								wrap="wrap"
								align="flex-start"
							>
								<Box
									miw={0}
									style={{ flex: "1 1 12rem", overflowWrap: "anywhere" }}
								>
									<Text fw={600}>{path.name}</Text>
									<PathSummary path={path} />
								</Box>
								<Group
									gap={4}
									wrap="nowrap"
								>
									<Button
										variant="subtle"
										size="xs"
										disabled={disabled}
										onClick={() => onEdit(path)}
									>
										Edit
									</Button>
									<Button
										variant="subtle"
										color="red"
										size="xs"
										disabled={disabled}
										onClick={() => onRemove(path)}
									>
										Remove
									</Button>
								</Group>
							</Group>
						</Paper>
						<Box mt="xs">
							<PathRows
								tree={tree}
								parentId={path.id}
								depth={depth + 1}
								disabled={disabled}
								onEdit={onEdit}
								onRemove={onRemove}
							/>
						</Box>
					</Box>
				))}
		</Stack>
	);
}

interface Draft {
	base: RrdKnowledgeTreeCatalogueView;
	trees: RrdKnowledgeTreeView[];
}

export function KnowledgeTab({
	client,
	connection,
	sessionKey,
	active,
}: RuntimeLensProps & { active: boolean }) {
	const queryClient = useQueryClient();
	const queryKey = ["rrd-knowledge-trees", sessionKey];
	const unavailable = knowledgeTreeAvailability(connection);
	const query = useQuery({
		queryKey,
		enabled: active && !unavailable,
		queryFn: () => readKnowledgeTrees(client, connection),
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const vectors = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: active && !unavailable,
		queryFn: () => client.vectorCollections(),
	});
	const [draft, setDraft] = useState<Draft | null>(null);
	const [treeForm, setTreeForm] = useState<{ id: string; name: string } | null>(null);
	const [pathForm, setPathForm] = useState<{ treeId: string; path: RrdKnowledgePathView } | null>(
		null,
	);
	const [remove, setRemove] = useState<{
		tree: RrdKnowledgeTreeView;
		path?: RrdKnowledgePathView;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [conflict, setConflict] = useState<{
		latest: RrdKnowledgeTreeCatalogueView;
		merged: RrdKnowledgeTreeView[];
		conflicts: string[];
	} | null>(null);
	useEffect(() => {
		if (query.data && !draft) setDraft({ base: query.data, trees: query.data.trees });
	}, [query.data, draft]);
	const dirty =
		draft !== null && JSON.stringify(draft.trees) !== JSON.stringify(draft.base.trees);
	function applyLatest(latest: RrdKnowledgeTreeCatalogueView, current: Draft | null) {
		queryClient.setQueryData(queryKey, latest);
		if (!current) {
			setDraft({ base: latest, trees: latest.trees });
			return;
		}
		const merged = rebaseKnowledgeTrees(current.base.trees, current.trees, latest.trees);
		if (merged.conflicts.length) {
			setConflict({ latest, merged: merged.trees, conflicts: merged.conflicts });
			setNotice(null);
		} else {
			setDraft({ base: latest, trees: merged.trees });
			setConflict(null);
			setNotice(
				`Refreshed revision ${latest.revision}. Your draft changes were retained; review them before saving.`,
			);
		}
	}
	const save = useMutation({
		mutationFn: () => {
			if (!draft) throw new Error("Read the knowledge catalogue before saving.");
			return saveKnowledgeTrees(client, connection, draft.base.revision, draft.trees);
		},
		onSuccess: (result) => {
			queryClient.setQueryData(queryKey, result.catalogue);
			setDraft({ base: result.catalogue, trees: result.catalogue.trees });
			setError(null);
			setConflict(null);
			setNotice(
				`Saved revision ${result.catalogue.revision}. Paths are registered configuration; this does not import or synchronize data.`,
			);
		},
		onError: async (failure) => {
			setError(errorText(failure));
			setNotice(null);
			try {
				const latest = await readKnowledgeTrees(client, connection);
				if (draft && latest.revision !== draft.base.revision) applyLatest(latest, draft);
			} catch {
				// Preserve the original save refusal and all local edits.
			}
		},
	});
	const refresh = useMutation({
		mutationFn: () => readKnowledgeTrees(client, connection),
		onSuccess: (latest) => {
			applyLatest(latest, draft);
			setError(null);
		},
		onError: (failure) => setError(errorText(failure)),
	});
	const busy = save.isPending || refresh.isPending;
	const paths = draft?.trees.flatMap((tree) => tree.paths) ?? [];
	const nativeCount = paths.filter((path) => path.binding.kind === "native").length;
	const externalCount = paths.filter((path) => path.binding.kind === "external").length;
	const saveHint = !draft
		? query.isError
			? "Retry loading your trees before editing."
			: "Loading your saved trees…"
		: save.isPending
			? "Saving your changes…"
			: refresh.isPending
				? "Checking for changes; your draft is kept."
				: conflict
					? "Resolve the changes below before saving. Your draft is kept."
					: dirty
						? "Your changes are in a draft. Save changes to apply them to RRFlow."
						: "No unsaved changes. Add a tree or edit a path to get started.";
	const editingTree = draft?.trees.find((tree) => tree.id === pathForm?.treeId);
	const collections = vectors.data?.collections ?? [];
	const selectedBinding = pathForm?.path.binding;
	const selectedCollection =
		selectedBinding?.kind === "native"
			? collections.find(
					(collection) => collection.collection_id === selectedBinding.collection_id,
				)
			: undefined;
	function editPath(change: Partial<RrdKnowledgePathView>) {
		setPathForm((current) =>
			current ? { ...current, path: { ...current.path, ...change } } : null,
		);
	}
	function applyPath() {
		if (!draft || !pathForm || !editingTree) return;
		try {
			const path = { ...pathForm.path, name: pathForm.path.name.trim() };
			if (!path.name) throw new Error("Give this path a name.");
			if (
				path.binding.kind === "native" &&
				(!path.binding.collection_id || !path.binding.vector_name)
			) {
				throw new Error("Choose an existing native collection and named vector.");
			}
			if (path.binding.kind === "external") {
				let url: URL;
				try {
					url = new URL(path.binding.endpoint.endpoint.url);
				} catch {
					throw new Error("Enter a valid credential-free endpoint URL.");
				}
				if (url.username || url.password || url.search || url.hash) {
					throw new Error(
						"Use an endpoint without credentials, query strings or fragments.",
					);
				}
			}
			setDraft({
				...draft,
				trees: putKnowledgeTree(draft.trees, putKnowledgePath(editingTree, path)),
			});
			setPathForm(null);
			setError(null);
			setNotice(null);
			setConflict(null);
		} catch (failure) {
			setError(errorText(failure));
		}
	}
	if (unavailable)
		return (
			<Alert
				color="blue"
				title="Knowledge trees unavailable for this connection"
			>
				<Stack gap="xs">
					<Text fz="sm">{unavailable}</Text>
					<Text fz="sm">
						Tree editing is unavailable for this connection. You can continue using its
						other available views.
					</Text>
				</Stack>
			</Alert>
		);
	return (
		<Stack gap="sm">
			<Box>
				<Text
					fz="lg"
					fw={650}
					c="bright"
				>
					Knowledge trees & paths
				</Text>
				<Text
					fz="sm"
					c="slate"
				>
					Organize knowledge by topic. Each path groups other paths or points to a data
					source.
				</Text>
			</Box>
			<Paper
				withBorder
				p="sm"
				style={{
					position: "sticky",
					top: 0,
					zIndex: 5,
					background: "var(--mantine-color-body)",
				}}
			>
				<Stack gap="xs">
					<Group
						justify="space-between"
						gap="xs"
					>
						<Box style={{ flex: "1 1 12rem" }}>
							<Group gap="xs">
								<Badge color={conflict || dirty ? "yellow" : "gray"}>
									{!draft
										? query.isError
											? "Load failed"
											: "Loading"
										: conflict
											? "Review needed"
											: dirty
												? "Unsaved draft"
												: "Saved"}
								</Badge>
								{draft && (
									<Text
										fz="xs"
										c="slate"
									>
										{draft.trees.length}{" "}
										{draft.trees.length === 1 ? "tree" : "trees"} ·{" "}
										{paths.length} {paths.length === 1 ? "path" : "paths"} ·{" "}
										{nativeCount} RRFlow · {externalCount} external
									</Text>
								)}
							</Group>
						</Box>
						<Group gap="xs">
							<Button
								size="xs"
								variant="light"
								loading={refresh.isPending}
								disabled={!draft || busy}
								onClick={() => refresh.mutate()}
							>
								Refresh
							</Button>
							<Button
								size="sm"
								disabled={!draft || !dirty || busy || Boolean(conflict)}
								loading={save.isPending}
								onClick={() => save.mutate()}
							>
								Save changes
							</Button>
						</Group>
					</Group>
					<Text
						fz="xs"
						c="slate"
						role="status"
						aria-live="polite"
					>
						{saveHint}
					</Text>
					{error && (
						<Alert
							color="red"
							title="Changes need attention"
							role="alert"
						>
							{error}
						</Alert>
					)}
					{notice && (
						<Text
							fz="xs"
							role="status"
							aria-live="polite"
						>
							{notice}
						</Text>
					)}
				</Stack>
			</Paper>
			{query.isError && (
				<Alert
					color="red"
					title="Your saved trees could not be loaded"
					role="alert"
				>
					{errorText(query.error)}{" "}
					<Button
						variant="subtle"
						onClick={() => query.refetch()}
					>
						Retry
					</Button>
				</Alert>
			)}
			{vectors.isError && (
				<Alert
					color="yellow"
					title="RRFlow vector sources could not be loaded"
					role="alert"
				>
					{errorText(vectors.error)}
					<Text fz="sm">
						You can still organize groups and external service settings.
					</Text>
					<Button
						variant="subtle"
						onClick={() => vectors.refetch()}
					>
						Retry vector sources
					</Button>
				</Alert>
			)}

			{conflict && (
				<Alert
					color="yellow"
					title="The saved version has changed"
				>
					<Stack gap="xs">
						<Text fz="sm">
							Your draft is kept. Choose which changes to keep before saving. Changed
							fields: {conflict.conflicts.join("; ")}.
						</Text>
						<Group>
							<Button
								variant="light"
								onClick={() => {
									setDraft({ base: conflict.latest, trees: conflict.merged });
									setConflict(null);
									setNotice(
										"Concurrent changes were merged. Your conflicting fields were kept in the draft; review before saving.",
									);
								}}
							>
								Keep my edits and review
							</Button>
							<Button
								variant="subtle"
								onClick={() => {
									setDraft({
										base: conflict.latest,
										trees: conflict.latest.trees,
									});
									setConflict(null);
									setError(null);
								}}
							>
								Use saved version and discard my draft
							</Button>
						</Group>
					</Stack>
				</Alert>
			)}
			{draft && (
				<>
					<Group justify="space-between">
						<Text
							fz="sm"
							c="slate"
						>
							Changes take effect after you save.
						</Text>
						<Group gap="xs">
							<Button
								variant="subtle"
								disabled={!dirty || busy}
								onClick={() => {
									setDraft({ ...draft, trees: draft.base.trees });
									setConflict(null);
									setError(null);
									setNotice(null);
								}}
							>
								Discard draft
							</Button>
							<Button
								variant="light"
								disabled={busy || Boolean(conflict)}
								onClick={() => setTreeForm({ id: knowledgeId("tree"), name: "" })}
							>
								Add tree
							</Button>
						</Group>
					</Group>
					{draft.trees.length === 0 && (
						<Paper
							withBorder
							p="lg"
						>
							<Text c="slate">
								Start with a tree for a topic or project, then add groups or source
								paths. Saving organizes source references; it does not import
								documents or start sync.
							</Text>
						</Paper>
					)}
					{draft.trees.map((tree) => (
						<Paper
							withBorder
							p="md"
							key={tree.id}
						>
							<Stack gap="sm">
								<Group
									justify="space-between"
									align="flex-start"
								>
									<Box>
										<Text
											fw={650}
											fz="lg"
										>
											{tree.name}
										</Text>
										<Text
											fz="xs"
											c="slate"
										>
											{tree.paths.length}{" "}
											{tree.paths.length === 1 ? "path" : "paths"}
										</Text>
									</Box>
									<Group gap="xs">
										<Button
											variant="light"
											size="xs"
											disabled={busy || Boolean(conflict)}
											onClick={() =>
												setPathForm({
													treeId: tree.id,
													path: {
														id: knowledgeId("path"),
														name: "",
														parent_id: null,
														binding: { kind: "group" },
													},
												})
											}
										>
											Add path
										</Button>
										<Button
											variant="subtle"
											size="xs"
											disabled={busy || Boolean(conflict)}
											onClick={() =>
												setTreeForm({ id: tree.id, name: tree.name })
											}
										>
											Rename
										</Button>
										<Button
											variant="subtle"
											color="red"
											size="xs"
											disabled={busy || Boolean(conflict)}
											onClick={() => setRemove({ tree })}
										>
											Remove tree
										</Button>
									</Group>
								</Group>
								<PathRows
									tree={tree}
									parentId={null}
									disabled={busy || Boolean(conflict)}
									onEdit={(path) =>
										setPathForm({
											treeId: tree.id,
											path: structuredClone(path),
										})
									}
									onRemove={(path) => setRemove({ tree, path })}
								/>
								{tree.paths.length === 0 && (
									<Text
										fz="sm"
										c="slate"
									>
										Add a path to organize a group or choose a data source.
									</Text>
								)}
								{knowledgeUnplacedPaths(tree).length > 0 && (
									<Alert
										color="yellow"
										title="Some paths need a new group"
									>
										<Stack gap="xs">
											<Text fz="sm">
												A group was removed or paths were placed inside one
												another. Your paths are kept below. Choose a new
												group or move them to the top of the tree before
												saving.
											</Text>
											{knowledgeUnplacedPaths(tree).map((path) => (
												<Group
													key={path.id}
													justify="space-between"
												>
													<Text fz="sm">{path.name}</Text>
													<Group gap="xs">
														<Button
															variant="subtle"
															size="xs"
															disabled={busy || Boolean(conflict)}
															onClick={() =>
																setPathForm({
																	treeId: tree.id,
																	path: structuredClone(path),
																})
															}
														>
															Choose group
														</Button>
														<Button
															variant="subtle"
															color="red"
															size="xs"
															disabled={busy || Boolean(conflict)}
															onClick={() =>
																setRemove({ tree, path })
															}
														>
															Remove
														</Button>
													</Group>
												</Group>
											))}
										</Stack>
									</Alert>
								)}
							</Stack>
						</Paper>
					))}
					<Accordion variant="separated">
						<Accordion.Item value="catalogue">
							<Accordion.Control>Project and saved revision</Accordion.Control>
							<Accordion.Panel>
								<Text
									fz="xs"
									c="slate"
									style={{ overflowWrap: "anywhere" }}
								>
									Project: {draft.base.project_id} · Scope: {draft.base.scope} ·
									Revision: {draft.base.revision}
								</Text>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
				</>
			)}
			<Modal
				opened={treeForm !== null}
				onClose={() => setTreeForm(null)}
				title="Knowledge tree"
				centered
			>
				<Stack>
					<TextInput
						label="Tree name"
						autoFocus
						value={treeForm?.name ?? ""}
						onChange={(event) => {
							const name = event.currentTarget.value;
							setTreeForm((current) => (current ? { ...current, name } : null));
						}}
					/>
					<Text
						fz="sm"
						c="slate"
					>
						A tree collects related knowledge paths. Give it a name you will recognize.
					</Text>
					<Accordion variant="separated">
						<Accordion.Item value="identity">
							<Accordion.Control>Technical details</Accordion.Control>
							<Accordion.Panel>
								<Text
									fz="xs"
									style={{ overflowWrap: "anywhere" }}
								>
									Tree ID: {treeForm?.id}
								</Text>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
					<Group justify="flex-end">
						<Button
							variant="subtle"
							onClick={() => setTreeForm(null)}
						>
							Cancel
						</Button>
						<Button
							disabled={!treeForm?.name.trim()}
							onClick={() => {
								if (!treeForm || !draft) return;
								const existing = draft.trees.find(
									(tree) => tree.id === treeForm.id,
								);
								setDraft({
									...draft,
									trees: putKnowledgeTree(draft.trees, {
										...treeForm,
										name: treeForm.name.trim(),
										paths: existing?.paths ?? [],
									}),
								});
								setTreeForm(null);
								setNotice(null);
							}}
						>
							Apply to draft
						</Button>
					</Group>
				</Stack>
			</Modal>
			<Modal
				opened={pathForm !== null}
				onClose={() => setPathForm(null)}
				title="Knowledge path"
				size="lg"
				centered
			>
				{pathForm && editingTree && (
					<Stack>
						<TextInput
							label="Path name"
							autoFocus
							value={pathForm.path.name}
							onChange={(event) => editPath({ name: event.currentTarget.value })}
						/>

						<Select
							label="Place inside a group"
							placeholder="Top of this tree"
							description="Leave empty to place this path at the top level."
							clearable
							searchable
							data={knowledgeParentOptions(editingTree, pathForm.path.id).map(
								(path) => ({ value: path.id, label: path.name }),
							)}
							value={pathForm.path.parent_id}
							onChange={(parent_id) => editPath({ parent_id })}
						/>
						<Select
							label="What does this path contain?"
							value={pathForm.path.binding.kind}
							data={[
								{ value: "group", label: "Group of paths" },
								{ value: "native", label: "RRFlow vectors · this estate" },
								{ value: "external", label: "External service · setup only" },
							]}
							onChange={(kind) => {
								if (kind === pathForm.path.binding.kind) return;
								if (kind === "group") editPath({ binding: { kind: "group" } });
								if (kind === "external") editPath({ binding: externalBinding() });
								if (kind === "native")
									editPath({
										binding: {
											kind: "native",
											collection_id: collections[0]?.collection_id ?? "",
											vector_name: collections[0]?.vectors[0]?.name ?? "",
										},
									});
							}}
						/>
						{pathForm.path.binding.kind === "group" && (
							<Text
								fz="sm"
								c="slate"
							>
								Groups keep related paths together. Add source paths inside this
								group after saving it to your draft.
							</Text>
						)}
						{pathForm.path.binding.kind === "native" && (
							<>
								{vectors.isPending && (
									<Text
										fz="sm"
										role="status"
									>
										Loading RRFlow vector sources…
									</Text>
								)}
								{vectors.isError && (
									<Alert
										color="yellow"
										title="Vector sources unavailable"
									>
										{errorText(vectors.error)}
										<Button
											variant="subtle"
											onClick={() => vectors.refetch()}
										>
											Retry sources
										</Button>
									</Alert>
								)}
								{vectors.isSuccess && collections.length === 0 && (
									<Alert
										color="blue"
										title="No RRFlow vector collections yet"
									>
										A native path needs a collection already stored in this
										estate. You can add groups or external service settings now.
									</Alert>
								)}
								{selectedCollection && selectedCollection.vectors.length === 0 && (
									<Alert
										color="blue"
										title="This collection has no vector fields"
									>
										Choose a collection with an existing vector field. If the
										estate changes, refresh the sources below.
									</Alert>
								)}
								<Select
									label="RRFlow collection"
									disabled={
										vectors.isPending ||
										vectors.isError ||
										collections.length === 0
									}
									searchable
									placeholder="Choose an existing collection"
									data={collections.map((collection) => ({
										value: collection.collection_id,
										label: collection.collection_id,
									}))}
									value={pathForm.path.binding.collection_id}
									onChange={(collection_id) => {
										const collection = collections.find(
											(item) => item.collection_id === collection_id,
										);
										editPath({
											binding: {
												kind: "native",
												collection_id: collection_id ?? "",
												vector_name: collection?.vectors[0]?.name ?? "",
											},
										});
									}}
								/>
								<Select
									label="Vector field"
									description={
										!selectedCollection
											? "Choose a RRFlow collection first to see its vector fields."
											: undefined
									}
									disabled={
										!selectedCollection ||
										selectedCollection.vectors.length === 0
									}
									searchable
									placeholder="Choose a vector field"
									data={(selectedCollection?.vectors ?? []).map((vector) => ({
										value: vector.name,
										label: `${vector.name} · ${vector.dimensions} dimensions`,
									}))}
									value={pathForm.path.binding.vector_name}
									onChange={(vector_name) => {
										if (pathForm.path.binding.kind === "native")
											editPath({
												binding: {
													...pathForm.path.binding,
													vector_name: vector_name ?? "",
												},
											});
									}}
								/>
								<Text
									fz="sm"
									c="slate"
								>
									Use vectors already stored in this RRFlow estate. Saving the
									path only registers the reference; it does not import documents.
								</Text>
								<Button
									variant="subtle"
									size="xs"
									loading={vectors.isFetching}
									onClick={() => vectors.refetch()}
								>
									Refresh vector sources
								</Button>
							</>
						)}
						{pathForm.path.binding.kind === "external" && (
							<ExternalPathEditor
								binding={pathForm.path.binding}
								onChange={(binding) => editPath({ binding })}
							/>
						)}
						<Accordion variant="separated">
							<Accordion.Item value="identity">
								<Accordion.Control>Path technical details</Accordion.Control>
								<Accordion.Panel>
									<Text
										fz="xs"
										style={{ overflowWrap: "anywhere" }}
									>
										Path ID: {pathForm.path.id}
									</Text>
								</Accordion.Panel>
							</Accordion.Item>
						</Accordion>
						<Text
							fz="xs"
							c="slate"
						>
							Apply to draft stages this edit. Use Save changes to apply your draft to
							RRFlow.
						</Text>
						{error && (
							<Alert
								color="red"
								role="alert"
							>
								{error}
							</Alert>
						)}
						<Group justify="flex-end">
							<Button
								variant="subtle"
								onClick={() => setPathForm(null)}
							>
								Cancel
							</Button>
							<Button onClick={applyPath}>Apply to draft</Button>
						</Group>
					</Stack>
				)}
			</Modal>
			<Modal
				opened={remove !== null}
				onClose={() => setRemove(null)}
				title="Remove from your trees?"
				centered
			>
				<Stack>
					<Text>
						{remove?.path
							? `Remove ${remove.path.name} and its ${Math.max(0, knowledgeDescendants(remove.tree, remove.path.id).size - 1)} descendant paths from this draft?`
							: `Remove ${remove?.tree.name} and all its registered paths from this draft?`}
					</Text>
					<Text
						fz="sm"
						c="slate"
					>
						The source data is kept. This removal takes effect when you save changes.
					</Text>
					<Group justify="flex-end">
						<Button
							variant="subtle"
							onClick={() => setRemove(null)}
						>
							Cancel
						</Button>
						<Button
							color="red"
							onClick={() => {
								if (!remove || !draft) return;
								setDraft({
									...draft,
									trees: remove.path
										? putKnowledgeTree(
												draft.trees,
												removeKnowledgePath(remove.tree, remove.path.id),
											)
										: draft.trees.filter((tree) => tree.id !== remove.tree.id),
								});
								setRemove(null);
								setNotice(null);
							}}
						>
							Remove from draft
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Stack>
	);
}
