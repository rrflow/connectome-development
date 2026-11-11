import {
	Alert,
	Badge,
	Box,
	Code,
	Divider,
	Group,
	Loader,
	Paper,
	Select,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodeBlock } from "~/components/CodeBlock";
import { Label } from "~/components/Label";
import { Section } from "~/components/Section";
import { useSetting } from "~/hooks/config";
import {
	describeRrdError,
	type RrdOperation,
	type RrdOperationFamily,
	RrdRuntimeClient,
} from "~/rrflow/runtime";
import type { CodeLang } from "~/types";
import classes from "../style.module.scss";
import { EXAMPLE_LANGUAGES, exampleLanguage, operationExamples } from "./examples";

const AUTHENTICATION: Record<RrdOperation["authentication"], string> = {
	public: "No credentials",
	api_key: "API key",
	session_bearer: "Session",
};

interface FamilyGroup {
	family: RrdOperationFamily;
	operations: RrdOperation[];
}

/** Operations grouped by the catalogue's own families, in its order. */
function familyGroups(families: RrdOperationFamily[], operations: RrdOperation[]): FamilyGroup[] {
	return families
		.map((family) => ({
			family,
			operations: operations.filter((operation) => operation.family === family.family),
		}))
		.filter((group) => group.operations.length > 0);
}

const anchor = (operation: string) => `api-${operation}`;

/** Input that means the reader is moving the page themselves. */
const READER_INPUT = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/**
 * The engine's API reference: every public operation it serves, with the
 * family, summary and description its operation catalogue owns, and a code
 * example in each language RRFlow ships a client for. The catalogue is public,
 * so the reference reads without a session.
 */
export function ApiReference({ endpoint, instance }: { endpoint: string; instance?: string }) {
	const catalogue = useQuery({
		queryKey: ["rrd-operation-catalogue", endpoint],
		queryFn: () => new RrdRuntimeClient(endpoint, instance).catalogue(),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
	const [saved, setSaved] = useSetting("behavior", "docsLanguage");
	const language = exampleLanguage(saved);
	const [active, setActive] = useState<string | null>(null);

	const operations = useMemo(
		() =>
			catalogue.data
				? [
						...catalogue.data.endpoints,
						// The WebSocket endpoint is read like the others; its example
						// is the upgrade request.
						...catalogue.data.websocket_endpoints.map(
							(endpoint): RrdOperation => ({
								operation: endpoint.operation,
								method: "get",
								path: endpoint.path,
								authentication: endpoint.authentication,
								mutation: false,
								action: { source: "fixed", action: endpoint.connect_action },
								request_type: "WebSocketFrame",
								response_type: endpoint.frame_type,
								family: endpoint.family,
								summary: endpoint.summary,
								description: endpoint.description,
							}),
						),
					]
				: [],
		[catalogue.data],
	);
	const groups = useMemo(
		() => (catalogue.data ? familyGroups(catalogue.data.families, operations) : []),
		[catalogue.data, operations],
	);
	const target = { endpoint, instance: instance || "<instance>" };

	// The topic list follows the article in view: the last article whose top
	// has reached the sticky topic list, or the first article above them all.
	// A jump keeps its topic until the reader scrolls, because an article near
	// the end can never reach the top.
	const topics = useRef<HTMLDivElement>(null);
	const jumped = useRef(false);
	useEffect(() => {
		if (groups.length === 0) return;
		let frame = 0;
		const follow = () => {
			frame = 0;
			if (jumped.current) return;
			const line = (topics.current?.getBoundingClientRect().top ?? 0) + 8;
			let current: string | null = null;
			for (const article of document.querySelectorAll("[data-operation]")) {
				if (current !== null && article.getBoundingClientRect().top > line) break;
				current = article.getAttribute("data-operation");
			}
			setActive(current);
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(follow);
		};
		const release = () => {
			jumped.current = false;
			schedule();
		};
		follow();
		const scrolling = { capture: true, passive: true } as const;
		document.addEventListener("scroll", schedule, scrolling);
		window.addEventListener("resize", schedule);
		for (const input of READER_INPUT) document.addEventListener(input, release, scrolling);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("scroll", schedule, scrolling);
			window.removeEventListener("resize", schedule);
			for (const input of READER_INPUT)
				document.removeEventListener(input, release, scrolling);
		};
	}, [groups]);

	// The active topic stays in the list's own view. Only the list scrolls:
	// scrollIntoView would also move the page.
	useEffect(() => {
		const list = topics.current;
		const topic = active && list?.querySelector(`[data-topic="${active}"]`);
		if (!list || !topic) return;
		const bounds = list.getBoundingClientRect();
		const item = topic.getBoundingClientRect();
		if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
		else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
	}, [active]);

	const jump = (operation: string) => {
		jumped.current = true;
		setActive(operation);
		document
			.getElementById(anchor(operation))
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<Section
			title="API reference"
			description="Every public operation this engine serves, read from its own operation catalogue, with an example for each RRFlow client."
			rightSection={
				<Select
					aria-label="Example language"
					data={EXAMPLE_LANGUAGES.map(({ value, label }) => ({ value, label }))}
					value={language}
					onChange={(next) => next && setSaved(next as CodeLang)}
					allowDeselect={false}
					w={180}
				/>
			}
		>
			{catalogue.isPending && (
				<Group gap="xs">
					<Loader size="xs" />
					<Text c="slate">Reading the operation catalogue...</Text>
				</Group>
			)}
			{catalogue.isError && (
				<Alert
					color="red"
					title="The operation catalogue could not be read"
				>
					{describeRrdError(catalogue.error)}
				</Alert>
			)}
			{catalogue.data && (
				<Group
					align="flex-start"
					wrap="nowrap"
					gap="xl"
				>
					<Box
						ref={topics}
						component="nav"
						aria-label="API topics"
						w={260}
						miw={260}
						className={classes.apiTopics}
					>
						<Stack gap="md">
							{groups.map(({ family, operations: members }) => (
								<Box key={family.family}>
									<Label>{family.title}</Label>
									<Stack gap={2}>
										{members.map((operation) => (
											<UnstyledButton
												key={operation.operation}
												onClick={() => jump(operation.operation)}
												className={classes.apiTopic}
												data-topic={operation.operation}
												data-active={
													active === operation.operation || undefined
												}
												aria-current={
													active === operation.operation
														? "true"
														: undefined
												}
												title={`${operation.summary} (${operation.operation})`}
											>
												<Text
													fz="sm"
													truncate
												>
													{operation.summary}
												</Text>
											</UnstyledButton>
										))}
									</Stack>
								</Box>
							))}
						</Stack>
					</Box>
					<Stack
						flex={1}
						miw={0}
						gap="xl"
					>
						<Text
							fz="sm"
							c="slate"
						>
							{operations.length} operations in {groups.length} families, protocol{" "}
							{catalogue.data.protocol} v{catalogue.data.protocol_version}.
						</Text>
						{groups.map(({ family, operations: members }) => (
							<Stack
								key={family.family}
								gap="lg"
							>
								<Box>
									<Text
										fw={700}
										fz="xl"
										c="bright"
									>
										{family.title}
									</Text>
									<Text c="slate">{family.description}</Text>
								</Box>
								{members.map((operation) => (
									<Paper
										key={operation.operation}
										id={anchor(operation.operation)}
										data-operation={operation.operation}
										p="lg"
										className={classes.apiOperation}
									>
										<Group
											align="flex-start"
											wrap="nowrap"
											gap="xl"
										>
											<Stack
												flex={1}
												miw={0}
												gap="sm"
											>
												<Group gap="xs">
													<Text
														fw={700}
														fz="lg"
														c="bright"
													>
														{operation.summary}
													</Text>
												</Group>
												<Group gap="xs">
													<Badge variant="filled">
														{operation.method.toUpperCase()}
													</Badge>
													<Code>{operation.path}</Code>
												</Group>
												<Text>{operation.description}</Text>
												<Group gap="xs">
													<Badge variant="light">
														{AUTHENTICATION[operation.authentication]}
													</Badge>
													<Badge
														variant="light"
														color={
															operation.mutation ? "orange" : "green"
														}
													>
														{operation.mutation
															? "Changes state"
															: "Read only"}
													</Badge>
													<Badge
														variant="outline"
														color="slate"
													>
														{operation.action.action}
													</Badge>
												</Group>
												<Divider />
												<Text fz="sm">
													<Text
														span
														c="slate"
													>
														Operation{" "}
													</Text>
													<Code>{operation.operation}</Code>
													<Text
														span
														c="slate"
													>
														{" "}
														· request{" "}
													</Text>
													<Code>{operation.request_type}</Code>
													<Text
														span
														c="slate"
													>
														{" "}
														· response{" "}
													</Text>
													<Code>{operation.response_type}</Code>
												</Text>
											</Stack>
											<Box
												w="45%"
												miw={0}
											>
												<CodeBlock
													title={
														EXAMPLE_LANGUAGES.find(
															(entry) => entry.value === language,
														)?.title
													}
													value={
														operationExamples(operation, target)[
															language
														]
													}
												/>
											</Box>
										</Group>
									</Paper>
								))}
							</Stack>
						))}
					</Stack>
				</Group>
			)}
		</Section>
	);
}
