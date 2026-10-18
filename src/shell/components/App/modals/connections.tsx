import {
	Box,
	Button,
	Divider,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { Icon, iconServer } from "@surrealdb/ui";
import clsx from "clsx";
import { useState } from "react";
import { Entry, type EntryProps } from "~/components/Entry";
import { useBoolean } from "~/hooks/boolean";
import { useConnectionLabels, useConnectionOverview } from "~/hooks/connection";
import { useKeyNavigation } from "~/hooks/keys";
import { useConnectionAndView, useConnectionNavigator, useIntent } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { Y_SLIDE_TRANSITION } from "~/shared/util/helpers";
import { USER_ICONS } from "~/shared/util/user-icons";
import type { Connection } from "~/types";
import classes from "../style.module.scss";

export function ConnectionsModal() {
	const [isOpen, openedHandle] = useBoolean();

	const [search, setSearch] = useState("");
	const [label, setLabel] = useState("");
	const [connection] = useConnectionAndView();
	const navigateConnection = useConnectionNavigator();
	const labels = useConnectionLabels();

	const showLabels = labels.length > 0;
	const showAll = label === "";

	const { sandbox, isEmpty, userConnections } = useConnectionOverview({
		search,
		labels: showAll ? undefined : [label],
		labelMode: "any",
	});

	const activateConnection = useStable((con: Connection) => {
		navigateConnection(con.id);
		openedHandle.close();
	});

	const [handleKeyDown, selected] = useKeyNavigation([], () => {}, connection || undefined);

	useIntent("open-connections", ({ search }) => {
		if (search) {
			setSearch(search);
		}

		openedHandle.open();
	});

	return (
		<Modal
			opened={isOpen}
			onClose={openedHandle.close}
			transitionProps={{ transition: Y_SLIDE_TRANSITION }}
			centered={false}
			size="lg"
			onKeyDown={handleKeyDown}
			classNames={{
				content: classes.listingModal,
				body: classes.listingBody,
			}}
		>
			<Box p="lg">
				<Group
					mb="xs"
					gap="xs"
					c="bright"
				>
					<Icon
						path={iconServer}
						size="sm"
					/>
					<Text>Connections</Text>
				</Group>
				<TextInput
					flex={1}
					placeholder="Search for connections..."
					variant="unstyled"
					className={classes.listingSearch}
					autoFocus
					value={search}
					spellCheck={false}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</Box>

			<Divider mx="lg" />

			<ScrollArea.Autosize
				scrollbars="y"
				mah="calc(100vh - 225px)"
				mih={64}
			>
				<Stack
					gap="xl"
					p="lg"
				>
					{showLabels && (
						<Box
							pos="relative"
							h={42}
							mb={-12}
						>
							<ScrollArea
								pos="absolute"
								inset={0}
								scrollbars="x"
								type="scroll"
							>
								<Group
									gap={6}
									pb="sm"
									wrap="nowrap"
								>
									<Button
										size="xs"
										color="obsidian"
										className={clsx(
											classes.label,
											showAll && classes.labelActive,
										)}
										variant={showAll ? "filled" : "subtle"}
										onClick={() => setLabel("")}
									>
										All connections
									</Button>
									{labels.map((option, i) => {
										const isActive = option === label;

										return (
											<Button
												key={i}
												size="xs"
												color="obsidian"
												className={clsx(
													classes.label,
													isActive && classes.labelActive,
												)}
												variant={isActive ? "filled" : "subtle"}
												onClick={() => setLabel(option)}
											>
												{option}
											</Button>
										);
									})}
								</Group>
							</ScrollArea>
						</Box>
					)}

					{isEmpty && (
						<Text
							c="obsidian"
							ta="center"
							my="xl"
						>
							No connections found
						</Text>
					)}

					{sandbox && (
						<ConnectionEntry
							connection={sandbox}
							active={connection ?? ""}
							selected={selected}
							onClose={openedHandle.close}
							onConnect={activateConnection}
						/>
					)}

					{userConnections.length > 0 && (
						<Stack gap="xs">
							<Text
								fz="xl"
								fw={500}
								c="bright"
							>
								Connections
							</Text>
							{userConnections.map((con) => (
								<ConnectionEntry
									key={con.id}
									connection={con}
									active={connection ?? ""}
									selected={selected}
									onClose={openedHandle.close}
									onConnect={activateConnection}
								/>
							))}
						</Stack>
					)}
				</Stack>
			</ScrollArea.Autosize>
		</Modal>
	);
}

interface ConnectionEntryProps extends EntryProps {
	connection: Connection;
	active: string;
	selected: string;
	onConnect: (connection: Connection) => void;
	onClose: () => void;
}

function ConnectionEntry({
	connection,
	active,
	selected,
	onConnect,
	onClose,
	...other
}: ConnectionEntryProps) {
	const isActive = connection.id === active;

	const activate = useStable(() => {
		onConnect(connection);
	});

	return (
		<Entry
			key={connection.id}
			isActive={isActive}
			data-navigation-item-id={connection.id}
			className={clsx(
				classes.connection,
				selected === connection.id && classes.listingActive,
			)}
			onClick={activate}
			leftSection={<Icon path={USER_ICONS[connection.icon ?? 0]} />}
			{...other}
		>
			<Text truncate>{connection.name}</Text>
		</Entry>
	);
}
