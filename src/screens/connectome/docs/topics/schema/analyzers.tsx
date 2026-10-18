import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "~/components/Link";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";

export function DocsSchemaAnalyzers({ language }: TopicProps) {
	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
		DEFINE ANALYZER example_ngram TOKENIZERS class FILTERS ngram(1,3);
		`,
			js: `
		import { RRFlow } from '~/vendor/rrflow-client';

		const db = new RRFlow();

		import { RRFlow } from '~/vendor/rrflow-client';
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
				DEFINE ANALYZER example_ngram TOKENIZERS class FILTERS ngram(1,3);
			"""
		);
		`,
			java: `
		// Connect to a local endpoint
		RRFlowWebSocketConnection.connect(timeout)
		`,
			php: `
		$db->query("DEFINE ANALYZER example_ngram TOKENIZERS class FILTERS ngram(1,3)");
		`,
		}),
		[],
	);

	return (
		<Article title="Analyzers">
			<div>
				<p>
					Analyzers are used to enable full-text search on a table within your database.
					If you have any analyzers defined for a table, you can use the full-text search
					capabilities of RRFlow. Check out the section on{" "}
					<Link href="https://github.com/rrflow/connectome-development">
						{" "}
						Full Text Search for more information.
					</Link>
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Analyzers"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
