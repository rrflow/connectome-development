import { getCurrentWindow } from "@tauri-apps/api/window";
import { appVisibility } from "~/shared/util/platform/visibility";

/**
 * Feeds the desktop window's side of app visibility. Gaining focus proves the
 * window is shown. Losing focus does not hide it: only a window that is then
 * minimized or not visible counts as hidden. `onFocus` runs on every focus.
 */
export function followWindowVisibility(onFocus: () => void) {
	const window = getCurrentWindow();
	let latest = 0;

	window.listen("tauri://focus", () => {
		latest++;
		appVisibility.windowChanged(true);
		onFocus();
	});

	window.listen("tauri://blur", async () => {
		const event = ++latest;
		// A window whose state cannot be read is treated as shown.
		const hidden = await Promise.all([window.isMinimized(), window.isVisible()])
			.then(([minimized, visible]) => minimized || !visible)
			.catch(() => false);

		// A focus that arrived while the window was being asked wins.
		if (event === latest) appVisibility.windowChanged(!hidden);
	});
}
