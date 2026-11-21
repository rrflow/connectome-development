import { Code, Table, Text, TextInput } from "@mantine/core";
import type { EffectivePolicy, Settings } from "~/rrflow/configuration";
import { settingKeys, settingLabels, updateRule } from "~/rrflow/configuration";

export function PolicyRules({
	settings,
	onChange,
	disabled,
}: {
	settings: Settings;
	onChange: (value: Settings) => void;
	disabled: boolean;
}) {
	return (
		<Table.ScrollContainer minWidth={660}>
			<Table>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Setting</Table.Th>
						<Table.Th>Minimum required</Table.Th>
						<Table.Th>Maximum allowed</Table.Th>
						<Table.Th>Preferred amount</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{settingKeys.map((key) => (
						<Table.Tr key={key}>
							<Table.Td>
								<Text
									size="sm"
									fw={600}
								>
									{settingLabels[key][0]}
								</Text>
								<Text
									size="xs"
									c="dimmed"
								>
									{settingLabels[key][1]}
								</Text>
							</Table.Td>
							{(["minimum", "maximum", "preference"] as const).map((field) => (
								<Table.Td key={field}>
									<TextInput
										aria-label={`${settingLabels[key][0]} ${field}`}
										inputMode="numeric"
										placeholder="Inherit"
										disabled={disabled}
										value={settings[key]?.[field] ?? ""}
										onChange={(event) => {
											const value = event.currentTarget.value;
											if (/^\d*$/.test(value))
												onChange(updateRule(settings, key, field, value));
										}}
									/>
								</Table.Td>
							))}
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}

export function EffectiveValues({ values }: { values: EffectivePolicy["values"] }) {
	return (
		<Table.ScrollContainer minWidth={700}>
			<Table>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Setting</Table.Th>
						<Table.Th>Next request</Table.Th>
						<Table.Th>Allowed range</Table.Th>
						<Table.Th>Selected from</Table.Th>
						<Table.Th>User rule</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{settingKeys.map((key) => {
						const value = values[key];
						if (!value) return null;
						const rule = value.user_rule;
						return (
							<Table.Tr key={key}>
								<Table.Td>{settingLabels[key][0]}</Table.Td>
								<Table.Td>
									{value.value} {value.unit}
								</Table.Td>
								<Table.Td>
									{value.minimum} – {value.maximum}
								</Table.Td>
								<Table.Td>{value.source.replaceAll("_", " ")}</Table.Td>
								<Table.Td>
									{rule
										? `min ${rule.minimum ?? "unset"}; max ${rule.maximum ?? "unset"}; preferred ${rule.preference ?? "unset"}`
										: "No user rule"}
								</Table.Td>
							</Table.Tr>
						);
					})}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}

export function PolicyDetails({
	value,
	label = "Policy evidence",
}: {
	value: unknown;
	label?: string;
}) {
	return (
		<details>
			<summary>{label}</summary>
			<Code block>{JSON.stringify(value, null, 2)}</Code>
		</details>
	);
}
