import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContextMenuProvider } from "mantine-contextmenu";
import type { PropsWithChildren } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useIsLight, useThemePreference } from "~/hooks/ui/theme";
import { CommandsProvider } from "~/providers/Commands";
import { ConfirmationProvider } from "~/providers/Confirmation";
import { FeatureFlagsProvider } from "~/providers/FeatureFlags";
import { bindQueryFocus } from "~/shared/util/platform/visibility";
import { CONNECTOME_THEME } from "~/shared/util/ui/mantine";
import { ScaffoldErrorHandler } from "./error";

// Every `refetchInterval` in the app stops while the window is hidden and
// fetches at once when it is shown again; app visibility has one owner.
bindQueryFocus(focusManager);

const QUERY_CLIENT = new QueryClient({
	defaultOptions: { queries: { refetchIntervalInBackground: false } },
});

export function Scaffold({ children }: PropsWithChildren) {
	const isLight = useIsLight();
	const colorScheme = useThemePreference();

	return (
		<FeatureFlagsProvider>
			<QueryClientProvider client={QUERY_CLIENT}>
				<MantineProvider
					withCssVariables
					theme={CONNECTOME_THEME}
					forceColorScheme={colorScheme}
				>
					<Notifications containerWidth={400} />

					<ErrorBoundary
						FallbackComponent={ScaffoldErrorHandler}
						onReset={() => location.reload()}
					>
						<ContextMenuProvider
							borderRadius="md"
							shadow={isLight ? "xs" : "0 6px 12px 2px rgba(0, 0, 0, 0.25)"}
							submenuDelay={250}
						>
							<ConfirmationProvider>
								<ModalsProvider>
									<CommandsProvider>{children}</CommandsProvider>
								</ModalsProvider>
							</ConfirmationProvider>
						</ContextMenuProvider>
					</ErrorBoundary>
				</MantineProvider>
			</QueryClientProvider>
		</FeatureFlagsProvider>
	);
}
