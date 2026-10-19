import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";
import { useDocsTable } from "../../hooks/table";

export function DocsTablesManageIndexes({ language, topic }: TopicProps) {
	const _table = useDocsTable();

	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
			rrflow sql --endpoint ${topic.extra?.connectionUri} --namespace ${topic.extra?.namespace} --database ${topic.extra?.database}
		`,
			js: `
		import { RRFlow } from "../../../../../rrflow/client/native";

		const db = new RRFlow();

		import { RRFlow } from "../../../../../rrflow/client/native";
		const db = new RRFlow();
		await db.connect('<the actual address of the connection>/rpc', {
			namespace: '<the actual ns of the connection>',
			database: '<the action db of the connection>'
		});

		`,
			rust: `
		//Connect to a local endpoint
		DB.connect::<Ws>("127.0.0.1:8000").await?;
		//Connect to a remote endpoint
		DB.connect::<Wss>("127.0.0.1:8000").await?;
		`,
			py: `
		# Connect to a local endpoint
		db = RRFlow()
		await db.connect('http://127.0.0.1:8000/rpc')
		# Connect to a remote endpoint
		db = RRFlow()
		await db.connect('http://127.0.0.1:8000/rpc')
		`,
			go: `
		// Connect to a local endpoint
		rrflow.New("ws://localhost:8000/rpc");
		// Connect to a remote endpoint
		rrflow.New("ws://127.0.0.1:8000/rpc");
		`,
			csharp: `
		await db.Connect();
		`,
			java: `
		// Connect to a local endpoint
		RRFlowWebSocketConnection.connect(timeout)
		`,
			php: `
		// Connect to a local endpoint
		$db = new RRFlow();
		`,
		}),
		[topic.extra],
	);

	return (
		<Article title="Manage Indexes">
			<div>
				<p>
					Indexes are used to speed up the retrieval of records from a table. They are
					created on columns in a table.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Manage Indexes"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
