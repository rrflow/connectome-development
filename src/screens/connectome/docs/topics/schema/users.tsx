import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";

export function DocsSchemaUsers({ language }: TopicProps) {
	const snippets = useMemo<Snippets>(
		() => ({
			cli: `

		-- Create a root user
		DEFINE USER username ON ROOT PASSWORD '123456' ROLES OWNER;
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
		await db.RawQuery(
			"""
				-- Create a root user
				DEFINE USER username ON ROOT PASSWORD '123456' ROLES OWNER;
			"""
		);
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
		[],
	);

	return (
		<Article title="Users">
			<div>
				<p>
					Managing permissions for system Users within RRFlow can be done using the roles
					OWNER, EDITOR, and VIEWER.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Users"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
