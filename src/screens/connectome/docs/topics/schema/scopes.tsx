import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";

export function DocsSchemaScopes({ language }: TopicProps) {
	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
		-- Enable scope authentication directly in RRFlow
		DEFINE SCOPE account SESSION 24h
		SIGNUP (
			CREATE user SET email = $email, pass = crypto::argon2::generate($pass)
		)
		SIGNIN (
			SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)
		);
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
				-- Enable scope authentication directly in RRFlow
				DEFINE SCOPE account SESSION 24h
				SIGNUP (
					CREATE user SET email = $email, pass = crypto::argon2::generate($pass)
				)
				SIGNIN (
					SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)
				);
			"""
		);
		`,
			java: `
		// Connect to a local endpoint
		RRFlowWebSocketConnection.connect(timeout)
		`,
			php: `
		$db->query('
			-- Enable scope authentication directly in RRFlow
			DEFINE SCOPE account SESSION 24h
			SIGNUP (
				CREATE user SET email = $email, pass = crypto::argon2::generate($pass)
			)
			SIGNIN (
				SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)
			);
		');
		`,
		}),
		[],
	);

	return (
		<Article title="Scopes">
			<div>
				<p>
					Within RRFlow, accesses are a way to manage access to data. They are defined
					within the schema and can be used to restrict access to certain parts of the
					data. To access data within an access, you must first sign in with the
					appropriate credentials.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Scopes"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
