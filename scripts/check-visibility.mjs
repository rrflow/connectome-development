import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import { outputAllowance } from "../src/adapter/output-allowance.ts";
import {
	bindQueryFocus,
	createVisibility,
	visibleInterval,
} from "../src/shared/util/platform/visibility.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// TanStack Query arms no refetch interval when it believes it runs on a
// server, which it decides from `window` as it loads.
globalThis.window = globalThis;
const { focusManager, QueryClient, QueryObserver } = await import("@tanstack/react-query");

// One owner: visible only when the page and the window both are.
{
	const visibility = createVisibility();
	const heard = [];
	const stop = visibility.subscribe((visible) => heard.push(visible));
	visibility.windowChanged(true);
	assert.deepEqual(heard, [], "an unchanged answer is not announced");
	visibility.pageChanged(false);
	visibility.windowChanged(false);
	visibility.pageChanged(true);
	assert.equal(visibility.isVisible(), false, "a minimized window hides a visible page");
	visibility.windowChanged(true);
	assert.deepEqual(heard, [false, true]);
	stop();
	visibility.pageChanged(false);
	assert.deepEqual(heard, [false, true], "a listener that left hears nothing");
}

mock.timers.enable({ apis: ["setInterval", "setTimeout"] });

// A plain interval stops while hidden and runs at once when shown again.
{
	const visibility = createVisibility();
	let ticks = 0;
	const stop = visibleInterval(() => ticks++, 1000, visibility);
	mock.timers.tick(3000);
	assert.equal(ticks, 3);
	visibility.windowChanged(false);
	mock.timers.tick(60_000);
	assert.equal(ticks, 3, "nothing runs behind a hidden window");
	visibility.windowChanged(true);
	assert.equal(ticks, 4, "showing the window refreshes at once");
	mock.timers.tick(999);
	assert.equal(ticks, 4, "the interval starts over from the refresh");
	mock.timers.tick(1);
	assert.equal(ticks, 5);
	stop();
	mock.timers.tick(10_000);
	visibility.windowChanged(false);
	visibility.windowChanged(true);
	assert.equal(ticks, 5, "a stopped interval never runs again");

	const hidden = createVisibility(true, false);
	const stopHidden = visibleInterval(() => ticks++, 1000, hidden);
	mock.timers.tick(5000);
	assert.equal(ticks, 5, "an interval created while hidden waits to be shown");
	stopHidden();
}

// TanStack Query asks the same owner: a polling query stops fetching while
// hidden and fetches at once when shown.
{
	const visibility = createVisibility();
	bindQueryFocus(focusManager, visibility);
	const client = new QueryClient({
		defaultOptions: { queries: { refetchIntervalInBackground: false } },
	});
	client.mount();
	let fetches = 0;
	const observer = new QueryObserver(client, {
		queryKey: ["polled"],
		queryFn: async () => ++fetches,
		refetchInterval: 1000,
	});
	const unsubscribe = observer.subscribe(() => {});
	const settle = () => new Promise((done) => setImmediate(done));
	await settle();
	assert.equal(fetches, 1);
	mock.timers.tick(1000);
	await settle();
	assert.equal(fetches, 2, "a visible app polls");
	visibility.pageChanged(false);
	assert.equal(focusManager.isFocused(), false);
	for (let second = 0; second < 30; second++) {
		mock.timers.tick(1000);
		await settle();
	}
	assert.equal(fetches, 2, "a hidden app does not poll");
	visibility.pageChanged(true);
	await settle();
	assert.equal(fetches, 3, "showing the app fetches at once");
	unsubscribe();
	client.unmount();
}

mock.timers.reset();

// The serving console's output allowance refills by the clock, not by a timer.
{
	let now = 0;
	const limits = { outputBurstLines: 2, outputRefillMs: 500 };
	const take = outputAllowance(
		() => limits,
		() => now,
	);
	assert.deepEqual([take(), take(), take()], [true, true, false], "the burst is two lines");
	now = 499;
	assert.equal(take(), false);
	now = 1000;
	assert.deepEqual([take(), take(), take()], [true, true, false], "two lines came back");
	// The pace is the Serving settings, read for every line: a change applies at once.
	limits.outputBurstLines = 4;
	assert.deepEqual([take(), take(), take()], [true, true, false], "a larger burst is used");
	limits.outputRefillMs = 100;
	now = 1100;
	assert.equal(take(), true, "a faster refill is used");
	assert.match(
		readFileSync(join(root, "src/adapter/desktop.tsx"), "utf8"),
		/outputAllowance\(\(\) => useConfigStore\.getState\(\)\.settings\.serving\)/,
		"the serving console takes its pace from the Serving settings",
	);
}

// Every repeating timer in the app goes through the owner. A bare
// `setInterval` or a query that polls in the background would keep working
// behind a hidden window.
const OWNER = "src/shared/util/platform/visibility.ts";
const sources = (directory) =>
	readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return name === "vendor" ? [] : sources(path);
		return /\.tsx?$/.test(name) ? [path] : [];
	});
const offenders = [];
let polling = 0;
for (const path of sources(join(root, "src"))) {
	const file = relative(root, path).split(sep).join("/");
	const text = readFileSync(path, "utf8");
	polling += text.match(/\brefetchInterval:/g)?.length ?? 0;
	if (file !== OWNER && /\bsetInterval\s*\(/.test(text)) offenders.push(`${file}: setInterval`);
	if (/refetchIntervalInBackground:\s*true/.test(text)) {
		offenders.push(`${file}: refetchIntervalInBackground`);
	}
	if (file !== OWNER && /focusManager\.(setFocused|setEventListener)/.test(text)) {
		offenders.push(`${file}: a second focus owner`);
	}
}
assert.deepEqual(offenders, [], "every repeating timer pauses with app visibility");
assert.match(
	readFileSync(join(root, "src/components/Scaffold/index.tsx"), "utf8"),
	/bindQueryFocus\(focusManager\)/,
	"the app's query client is bound to app visibility",
);

console.log(
	`Visibility holds: one owner, no bare interval, ${polling} polling queries pause while hidden.`,
);
