import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { adapter } from "~/adapter";
import { MiniAdapter } from "~/adapter/mini";
import { SANDBOX } from "~/shared/config/constants";
import type { ViewPage } from "~/shared/types";
import { getConnectionById } from "~/shared/util/connection/connection";
import { IntentEvent } from "~/shared/util/platform/global-events";
import { consumeIntent, type IntentPayload, type IntentType } from "~/shared/util/platform/intents";
import { useEventSubscription } from "../state/event";
import { useStable } from "../state/stable";

export type Navigate = (to: string, options?: { replace?: boolean }) => void;

/**
 * Matches a path against a pattern of literal segments, `:name` parameters
 * and `*` wildcards. Returns the parameters, or `null` when it does not match.
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
	const expected = pattern.split("/").filter(Boolean);
	const actual = path.split("?")[0].split("/").filter(Boolean);
	if (expected.length !== actual.length) return null;
	const params: Record<string, string> = {};
	for (let index = 0; index < expected.length; index++) {
		const segment = expected[index];
		if (segment === "*") continue;
		if (segment.startsWith(":")) {
			params[segment.slice(1)] = decodeURIComponent(actual[index]);
		} else if (segment !== actual[index]) {
			return null;
		}
	}
	return params;
}

/**
 * Returns the current location and a function to navigate
 */
export function useAbsoluteLocation(): [string, Navigate] {
	const router = useRouter();
	const location = useRouterState({ select: (state) => state.location.pathname });
	const navigate = useStable<Navigate>((to, options) => {
		if (options?.replace) {
			router.history.replace(to);
		} else {
			router.history.push(to);
		}
	});

	return [location, navigate];
}

/**
 * Returns whether the pattern matches the current route, and its parameters
 */
export function useAbsoluteRoute(pattern: string): [boolean, Record<string, string>] {
	const [location] = useAbsoluteLocation();
	const params = matchPath(pattern, location);

	return [params !== null, params ?? {}];
}

/**
 * Returns whether any of the provided match patterns match the current route.
 */
export function useRouteMatcher(match: string[]) {
	const [location] = useAbsoluteLocation();

	return match.some((pattern) => matchPath(pattern, location) !== null);
}

/**
 * Returns the active connection and view
 */
export function useConnectionAndView() {
	const [match, params] = useAbsoluteRoute("/c/:connection/:view");

	if (adapter instanceof MiniAdapter) {
		return [SANDBOX, "query"] as const;
	}

	if (!match) {
		return [null, null] as const;
	}

	const connection = getConnectionById(params.connection);
	if (
		connection?.target === "control-plane" ||
		connection?.target === "diagnostics" ||
		connection?.target === "runtime"
	) {
		return [null, null] as const;
	}

	return [params.connection, params.view as ViewPage] as const;
}

/**
 * Returns a function used to navigate to a specific connection and optional view
 */
export function useConnectionNavigator() {
	const [, navigate] = useAbsoluteLocation();

	return useStable((connection: string, view?: ViewPage) => {
		const info = getConnectionById(connection);

		if (info) {
			if (info.target === "control-plane") {
				navigate(`/control/${info.id}`);
				return;
			}
			if (info.target === "diagnostics") {
				navigate(`/diagnostics/${info.id}`);
				return;
			}
			if (info.target === "runtime") {
				navigate(`/runtime/${info.id}`);
				return;
			}

			navigate(`/c/${info.id}/${view ?? "query"}`);
		}
	});
}

/**
 * Listen to the specified intent and invoke the handler when it is dispatched.
 *
 * @param type The intent type to listen for
 * @param handler The handler to invoke when the intent is dispatched
 */
export function useIntent(type: IntentType, handler: (payload: IntentPayload) => void) {
	const handleIntent = useStable(() => {
		for (let intent = consumeIntent(type); intent; intent = consumeIntent(type)) {
			handler(intent.payload || {});
		}
	});

	useEffect(() => handleIntent(), []);
	useEventSubscription(IntentEvent, handleIntent);
}

/**
 * Subscribe to the URL search parameters
 */
export function useSearchParams() {
	const search = useRouterState({ select: (state) => state.location.searchStr });

	return useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
}

/**
 * Accepts a function to invoke when the specified view
 * is activated.
 *
 * @param view The view to listen for
 * @param callback The function to invoke
 */
export function useViewFocus(view: ViewPage, callback: () => void, deps: any[] = []) {
	const [, activeView] = useConnectionAndView();
	const stable = useStable(callback);

	// NOTE - should this be useLayoutEffect?
	useEffect(() => {
		if (activeView === view) {
			stable();
		}
	}, [activeView, view, ...deps]);
}
