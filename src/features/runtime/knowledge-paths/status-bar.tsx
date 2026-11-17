import { Alert, Badge, Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { useKnowledgeDraft } from "./use-knowledge-draft";

type Knowledge = ReturnType<typeof useKnowledgeDraft>;

function stateLabel({ draft, query, conflict, dirty }: Knowledge) {
	if (!draft) return query.isError ? "Load failed" : "Loading";
	if (conflict) return "Review needed";
	return dirty ? "Unsaved draft" : "Saved";
}

/** The sticky header: draft state, counts, refresh and save, and what to do next. */
export function StatusBar({ knowledge }: { knowledge: Knowledge }) {
	const { draft, conflict, dirty, busy, counts, hint, error, notice, save, refresh } = knowledge;
	return (
		<Paper
			withBorder
			p="sm"
			style={{
				position: "sticky",
				top: 0,
				zIndex: 5,
				background: "var(--mantine-color-body)",
			}}
		>
			<Stack gap="xs">
				<Group
					justify="space-between"
					gap="xs"
				>
					<Box style={{ flex: "1 1 12rem" }}>
						<Group gap="xs">
							<Badge color={conflict || dirty ? "yellow" : "gray"}>
								{stateLabel(knowledge)}
							</Badge>
							{draft && (
								<Text
									fz="xs"
									c="slate"
								>
									{counts.trees} {counts.trees === 1 ? "tree" : "trees"} ·{" "}
									{counts.paths} {counts.paths === 1 ? "path" : "paths"} ·{" "}
									{counts.native} RRFlow · {counts.external} external
								</Text>
							)}
						</Group>
					</Box>
					<Group gap="xs">
						<Button
							size="xs"
							variant="light"
							loading={refresh.isPending}
							disabled={!draft || busy}
							onClick={() => refresh.mutate()}
						>
							Refresh
						</Button>
						<Button
							size="sm"
							disabled={!draft || !dirty || busy || Boolean(conflict)}
							loading={save.isPending}
							onClick={() => save.mutate()}
						>
							Save changes
						</Button>
					</Group>
				</Group>
				<Text
					fz="xs"
					c="slate"
					role="status"
					aria-live="polite"
				>
					{hint}
				</Text>
				{error && (
					<Alert
						color="red"
						title="Changes need attention"
						role="alert"
					>
						{error}
					</Alert>
				)}
				{notice && (
					<Text
						fz="xs"
						role="status"
						aria-live="polite"
					>
						{notice}
					</Text>
				)}
			</Stack>
		</Paper>
	);
}
