import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/features/documentation/content/components";
import type { Snippets, TopicProps } from "~/features/documentation/content/types";

export function DocsAuthTokens({ language }: TopicProps) {
	const snippets = useMemo<Snippets>(
		() => ({
			js: `
			await db.authenticate("...");
		`,
			rust: `
			use rrflow::opt::auth::Jwt;

			let jwt = Jwt::from("...");
			db.authenticate(jwt).await?;
		`,
			py: `
		db.authenticate("jwt")
		`,
			go: `
		db.Authenticate("jwt")
		`,
			csharp: `
		// Sign in or sign up as a scoped user
		Jwt jwt = await db.SignUp(authParams);

		await db.Authenticate(jwt);
		`,
			java: `
		// Connect to a local endpoint
		driver.authenticate(token)
		`,
			php: `
		$db->authenticate($token);
		`,
		}),
		[],
	);

	return (
		<Article title="Tokens">
			<div>
				<p>
					When signin in or up to RRFlow, you receive a JWT token. This JWT, for the time
					it lives, can be used to authenticate future sessions to RRFlow. As an
					integrator, you are expected yourself to persist this token, if you need to
					retrieve it at a later moment in time.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Authenticate with an issued token"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
