/**
 * Whether a person can see Connectome right now. This is the one owner of that
 * answer: everything that repeats on a timer asks here, so nothing keeps
 * working behind a hidden window.
 *
 * Two sources feed it. The page's own visibility (`document.visibilityState`)
 * covers a browser tab and any desktop webview that reports it. The desktop
 * window reports the rest (`src/adapter/desktop-visibility.ts`): gaining focus
 * proves the window is shown, and losing focus while minimized or hidden means
 * it is not. A window that only lost focus is still on screen, so it stays
 * visible and keeps refreshing.
 */
export interface Visibility {
	isVisible(): boolean;
	/** Hears every change; returns the function that stops listening. */
	subscribe(listener: (visible: boolean) => void): () => void;
	/** The page's own visibility changed. */
	pageChanged(visible: boolean): void;
	/** The desktop window was shown, or was minimized or hidden. */
	windowChanged(shown: boolean): void;
}

export function createVisibility(page = true, shown = true): Visibility {
	const listeners = new Set<(visible: boolean) => void>();
	const visible = () => page && shown;
	const change = (apply: () => void) => {
		const before = visible();
		apply();
		if (visible() !== before) {
			for (const listener of [...listeners]) listener(visible());
		}
	};
	return {
		isVisible: visible,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		pageChanged: (value) =>
			change(() => {
				page = value;
			}),
		windowChanged: (value) =>
			change(() => {
				shown = value;
			}),
	};
}

const page = typeof document === "undefined" ? undefined : document;

/** The app's visibility; the page side is wired here, the window side by the desktop adapter. */
export const appVisibility = createVisibility(page ? page.visibilityState !== "hidden" : true);

page?.addEventListener("visibilitychange", () => {
	appVisibility.pageChanged(page.visibilityState !== "hidden");
});

/**
 * Repeats `callback` every `intervalMs` while the app is visible. Nothing runs
 * while it is hidden; when it is shown again `callback` runs at once and the
 * interval starts over. Returns the function that stops it.
 */
export function visibleInterval(
	callback: () => void,
	intervalMs: number,
	visibility: Visibility = appVisibility,
): () => void {
	let timer: ReturnType<typeof setInterval> | undefined;
	const pause = () => {
		clearInterval(timer);
		timer = undefined;
	};
	const run = () => {
		pause();
		timer = setInterval(callback, intervalMs);
	};
	if (visibility.isVisible()) run();
	const unsubscribe = visibility.subscribe((visible) => {
		if (!visible) return pause();
		callback();
		run();
	});
	return () => {
		unsubscribe();
		pause();
	};
}

/**
 * How soon focus is asked for again. Not a setting: it limits nothing a person
 * sees or waits for. An editor takes focus on the first or second try once it
 * is laid out, and the asking ends the moment it has focus.
 */
export const FOCUS_RETRY_MS = 50;

/**
 * Asks `target` to take focus until it has it, trying again every
 * `intervalMs` while the app is visible; a hidden window never grants focus,
 * so nothing is tried behind one. Returns the function that gives up.
 */
export function focusWhenVisible(
	target: { focus(): void; readonly hasFocus: boolean },
	intervalMs = FOCUS_RETRY_MS,
	visibility: Visibility = appVisibility,
): () => void {
	const stop = visibleInterval(
		() => {
			target.focus();
			if (target.hasFocus) stop();
		},
		intervalMs,
		visibility,
	);
	return stop;
}

/** The part of TanStack Query's focus manager this module drives. */
interface FocusManager {
	setEventListener(setup: (setFocused: (focused?: boolean) => void) => () => void): void;
	setFocused(focused?: boolean): void;
}

/**
 * Makes this owner the only thing TanStack Query asks about focus. A query's
 * `refetchInterval` then stops fetching while the app is hidden, and every
 * mounted query that polls or is stale fetches at once when it is shown again.
 */
export function bindQueryFocus(focusManager: FocusManager, visibility: Visibility = appVisibility) {
	focusManager.setEventListener((setFocused) => visibility.subscribe(setFocused));
	focusManager.setFocused(visibility.isVisible());
}
