import { Alert, Badge, Group, Stack, Text } from "@mantine/core";
import type { RrdSchemaView } from "~/rrflow/session";

function rule(value: unknown): { name: string; description: string } {
	if (value === undefined || value === null || value === "reject") {
		return {
			name: "REJECT",
			description:
				"Keep the connected record until its relationships are retired or corrected in the same transaction.",
		};
	}
	if (value === "cascade") {
		return {
			name: "CASCADE",
			description:
				"Retire affected relationships together with the connected record, starting at the first uncovered valid time.",
		};
	}
	return {
		name: "Unrecognized rule",
		description: "This client cannot explain the rule returned by the engine.",
	};
}

/** Presentation only: the authenticated engine schema owns these rules. */
export function RelationRules({
	schema,
	table,
}: {
	schema: RrdSchemaView | undefined;
	table: string;
}) {
	const declaration = schema?.tables.find((entry) => entry.name === table)?.properties.relation;
	if (!schema || !declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
		return (
			<Alert title="Relationship rules unavailable">
				The current relationship schema has not been read. No deletion rule is assumed.
			</Alert>
		);
	}
	const fields = declaration as Record<string, unknown>;
	return (
		<Stack gap="xs">
			<Text fw={600}>Deleting connected records</Text>
			{(
				[
					["Source record (from)", "on_delete_from"],
					["Target record (to)", "on_delete_to"],
				] as const
			).map(([label, field]) => {
				const policy = rule(fields[field]);
				return (
					<Stack
						key={field}
						gap={2}
					>
						<Group gap="xs">
							<Text
								size="sm"
								fw={600}
							>
								{label}
							</Text>
							<Badge variant="light">{policy.name}</Badge>
						</Group>
						<Text size="sm">{policy.description}</Text>
					</Stack>
				);
			})}
			<Text
				size="sm"
				c="slate"
			>
				Earlier knowledge remains queryable. These rules govern relationship records; they
				do not delete the other endpoint.
			</Text>
			<Text
				size="xs"
				c="slate"
			>
				Read from schema {schema.schema_revision ?? "unavailable"}, knowledge cursor{" "}
				{schema.known_at_cursor}.
			</Text>
		</Stack>
	);
}
