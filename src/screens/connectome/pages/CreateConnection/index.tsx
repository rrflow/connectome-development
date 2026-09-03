import {
	Badge,
	Box,
	Button,
	Group,
	Menu,
	Paper,
	PasswordInput,
	ScrollArea,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
	ThemeIcon,
} from "@mantine/core";
import {
	Icon,
	iconChart,
	iconChevronDown,
	iconChevronRight,
	iconDatabase,
	iconHomePlus,
	iconQuery,
	iconRelation,
} from "@rrflow/ui";
import { useMemo } from "react";
import { useImmer } from "use-immer";
import { Link, useLocation } from "wouter";
import { adapter } from "~/adapter";
import { ConnectionNameDetails } from "~/components/ConnectionDetails/connection";
import { ConnectionLabelsDetails } from "~/components/ConnectionDetails/labels";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useLastSavepoint } from "~/hooks/overview";
import { useConnectionNavigator } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { tagEvent } from "~/shared/util/analytics";
import { getConnectionVariant, isConnectionValid } from "~/shared/util/connection";
import { createBaseConnection } from "~/shared/util/defaults";
import { dispatchIntent } from "~/shared/util/intents";
import { USER_ICONS } from "~/shared/util/user-icons";
import { useConfigStore } from "~/shell/stores/config";
import { Template } from "~/types";
import classes from "./style.module.scss";

function parseRuntimeEndpoint(value: string | null) {
	if (!value) return null;
	try {
		const url = new URL(value);
		return ["http:", "https:"].includes(url.protocol) ? url : null;
	} catch {
		return null;
	}
}

export function CreateConnectionPage() {
	const { settings, addConnection } = useConfigStore.getState();
	const [, navigate] = useLocation();

	const [connection, setConnection] = useImmer(() => {
		const draft = createBaseConnection(settings);

		const runtime = new URLSearchParams(window.location.search).get("runtime");
		const runtimeURL = parseRuntimeEndpoint(runtime);
		draft.name = runtimeURL ? "Managed RRFlow" : "Local RRFlow";
		draft.target = "runtime";
		draft.authentication.protocol = runtimeURL?.protocol === "https:" ? "https" : "http";
		draft.authentication.hostname = runtimeURL?.host ?? "localhost:9477";
		draft.authentication.mode = "none";
		draft.authentication.username = "";
		draft.authentication.password = "";

		return draft;
	});
	const navigateConnection = useConnectionNavigator();

	const isValid = useMemo(() => {
		if (connection.target === "control-plane") {
			return Boolean(
				connection.name &&
					connection.authentication.hostname &&
					connection.authentication.token,
			);
		}

		if (connection.target === "runtime" || connection.target === "diagnostics") {
			return Boolean(
				connection.name &&
					connection.authentication.hostname &&
					["http", "https"].includes(connection.authentication.protocol),
			);
		}

		return connection.name && isConnectionValid(connection.authentication);
	}, [connection.authentication, connection.name, connection.target]);

	const handleCreate = useStable(() => {
		addConnection(connection);

		if (connection.target === "control-plane") {
			navigate(`/control/${connection.id}`);
		} else if (connection.target === "diagnostics") {
			navigate(`/diagnostics/${connection.id}`);
		} else {
			navigateConnection(connection.id);
		}

		tagEvent("connection_created", {
			protocol: connection.authentication.protocol.toString(),
			variant: getConnectionVariant(connection),
			is_local: connection.authentication.hostname.includes("localhost"),
		});
	});

	const setTarget = (target: string) => {
		setConnection((draft) => {
			draft.target = target === "control-plane" ? "control-plane" : "runtime";
			if (draft.target === "control-plane") {
				draft.name = "RRFlow Enterprise";
				draft.authentication.protocol = "https";
				draft.authentication.hostname = "";
				draft.authentication.mode = "token";
				draft.authentication.username = "";
				draft.authentication.password = "";
				draft.authentication.namespace = "";
				draft.authentication.database = "";
			} else {
				draft.name = "Local RRFlow";
				draft.authentication.protocol = "http";
				draft.authentication.hostname = "localhost:9477";
				draft.authentication.mode = "none";
				draft.authentication.username = "";
				draft.authentication.password = "";
				draft.authentication.token = "";
			}
		});
	};

	const applyTemplate = (template: Template) => {
		setConnection((draft) => {
			draft.name = template.name;
			draft.icon = template.icon;
			draft.labels = template.labels;
			draft.authentication = template.values;
		});
	};

	const openTemplates = useStable(() => {
		dispatchIntent("open-settings", { tab: "templates" });
	});

	// const newLocalhost = useStable(() => {
	// 	const { username, password, port } = useConfigStore.getState().settings.serving;

	// 	const template = JSON.stringify({
	// 		name: "Local database",
	// 		icon: 0,
	// 		values: {
	// 			mode: "root",
	// 			database: "",
	// 			namespace: "",
	// 			protocol: "ws",
	// 			hostname: `localhost:${port}`,
	// 			scope: "",
	// 			scopeFields: [],
	// 			access: "",
	// 			token: "",
	// 			username,
	// 			password,
	// 		},
	// 	});

	// 	dispatchIntent("new-connection", { template });
	// 	openedHandle.close();
	// });

	const localhost = useMemo(() => {
		const { username, password, port } = useConfigStore.getState().settings.serving;

		return {
			id: "_localhost",
			name: "Local database",
			icon: 0,
			values: {
				mode: "root",
				database: "",
				namespace: "",
				protocol: "ws",
				hostname: `localhost:${port}`,
				accessFields: [],
				access: "",
				token: "",
				username,
				password,
			},
		} as Template;
	}, []);

	const templates = useConfigStore((s) => s.settings.templates.list);
	const savepoint = useLastSavepoint();

	return (
		<Box
			flex={1}
			pos="relative"
		>
			<ScrollArea
				pos="absolute"
				scrollbars="y"
				type="scroll"
				inset={0}
				className={classes.scrollArea}
				mt={18}
			>
				<Stack
					px="xl"
					mx="auto"
					maw={1200}
					pb={68}
				>
					<Box>
						<PageBreadcrumbs
							items={[
								{ label: "Connectome", href: "/overview" },
								{ label: "Connections" },
								{ label: "Create" },
							]}
						/>
						<Group mt="sm">
							<PrimaryTitle
								fz={32}
								flex={1}
							>
								Connect to RRFlow
							</PrimaryTitle>
							<Menu position="bottom-end">
								<Menu.Target>
									<Button
										rightSection={<Icon path={iconChevronDown} />}
										color="violet"
										variant="light"
									>
										Apply template
									</Button>
								</Menu.Target>
								<Menu.Dropdown miw={200}>
									{adapter.isServeSupported && (
										<>
											<Menu.Item
												onClick={() => applyTemplate(localhost)}
												leftSection={
													<ThemeIcon
														color="obsidian"
														variant="light"
														radius="xs"
														mr="xs"
													>
														<Icon path={iconHomePlus} />
													</ThemeIcon>
												}
											>
												<Box>
													<Text
														c="bright"
														fw={500}
														lh={1}
													>
														Localhost
													</Text>
													<Text fz="sm">Automatic template</Text>
												</Box>
											</Menu.Item>
											<Menu.Divider />
										</>
									)}
									{templates.length > 0 && (
										<>
											{templates.map((template) => (
												<Menu.Item
													key={template.id}
													onClick={() => applyTemplate(template)}
													leftSection={
														<ThemeIcon
															color="obsidian"
															variant="light"
															radius="xs"
															mr="xs"
														>
															<Icon
																path={USER_ICONS[template.icon]}
															/>
														</ThemeIcon>
													}
												>
													<Text
														c="bright"
														fw={500}
													>
														{template.name}
													</Text>
												</Menu.Item>
											))}
											<Menu.Divider />
										</>
									)}
									<Menu.Item
										rightSection={<Icon path={iconChevronRight} />}
										onClick={openTemplates}
									>
										Manage templates
									</Menu.Item>
								</Menu.Dropdown>
							</Menu>
						</Group>
					</Box>
					<SegmentedControl
						fullWidth
						value={connection.target ?? "runtime"}
						onChange={setTarget}
						data={[
							{
								value: "runtime",
								label: "RRD runtime",
							},
							{
								value: "control-plane",
								label: "Enterprise control plane",
							},
						]}
					/>
					<Paper
						p="xl"
						className={classes.instanceHero}
					>
						<Group
							align="flex-start"
							wrap="nowrap"
						>
							<Box flex={1}>
								<Group gap="xs">
									<Badge
										variant="light"
										color="violet"
									>
										{connection.target === "control-plane"
											? "Optional enterprise plane"
											: "Direct RRD bootstrap"}
									</Badge>
									<Badge
										variant="dot"
										color="green"
									>
										RRFlow native protocol
									</Badge>
								</Group>
								<Text
									fz="xl"
									fw={650}
									c="bright"
									mt="md"
								>
									{connection.target === "control-plane"
										? "Attach Connectome to an RRFlow enterprise control plane"
										: "Attach Connectome to an RRD instance"}
								</Text>
								<Text
									maw={720}
									mt={4}
								>
									{connection.target === "control-plane"
										? "The profile is stored locally. Connectome performs a strict RRFlow control handshake, then loads managed instances, deployment state, versions, regions, and control capabilities."
										: "Connectome verifies HTTP transport, engine readiness, RRD protocol v1, and the runtime instance identity before exposing any higher-level capability."}
								</Text>
							</Box>
							<Box className={classes.runtimePulse}>
								<span />
								<span />
								<span />
							</Box>
						</Group>

						<SimpleGrid
							cols={{ base: 2, sm: 4 }}
							mt="xl"
							spacing="sm"
						>
							{[
								[iconDatabase, "HTTP", "Liveness & readiness"],
								[iconRelation, "Identity", "Protocol & instance"],
								[iconQuery, "Mesh", "Endpoint adapter boundary"],
								[iconChart, "Attune", "Resumable engine job"],
							].map(([icon, label, detail]) => (
								<Group
									key={label}
									className={classes.capability}
									wrap="nowrap"
								>
									<ThemeIcon
										variant="light"
										color="violet"
									>
										<Icon path={icon} />
									</ThemeIcon>
									<Box>
										<Text
											fz="sm"
											fw={650}
											c="bright"
										>
											{label}
										</Text>
										<Text fz="xs">{detail}</Text>
									</Box>
								</Group>
							))}
						</SimpleGrid>
					</Paper>
					<Box mt={24}>
						<Text
							fz="xl"
							fw={600}
							c="bright"
						>
							Instance identity
						</Text>
						<Text>Name this RRFlow runtime so it is easy to find later</Text>
					</Box>
					<ConnectionNameDetails
						value={connection}
						onChange={setConnection}
					/>
					<Box mt={32}>
						<Text
							fz="xl"
							fw={600}
							c="bright"
						>
							{connection.target === "control-plane"
								? "Enterprise endpoint"
								: "Runtime endpoint"}
						</Text>
						<Text>
							{connection.target === "control-plane"
								? "Connect to the optional RRFlow enterprise management plane"
								: "Connect directly now; a mesh adapter may resolve the same RRD endpoint later"}
						</Text>
					</Box>
					{connection.target === "control-plane" ? (
						<Paper
							p="lg"
							mt="md"
						>
							<Stack>
								<TextInput
									label="Control-plane host"
									placeholder="control.example.com"
									value={connection.authentication.hostname}
									onChange={(event) =>
										setConnection((draft) => {
											draft.authentication.hostname = event.target.value;
										})
									}
								/>
								<PasswordInput
									label="Enterprise access token"
									placeholder="rrf_ent_…"
									value={connection.authentication.token}
									onChange={(event) =>
										setConnection((draft) => {
											draft.authentication.token = event.target.value;
										})
									}
								/>
							</Stack>
						</Paper>
					) : (
						<Paper
							p="lg"
							mt="md"
						>
							<Stack>
								<SegmentedControl
									value={connection.authentication.protocol}
									onChange={(protocol) =>
										setConnection((draft) => {
											draft.authentication.protocol = protocol as
												| "http"
												| "https";
										})
									}
									data={[
										{ value: "http", label: "Local HTTP" },
										{ value: "https", label: "Remote HTTPS" },
									]}
								/>
								<TextInput
									label="RRD HTTP host"
									placeholder="localhost:9477"
									value={connection.authentication.hostname}
									onChange={(event) =>
										setConnection((draft) => {
											draft.authentication.hostname = event.target.value;
										})
									}
								/>
								<Text fz="sm">
									Plain HTTP is accepted only for loopback. Mesh and other remote
									endpoints require HTTPS.
								</Text>
								<TextInput
									label="Expected instance ID (optional)"
									placeholder="rrflow-instance"
									value={connection.runtimeInstance ?? ""}
									onChange={(event) =>
										setConnection((draft) => {
											draft.runtimeInstance = event.target.value || undefined;
										})
									}
									description="Reject a reachable endpoint that identifies as another RRD instance."
								/>
							</Stack>
						</Paper>
					)}
					<Box mt={24}>
						<Text
							fz="xl"
							fw={600}
							c="bright"
						>
							Labels
						</Text>
						<Text>Add filtering labels to this connection</Text>
					</Box>
					<ConnectionLabelsDetails
						value={connection}
						onChange={setConnection}
					/>
					<Group mt={24}>
						<Link to={savepoint.path}>
							<Button
								color="obsidian"
								variant="light"
							>
								Back
							</Button>
						</Link>
						<Button
							type="submit"
							variant="gradient"
							disabled={!isValid}
							onClick={handleCreate}
						>
							{connection.target === "control-plane"
								? "Save & open enterprise"
								: "Save & connect to RRD"}
						</Button>
					</Group>
				</Stack>
			</ScrollArea>
		</Box>
	);
}
