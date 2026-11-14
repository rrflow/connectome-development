import { Alert, Box, Group, Paper, SimpleGrid, Text, UnstyledButton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { iconBook, iconMemory, iconRelation, iconTarget } from "~/shared/assets/icons";
import { databaseQuery } from "../api/queries";
import { Term } from "../components/glossary";
import { graphTotals } from "../graph/totals";
import { GuideCards } from "../guides/cards";
import { useProject } from "../project/context";
import { ProjectOverview } from "../shell/workspace";
import classes from "../style.module.scss";
import { formatCount } from "../utils/format";

interface LensCardProps {
	icon: string;
	title: string;
	purpose: string;
	reading: ReactNode;
	onOpen: () => void;
}

function LensCard({ icon, title, purpose, reading, onOpen }: LensCardProps) {
	return (
		<UnstyledButton onClick={onOpen}>
			<Paper
				p="md"
				h="100%"
				className={classes.lens}
			>
				<Group
					gap="sm"
					wrap="nowrap"
					align="flex-start"
				>
					<Box
						c="violet"
						mt={2}
					>
						<Icon path={icon} />
					</Box>
					<Box miw={0}>
						<Text
							fw={700}
							c="bright"
						>
							{title}
						</Text>
						<Text
							fz="sm"
							c="slate"
						>
							{purpose}
						</Text>
						<Text
							fz="sm"
							fw={600}
							mt={6}
						>
							{reading}
						</Text>
					</Box>
				</Group>
			</Paper>
		</UnstyledButton>
	);
}

/** The project's first screen: what it holds, read live, and where to go next. */
export function ProjectHome() {
	const { connection, session, client, sessionKey, open, openLens } = useProject();
	// The lens cards read the same cached snapshots the lenses render.
	const database = useQuery({
		...databaseQuery(client, sessionKey),
		enabled: Boolean(session),
	});
	const catalogue = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: Boolean(session),
		queryFn: () => client.vectorCollections(),
	});
	const graph = database.data?.graph;
	const collections = catalogue.data?.collections;
	const namedVectors =
		collections?.reduce((count, collection) => count + collection.vectors.length, 0) ?? 0;
	const storageProfile = session?.service.storage_profile;

	return (
		<>
			{session && (database.isError || catalogue.isError) && (
				<Alert
					color="red"
					title="Project data could not be read"
				>
					{describeRrdError(database.error ?? catalogue.error)}
				</Alert>
			)}
			<PrimaryTitle fz={26}>{connection.name}</PrimaryTitle>
			<Text>
				One <Term id="engram">engram</Term>, one database: RRFlow keeps the records, the
				relations between them, and their vectors together in rrflowDB, and stores all of it
				with <Term id="rrflowKV">rrflowKV</Term>. The views below are different ways into
				the same data.
			</Text>
			<SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
				<LensCard
					icon={iconBook}
					title="Data models"
					purpose="Learn the database and browse its native tables."
					reading="Live schema and guided queries"
					onOpen={() => openLens("models")}
				/>
				<LensCard
					icon={iconRelation}
					title="Records & relations"
					purpose="What the engram knows and how it links together."
					reading={
						graph
							? `${formatCount(graphTotals(graph).records)} records in view · ${formatCount(graph.edges.length)} relations`
							: session
								? "Reading..."
								: "Open a native session to inspect"
					}
					onOpen={() => openLens("records")}
				/>
				<LensCard
					icon={iconTarget}
					title="Vectors"
					purpose="Find records with similar content by comparing their vectors."
					reading={
						collections
							? `${formatCount(collections.length)} collection${collections.length === 1 ? "" : "s"} · ${formatCount(namedVectors)} named vector${namedVectors === 1 ? "" : "s"}`
							: session
								? "Reading..."
								: "Open a native session to inspect"
					}
					onOpen={() => openLens("vectors")}
				/>
				<LensCard
					icon={iconMemory}
					title="Storage engine"
					purpose="How the data is kept safe on disk and quick in memory."
					reading={
						session
							? `${storageProfile === "rrflow_kv" ? "rrflowKV" : storageProfile} - live counters`
							: "Open a native session to inspect"
					}
					onOpen={() => openLens("storage")}
				/>
			</SimpleGrid>
			<GuideCards
				session={Boolean(session)}
				records={(graph?.nodes.length ?? 0) > 0}
			/>
			<ProjectOverview
				connected={Boolean(session)}
				onOpen={open}
			/>
		</>
	);
}
