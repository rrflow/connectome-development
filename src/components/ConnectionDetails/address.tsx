import {
	Alert,
	Box,
	Button,
	Collapse,
	Group,
	Indicator,
	Loader,
	Select,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { fork, sleep } from "radash";
import { useMemo } from "react";
import { Updater } from "use-immer";
import { CONNECTION_PROTOCOLS } from "~/constants";
import { useStable } from "~/hooks/stable";
import { useIsLight } from "~/hooks/theme";
import { connectionUri, isHostLocal } from "~/shared/util/helpers";
import { Connection, Protocol } from "~/types";

const ENDPOINT_PATTERN = /^(.+?):\/\/(.+)$/;

export interface ConnectionAddressDetailsProps {
	value: Connection;
	withProtocol?: boolean;
	withHostname?: boolean;
	onChange: Updater<Connection>;
}

export function ConnectionAddressDetails({
	value,
	withProtocol,
	withHostname,
	onChange,
}: ConnectionAddressDetailsProps) {
	const isLight = useIsLight();

	const { protocol, hostname } = value.authentication;

	const protocols = useMemo(() => {
		const [remote, local] = fork(CONNECTION_PROTOCOLS, (p) => p.remote);

		return [
			{
				group: "Remote",
				items: remote,
			},
			{
				group: "Local",
				items: local,
			},
		];
	}, []);

	const handleEndpointChange = useStable((e: React.ChangeEvent<HTMLInputElement>) => {
		onChange((draft) => {
			const content = e.target.value;
			const result = content.match(ENDPOINT_PATTERN);

			draft.authentication.hostname = content;

			if (result === null) {
				return;
			}

			const [, protocol, hostname] = result;
			const isValid = CONNECTION_PROTOCOLS.some((p) => p.value === protocol);

			if (!isValid) {
				return;
			}

			draft.authentication.protocol = protocol as Protocol;
			draft.authentication.hostname = hostname;
		});
	});

	const isMemory = protocol === "mem";
	const isIndexDB = protocol === "indxdb";
	const isLocalhost = isHostLocal(hostname);
	const isSecure = protocol === "https" || protocol === "wss";

	const showProtocol = withProtocol ?? true;
	const showHostname = withHostname ?? true;
	const showSslNotice = isLocalhost && isSecure;
	const insecureVariant = protocol === "wss" ? "ws" : "http";

	const placeholder = isMemory
		? "Not applicable"
		: isIndexDB
			? "database_name"
			: "example.com:8000";

	const {
		data: status,
		isFetched: statusReady,
		isFetching: statusFetching,
	} = useQuery({
		queryKey: ["connect-status", { protocol, hostname }],
		enabled: !!protocol && !!hostname,
		queryFn: async ({ signal }) => {
			// The reachability probe still uses the inherited client (sprint 009 D2
			// replaces it with RRFlow readiness); it loads on demand so the pages
			// that open this form do not load that client.
			const { createRRFlow } = await import("~/screens/connectome/connection/rrflow");
			const test = await createRRFlow();

			await sleep(500);
			if (signal.aborted) return;

			try {
				await test.connect(connectionUri(protocol, hostname));
				return true;
			} catch {
				return false;
			} finally {
				test.close();
			}
		},
	});

	const showStatus = protocol !== "indxdb" && protocol !== "mem" && statusReady;

	return (
		<Box>
			<Group maw={500}>
				{showProtocol && (
					<Select
						data={protocols}
						maw={showHostname ? 112 : undefined}
						flex={1}
						value={protocol}
						onChange={(value) =>
							onChange((draft) => {
								const proto = value as Protocol;

								draft.authentication.protocol = proto;

								if (value === "mem" || value === "indxdb") {
									draft.authentication.mode = "none";
								}
							})
						}
					/>
				)}
				{showHostname && (
					<TextInput
						flex={1}
						name="hostname"
						value={hostname}
						disabled={isMemory}
						placeholder={placeholder}
						onChange={handleEndpointChange}
						rightSection={
							statusFetching ? (
								<Loader
									color="obsidian.5"
									size={16}
								/>
							) : (
								showStatus && (
									<Tooltip
										label={
											status
												? "RRFlow endpoint is reachable"
												: "RRFlow endpoint is not reachable"
										}
									>
										<Indicator
											processing
											color={status ? "green" : "red"}
										/>
									</Tooltip>
								)
							)
						}
					/>
				)}
			</Group>

			<Collapse in={showSslNotice}>
				<Alert
					title="SSL verification"
					color="orange"
					mt="md"
				>
					<Text>
						If you do not have SSL configured for your local database you may need to
						use the {insecureVariant.toUpperCase()} protocol to avoid connection issues.
					</Text>
					<Button
						size="xs"
						mt="md"
						color={isLight ? "obsidian.9" : "obsidian.0"}
						variant="light"
						onClick={() =>
							onChange((draft) => {
								draft.authentication.protocol = insecureVariant;
							})
						}
					>
						Switch to {insecureVariant.toUpperCase()} protocol
					</Button>
				</Alert>
			</Collapse>
		</Box>
	);
}
