import {
	Accordion,
	Alert,
	NumberInput,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Text,
	TextInput,
} from "@mantine/core";
import { useState } from "react";
import { type ExternalBinding, providerNames } from "./binding";

/** The setup form for a path that points at an external vector service. */
export function ExternalPathEditor({
	binding,
	onChange,
}: {
	binding: ExternalBinding;
	onChange: (binding: ExternalBinding) => void;
}) {
	const endpoint = binding.endpoint;
	const [customProvider, setCustomProvider] = useState(
		Boolean(binding.provider_id && !providerNames.has(binding.provider_id)),
	);
	const isCustom =
		customProvider || Boolean(binding.provider_id && !providerNames.has(binding.provider_id));
	const credentialRequired = ["api", "subscription"].includes(endpoint.kind);
	const updateEndpoint = (change: Partial<typeof endpoint>) =>
		onChange({ ...binding, endpoint: { ...endpoint, ...change } });
	function updateProvider(provider_id: string) {
		onChange({
			...binding,
			provider_id,
			endpoint: {
				...endpoint,
				service_id:
					endpoint.service_id === binding.provider_id ? provider_id : endpoint.service_id,
			},
		});
	}
	return (
		<Stack gap="sm">
			<Alert
				color="blue"
				title="Connection setup only"
			>
				Save a reference to your service. Provider choices are setup labels; a working
				connector, connection check, import and sync are not available here yet.
			</Alert>
			<Select
				label="Service provider"
				placeholder="Choose a provider"
				searchable
				data={[
					...[...providerNames].map(([value, label]) => ({ value, label })),
					{ value: "__custom__", label: "Other provider" },
				]}
				value={isCustom ? "__custom__" : binding.provider_id || null}
				onChange={(value) => {
					if (!value) return;
					setCustomProvider(value === "__custom__");
					updateProvider(value === "__custom__" ? "" : value);
				}}
			/>
			{isCustom && (
				<TextInput
					label="Provider identifier"
					description="The identifier used by your provider configuration."
					value={binding.provider_id}
					onChange={(event) => updateProvider(event.currentTarget.value)}
				/>
			)}
			<TextInput
				label="Service address"
				placeholder="https://service.example/vectors"
				description="Use the endpoint URL without passwords, API keys, query strings or fragments."
				value={endpoint.endpoint.url}
				onChange={(event) =>
					updateEndpoint({ endpoint: { kind: "url", url: event.currentTarget.value } })
				}
			/>
			<SimpleGrid cols={{ base: 1, sm: 3 }}>
				{(["namespace", "index", "collection"] as const).map((field) => (
					<TextInput
						key={field}
						label={`${field[0].toUpperCase()}${field.slice(1)}`}
						value={binding[field] ?? ""}
						onChange={(event) =>
							onChange({ ...binding, [field]: event.currentTarget.value || null })
						}
					/>
				))}
			</SimpleGrid>
			<Text
				fz="xs"
				c="slate"
			>
				Enter at least one location name from your service. Use its exact spelling and case.
			</Text>
			<Paper
				withBorder
				p="sm"
			>
				<Stack gap="xs">
					<Switch
						label="Use a stored credential reference"
						description={
							credentialRequired
								? "Required for API and subscription connections. Only the reference is saved."
								: "Optional for this connection type. Only the reference is saved."
						}
						checked={endpoint.credential !== null}
						disabled={credentialRequired}
						onChange={(event) =>
							updateEndpoint({
								credential: event.currentTarget.checked
									? { provider: "", name: "" }
									: null,
							})
						}
					/>
					{endpoint.credential && (
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput
								label="Credential storage identifier"
								description="Where the existing credential is stored."
								value={endpoint.credential.provider}
								onChange={(event) =>
									updateEndpoint({
										credential: {
											provider: event.currentTarget.value,
											name: endpoint.credential?.name ?? "",
										},
									})
								}
							/>
							<TextInput
								label="Credential name"
								description="The stored name. Never paste the secret itself."
								value={endpoint.credential.name}
								onChange={(event) =>
									updateEndpoint({
										credential: {
											provider: endpoint.credential?.provider ?? "",
											name: event.currentTarget.value,
										},
									})
								}
							/>
						</SimpleGrid>
					)}
				</Stack>
			</Paper>
			<Accordion
				variant="separated"
				multiple
			>
				<Accordion.Item value="connection">
					<Accordion.Control>Advanced connection settings</Accordion.Control>
					<Accordion.Panel>
						<Stack gap="sm">
							<SimpleGrid cols={{ base: 1, sm: 2 }}>
								<Select
									label="Connection type"
									value={endpoint.kind}
									data={[
										{ value: "api", label: "Hosted API" },
										{ value: "subscription", label: "Subscription service" },
										{ value: "self_hosted", label: "Self-hosted service" },
										{ value: "local", label: "Local service" },
									]}
									onChange={(value) => {
										if (!value) return;
										const kind = value as typeof endpoint.kind;
										const remote = kind === "api" || kind === "subscription";
										updateEndpoint({
											kind,
											placement: remote ? null : (endpoint.placement ?? ""),
											credential: remote
												? (endpoint.credential ?? {
														provider: "",
														name: "",
													})
												: endpoint.credential,
										});
									}}
								/>
								<TextInput
									label="Service identifier"
									value={endpoint.service_id}
									onChange={(event) =>
										updateEndpoint({ service_id: event.currentTarget.value })
									}
								/>
							</SimpleGrid>
							{endpoint.placement !== null && (
								<TextInput
									label="Machine identifier"
									description="The configured machine for this local or self-hosted service."
									value={endpoint.placement}
									onChange={(event) =>
										updateEndpoint({ placement: event.currentTarget.value })
									}
								/>
							)}
							<Text
								fz="xs"
								c="slate"
								style={{ overflowWrap: "anywhere" }}
							>
								Provider ID: {binding.provider_id || "Not set"} · Binding ID:{" "}
								{endpoint.id}
							</Text>
						</Stack>
					</Accordion.Panel>
				</Accordion.Item>
				<Accordion.Item value="limits">
					<Accordion.Control>Resource limits</Accordion.Control>
					<Accordion.Panel>
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<NumberInput
								label="Declared memory (bytes)"
								min={1}
								max={64 * 1024 ** 4}
								allowDecimal={false}
								value={endpoint.footprint.memory_bytes}
								onChange={(value) =>
									updateEndpoint({
										footprint: {
											...endpoint.footprint,
											memory_bytes: Number(value),
										},
									})
								}
							/>
							<NumberInput
								label="Concurrent requests"
								min={1}
								max={65536}
								allowDecimal={false}
								value={endpoint.limits.max_concurrency}
								onChange={(value) =>
									updateEndpoint({
										limits: {
											...endpoint.limits,
											max_concurrency: Number(value),
										},
									})
								}
							/>
							<NumberInput
								label="Timeout (ms)"
								min={1}
								max={3_600_000}
								allowDecimal={false}
								value={endpoint.limits.timeout_ms}
								onChange={(value) =>
									updateEndpoint({
										limits: { ...endpoint.limits, timeout_ms: Number(value) },
									})
								}
							/>
							<NumberInput
								label="Maximum input (bytes)"
								min={1}
								max={64 * 1024 ** 3}
								allowDecimal={false}
								value={endpoint.limits.max_input_bytes}
								onChange={(value) =>
									updateEndpoint({
										limits: {
											...endpoint.limits,
											max_input_bytes: Number(value),
										},
									})
								}
							/>
						</SimpleGrid>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</Stack>
	);
}
