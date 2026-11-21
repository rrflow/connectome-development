import { Paper, Stack, Text } from "@mantine/core";
import type { Admission } from "~/rrflow/configuration";
import { PolicyDetails } from "./rules";

export function PolicyAdmission({ admission }: { admission: Admission | undefined }) {
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack gap="xs">
				<Text fw={600}>Policy used for this query</Text>
				{admission ? (
					<>
						<Text>
							Project policy revision{" "}
							{admission.project_policy?.selected_revision ??
								"0 (installation settings)"}
							; read through revision {admission.project_read_revision}.
						</Text>
						<Text>
							{admission.user
								? `User policy ${admission.user.source_id}, revision ${admission.user.selected_revision}; read through revision ${admission.user.read_revision}.`
								: "No user policy source was bound for this query."}
						</Text>
						<Text size="sm">
							Evaluated at {admission.evaluated_at_unix_ms} (Unix milliseconds). This
							stamp came back with the query result.
						</Text>
						<PolicyDetails
							value={admission}
							label="Exact admission stamp"
						/>
					</>
				) : (
					<Text>No policy admission stamp was returned by this engine.</Text>
				)}
			</Stack>
		</Paper>
	);
}
