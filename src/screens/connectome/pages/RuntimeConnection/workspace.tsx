import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";

const prerequisites = {
	paths: [
		[
			"Scope the source",
			"Select the remote database, collection or namespace for this project. Store credentials in the native credential boundary, never in graph records.",
		],
		[
			"Preview the import",
			"Show source identity, access permissions, schema mapping, embedding dimensions, freshness, limits and projected cost before any ingestion.",
		],
		[
			"Keep the evidence",
			"Every imported record and relationship needs its source, version and retrieval time. Revocation and deletion must remove access and invalidate derived results.",
		],
	],
	learning: [
		[
			"Supervised learning",
			"Review examples and corrections, choose the permitted dataset, and compare a candidate against a fixed evaluation baseline before promotion.",
		],
		[
			"Unsupervised exploration",
			"Discover clusters and propose relationships from authorized data. Suggestions remain unverified until evidence or review supports them.",
		],
		[
			"Safe promotion",
			"Training, context sharing and cloud synchronization require separate consent. Keep the prior configuration and evaluation receipts so an accepted change can be rolled back.",
		],
	],
	services: [
		[
			"Subscription clients",
			"Connect through a provider's supported client and authentication flow. A chat subscription does not establish API credit or permission for background inference.",
		],
		[
			"API providers",
			"An explicit endpoint, model, credential reference, spend limit and fallback policy are required. Never silently switch to paid API usage.",
		],
		[
			"Local models",
			"A local endpoint still needs capability discovery, context and concurrency limits, timeouts, and an evaluated routing policy.",
		],
	],
} as const;

function Requirements({ items }: { items: readonly (readonly [string, string])[] }) {
	return (
		<SimpleGrid cols={{ base: 1, md: 3 }}>
			{items.map(([title, body]) => (
				<Paper
					key={title}
					withBorder
					p="md"
				>
					<Text fw={650}>{title}</Text>
					<Text
						mt="xs"
						size="sm"
					>
						{body}
					</Text>
				</Paper>
			))}
		</SimpleGrid>
	);
}

export function ProjectSection({
	section,
	detail,
	connected,
	onOpen,
}: {
	section: string;
	detail?: string;
	connected: boolean;
	onOpen: (section: string) => void;
}) {
	// The page renders the API reference itself: it reads the engine endpoint.
	if (section === "api") return null;
	if (section === "overview")
		return (
			<Stack>
				<Paper
					withBorder
					p="lg"
				>
					<Title order={3}>Your project's reasoning workspace</Title>
					<Text mt="sm">
						Inspect records in rrflowDB, follow their relationships through rrflowQL,
						compare vectors, and inspect rrflowKV storage. These are views of one
						project estate, not independent copies of its knowledge.
					</Text>
					<Text mt="sm">
						Running another project in parallel does not share its records, credentials,
						or context. Context sharing needs an explicit engine contract and
						authorization.
					</Text>
				</Paper>
				<Group>
					<Button
						variant="light"
						onClick={() => onOpen("knowledge/models")}
					>
						Explore project knowledge
					</Button>
					<Button
						variant="subtle"
						onClick={() => onOpen("knowledge/paths")}
					>
						Knowledge paths
					</Button>
				</Group>
				{!connected && (
					<Alert title="Project data requires a native session">
						The public handshake identifies the engine. Open this project in the desktop
						app with its operator credential to inspect authenticated data.
					</Alert>
				)}
			</Stack>
		);
	if (section === "knowledge")
		return (
			<Stack>
				<Button
					variant="subtle"
					onClick={() =>
						onOpen(detail === "paths" ? "knowledge/models" : "knowledge/paths")
					}
				>
					{detail === "paths" ? "Back to database" : "Knowledge paths: external sources"}
				</Button>
				{detail === "paths" ? (
					<>
						<Title order={3}>Knowledge paths</Title>
						<Badge
							color="gray"
							variant="light"
						>
							Connector setup unavailable in this build
						</Badge>
						<Text>
							A knowledge path is a project-scoped connection to an external database
							or reasoning system. Qdrant, Pinecone, HydraDB and other sources must
							preserve provenance and remote access scope when they contribute to this
							estate.
						</Text>
						<Requirements items={prerequisites.paths} />
						<Alert title="No source connected">
							This build does not offer an ingestion or knowledge-path registration
							contract. No connector is activated by visiting this page.
						</Alert>
					</>
				) : (
					!connected && (
						<Alert title="No authenticated project data">
							Use the desktop session above to inspect this view. Empty data is not
							assumed when a session is unavailable.
						</Alert>
					)
				)}
			</Stack>
		);
	if (section === "activity")
		return (
			<Stack>
				<Title order={3}>Activity and evaluation</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Session replay unavailable in this build
				</Badge>
				<Text>
					The next activity contract must link prompt submission, retrieval sources, tool
					calls, timings, budgets, durable effects and evaluation results under a project
					run identifier.
				</Text>
				<Text>
					Replay must distinguish inspecting a recorded run from executing new effects.
					Private model reasoning is not an observable execution trace.
				</Text>
				<Alert title="No fabricated activity">
					Connection status and database counters do not prove that reasoning,
					optimization or learning has run. This page has no run or replay feed until the
					engine supplies one.
				</Alert>
			</Stack>
		);
	if (section === "learning")
		return (
			<Stack>
				<Title order={3}>RROFLOW learning</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Learning controls unavailable in this build
				</Badge>
				<Text>
					RROFLOW is the planned learning and evaluation layer. Connecting a project does
					not enroll its data in training.
				</Text>
				<Requirements items={prerequisites.learning} />
				<Alert title="Enablement requires engine support">
					Dataset consent, bounded training jobs, evaluation gates and rollback need
					public engine contracts before supervised or unsupervised controls can be
					enabled.
				</Alert>
			</Stack>
		);
	if (section === "services")
		return (
			<Stack>
				<Title order={3}>Models, subscriptions and cloud</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Provider setup and cloud sync unavailable in this build
				</Badge>
				<Requirements items={prerequisites.services} />
				<Paper
					withBorder
					p="lg"
				>
					<Title order={4}>Planned cloud connections</Title>
					<Text mt="sm">
						rrflow.ai: hosted reasoning and recall. rroflow.ai: learning and evaluation.
						shippin.cloud: project devspaces.
					</Text>
					<Text mt="sm">
						These are planned service roles, not verified live login endpoints. Account
						linking, data selection, conflict handling, quotas, consent and revocation
						must be available before synchronization is offered.
					</Text>
				</Paper>
				<Alert title="Local remains independent">
					No account, subscription or upload is activated here. Existing saved engine
					connections remain usable independently of these planned services.
				</Alert>
			</Stack>
		);
	return (
		<Alert title="Unknown project section">
			<Button
				variant="subtle"
				onClick={() => onOpen("overview")}
			>
				Return to project overview
			</Button>
		</Alert>
	);
}
