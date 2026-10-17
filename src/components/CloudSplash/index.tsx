import { Button, Center, Group, Image, Stack, Text } from "@mantine/core";
import { Icon, iconChevronRight, iconOpen, pictoSDBCloud } from "@surrealdb/ui";
import { adapter } from "~/adapter";
import { openCloudAuthentication } from "~/cloud/api/auth";
import { useThemeImage } from "~/hooks/theme";
import logoDarkImg from "~/shared/assets/images/dark/cloud-logo.svg";
import logoLightImg from "~/shared/assets/images/light/cloud-logo.svg";
import { useCloudStore } from "~/stores/cloud";

export function CloudSplash() {
	const authState = useCloudStore((s) => s.authState);

	const logoImg = useThemeImage({
		light: logoLightImg,
		dark: logoDarkImg,
	});

	return (
		<Center
			h="90%"
			pos="relative"
		>
			<Stack align="center">
				<Image
					src={pictoSDBCloud}
					alt=""
					maw={125}
				/>
				<Image
					src={logoImg}
					alt="RRFlow Cloud"
					maw={450}
					my="xl"
				/>
				<Text
					fz="xl"
					w="100%"
					maw={520}
					ta="center"
				>
					RRFlow Cloud redefines the database experience, offering the power and
					flexibility of RRFlow without the pain of managing infrastructure.
				</Text>
				<Group
					mt={42}
					w="100%"
					maw={450}
				>
					<Button
						flex={1}
						variant="gradient"
						onClick={openCloudAuthentication}
						rightSection={<Icon path={iconChevronRight} />}
						loading={authState === "loading"}
					>
						Sign in
					</Button>
					<Button
						flex={1}
						color="obsidian"
						variant="light"
						rightSection={<Icon path={iconOpen} />}
						onClick={() =>
							adapter.openUrl("https://github.com/EonsofStupid/connectome")
						}
					>
						Learn more
					</Button>
				</Group>
			</Stack>
		</Center>
	);
}
