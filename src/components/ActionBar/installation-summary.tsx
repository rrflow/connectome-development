import { Accordion, List, ScrollArea, Stack, Text } from "@mantine/core";
import { installationFacts } from "./installation-facts";

/** Paths listed before the rest are counted. */
const LISTED_PATHS = 4;

const PHASE_WORDS: Record<string, string> = {
	connect: "Connect",
	inventory: "Inventory, which lists your project's files",
	parse: "Parse, which reads your code",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The installation preview in plain words, with the exact plan one click away. */
export function InstallationSummary({ preview }: { preview: unknown }) {
	const facts = installationFacts(preview);
	const shown = facts.createdPaths.slice(0, LISTED_PATHS);
	const rest = facts.createdPaths.length - shown.length;
	return (
		<Stack gap="xs">
			<Text fw={700}>What installing does</Text>
			<List
				size="sm"
				spacing={4}
			>
				{facts.createdPaths.length > 0 && (
					<List.Item>
						Creates {plural(facts.createdPaths.length, "item", "items")} that RRFlow
						owns in this project: {shown.join(", ")}
						{rest > 0 ? ` and ${rest} more` : ""}.
					</List.Item>
				)}
				{facts.preservesProjectFiles && (
					<List.Item>Leaves your own files as they are.</List.Item>
				)}
				{facts.loopbackOnly && facts.networkEndpoints === 0 && (
					<List.Item>
						Serves only this computer and opens no outside connection.
					</List.Item>
				)}
				{facts.outsidePrograms === 0 && <List.Item>Runs no other program.</List.Item>}
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
						Then learns the project, when you approve each step:{" "}
						{facts.phases.map((phase) => PHASE_WORDS[phase] ?? phase).join(", then ")}.
					</List.Item>
				)}
			</List>
			<Accordion variant="contained">
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
