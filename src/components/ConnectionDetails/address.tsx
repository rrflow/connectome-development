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
import { isHostLocal } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import { Connection, Protocol } from "~/types";
import { describeRrdError, RrdRuntimeClient } from "../../rrflow/runtime";

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
	const isRuntime = value.target === "runtime";
	const persisted = useConfigStore((state) =>
		state.connections.find((connection) => connection.id === value.id),
	);
	// A draft transport does not authorize starting an SSH process while typing.
	const sshHost =
		persisted &&
		persisted.runtimeSshHost === value.runtimeSshHost &&
		persisted.authentication.protocol === protocol &&
		persisted.authentication.hostname === hostname
			? persisted.runtimeSshHost
			: undefined;

	const protocols = useMemo(() => {
		const [remote, local] = fork(
			CONNECTION_PROTOCOLS.filter(
				(entry) => !isRuntime || entry.value === "http" || entry.value === "https",
			),
			(p) => p.remote,
		);

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
	}, [isRuntime]);

	const handleEndpointChange = useStable((e: React.ChangeEvent<HTMLInputElement>) => {
		onChange((draft) => {
			const content = e.target.value;
			const result = content.match(ENDPOINT_PATTERN);

			draft.authentication.hostname = content;

			if (result === null) {
				return;
			}

			const [, protocol, hostname] = result;
			const isValid =
				CONNECTION_PROTOCOLS.some((p) => p.value === protocol) &&
				(!isRuntime || protocol === "http" || protocol === "https");

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
		isError: statusFailed,
		error: statusError,
	} = useQuery({
		queryKey: [
			"connect-status",
			{ protocol, hostname, instance: value.runtimeInstance, sshHost },
		],
		enabled: !!protocol && !!hostname,
		retry: false,
		queryFn: async ({ signal }) => {
			await sleep(500);
			if (signal.aborted) throw new DOMException("Connection probe cancelled", "AbortError");
			await new RrdRuntimeClient(
				`${protocol}://${hostname}`,
				value.runtimeInstance,
				sshHost,
			).handshake();
			return true;
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
											statusFailed
												? describeRrdError(statusError)
												: "RRD public handshake verified; authentication is separate"
										}
									>
										<Indicator
											processing
											color={!statusFailed && status ? "green" : "red"}
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
