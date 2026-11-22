import { Accordion, List, ScrollArea, Stack, Text } from "@mantine/core";
import { installationFacts } from "./installation-facts";

const PHASE_WORDS: Record<string, string> = {
	connect: "Connect",
	inventory: "Inventory, which lists your project's files",
	parse: "Parse, which reads your code",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The installation preview in plain words, with the exact plan one click away. */
export function InstallationSummary({ preview }: { preview: unknown }) {
	const facts = installationFacts(preview);
	return (
		<Stack gap="xs">
			<Text fw={700}>Your project database</Text>
			{facts.storageProfile === "rrflow_kv" && facts.storageRoot && (
				<Text
					size="sm"
					style={{ overflowWrap: "anywhere" }}
				>
					Creates a persistent RRFlow database at {facts.storageRoot}, inside this
					project. Records, relationships and vectors are stored by the engine in this
					database.
				</Text>
			)}
			{facts.loopbackOnly && (
				<Text size="sm">
					Install and open starts this project's RRFlow server on an available local port.
					Connectome opens it after authentication and readiness succeed.
					{facts.storageProfile === "rrflow_kv" &&
						" Stopping the server keeps its saved data."}
				</Text>
			)}
			{facts.projectLocator && (
				<Text
					size="sm"
					style={{ overflowWrap: "anywhere" }}
				>
					Project connection settings: {facts.projectLocator}.
				</Text>
			)}
			<Text fw={700}>Access and project files</Text>
			<List
				size="sm"
				spacing={4}
			>
				{facts.preservesProjectFiles && (
					<List.Item>Leaves your own files as they are.</List.Item>
				)}
				{facts.loopbackOnly && facts.networkEndpoints === 0 && (
					<List.Item>
						Serves only this computer and opens no outside connection.
					</List.Item>
				)}
				{facts.outsidePrograms === 0 && (
					<List.Item>The installation invokes no external project tools.</List.Item>
				)}
				{facts.aiProviders === 0 && (
					<List.Item>Turns on no AI provider and uploads nothing.</List.Item>
				)}
				{facts.permissions !== null && (
					<List.Item>
						Gives this computer's operator{" "}
						{plural(facts.permissions, "permission", "permissions")} in RRFlow.
					</List.Item>
				)}
				{facts.phases.length > 0 && (
					<List.Item>
						Available project setup steps, each requiring approval:{" "}
						{facts.phases.map((phase) => PHASE_WORDS[phase] ?? phase).join(", then ")}.
					</List.Item>
				)}
			</List>
			<Accordion variant="contained">
				{facts.createdPaths.length > 0 && (
					<Accordion.Item value="files">
						<Accordion.Control>
							Installation files and folders ({facts.createdPaths.length} paths)
						</Accordion.Control>
						<Accordion.Panel>
							{facts.instanceId && (
								<Text size="xs">Engine identity: {facts.instanceId}</Text>
							)}
							<Text size="sm">
								Configuration, credentials, database storage and installation
								recovery paths. This is not a count of database records. The exact
								plan below includes each path's ownership and removal rule.
							</Text>
							<List
								size="sm"
								style={{ overflowWrap: "anywhere" }}
							>
								{facts.createdPaths.map((path) => (
									<List.Item key={path}>{path}</List.Item>
								))}
							</List>
						</Accordion.Panel>
					</Accordion.Item>
				)}
				<Accordion.Item value="plan">
					<Accordion.Control>
						Show the exact plan
						{facts.planSha256 ? ` (${facts.planSha256.slice(0, 12)})` : ""}
					</Accordion.Control>
					<Accordion.Panel>
						<ScrollArea h={240}>
							<pre
								style={{
									whiteSpace: "pre-wrap",
									overflowWrap: "anywhere",
									fontSize: 12,
								}}
							>
								{JSON.stringify(preview, null, 2)}
							</pre>
						</ScrollArea>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</Stack>
	);
}
