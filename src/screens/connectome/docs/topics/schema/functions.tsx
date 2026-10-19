import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";

export function DocsSchemaFunctions({ language }: TopicProps) {
	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
		-- It is necessary to prefix the name of your function with "fn::"
		-- This indicates that it's a custom function
		DEFINE FUNCTION fn::greet($name: string) {
			RETURN "Hello, " + $name + "!";
		};

		-- Returns: "Hello, BOB!"
		RETURN fn::greet("BOB");
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
					-- It is necessary to prefix the name of your function with "fn::"
					-- This indicates that it's a custom function
					DEFINE FUNCTION fn::greet($name: string) {
						RETURN "Hello, " + $name + "!";
					}

					-- Returns: "Hello, BOB!"
					RETURN fn::greet("BOB");
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
		<Article title="Functions">
			<div>
				<p>
					Functions are a way to encapsulate logic in a database. To define functions you
					have to be a system user (namespace, database, or root). They can be used to
					perform calculations, manipulate data, or perform other operations. In RRFlow
					functions can be written just as you would in your programming language of
					choice.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Functions"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
