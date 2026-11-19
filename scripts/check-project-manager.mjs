import assert from "node:assert/strict";
import {
	beginAction,
	endAction,
	opensWhenStarted,
	projectRows,
	removalStatement,
	rowControls,
} from "../src/rrflow/project-manager.ts";

const engram = (project) => ({
	project,
	endpoint: "http://127.0.0.1:4100",
	instance: "instance-a",
	credential_path: `${project}/.rrflow/credentials/local-operator.json`,
	installed: false,
	origin: "connectome",
});
const instance = (project, state, extra = {}) => ({
	project,
	state,
	origin: "connectome",
	detail: "",
	revision: 1,
	...(state === "ready" ? { engram: engram(project) } : {}),
	...extra,
});

// Many projects, every one listed once, with its real state. There is no
// number at which a project stops being listed or startable.
const saved = Array.from({ length: 40 }, (_, index) => ({
	project: `/work/saved-${index}`,
	name: `Saved ${index}`,
}));
const instances = Object.fromEntries(
	saved.map(({ project }) => [project, instance(project, "ready")]),
);
instances["/work/tracked"] = instance("/work/tracked", "starting");
instances["/work/gone"] = instance("/work/gone", "stopped");
const rows = projectRows(saved, [{ project: "/work/added", name: "added" }], instances);
assert.equal(rows.length, 42, "saved, added and tracked projects are all listed");
assert.equal(new Set(rows.map((row) => row.project)).size, rows.length);
assert.ok(rows.slice(0, 40).every((row) => row.instance.state === "ready"));
assert.ok(
	rows
		.slice(0, 40)
		.every((row) => rowControls(row.instance, undefined, false).stop === "enabled"),
	"forty running projects can each still be stopped",
);
const added = rows.find((row) => row.project === "/work/added");
assert.equal(added.instance.state, "stopped", "a project appears as soon as it is added");
assert.equal(rowControls(added.instance, undefined, false).start, "enabled");
assert.equal(rows.find((row) => row.project === "/work/tracked").name, "tracked");
assert.ok(!rows.some((row) => row.project === "/work/gone"), "a stopped stranger is not listed");
assert.equal(
	projectRows(saved, [saved[0]], instances).length,
	41,
	"a project that is both saved and added has one row",
);

// One row's action never changes what another row offers.
const a = "/work/saved-0";
const b = "/work/saved-1";
let activity = beginAction({}, a, "stopping");
assert.deepEqual(rowControls(instances[a], activity[a], false), {
	open: "disabled",
	stop: "disabled",
	start: "hidden",
	retry: "hidden",
	dismiss: "hidden",
	remove: "disabled",
	removeBlocked: undefined,
	limitation: undefined,
});
assert.deepEqual(rowControls(instances[b], activity[b], false), {
	open: "enabled",
	stop: "enabled",
	start: "hidden",
	retry: "hidden",
	dismiss: "hidden",
	remove: "enabled",
	removeBlocked: undefined,
	limitation: undefined,
});

// A failure stays on the row it belongs to, until that row acts again.
activity = endAction(activity, a, "the engine did not stop");
assert.deepEqual(activity, { [a]: { error: "the engine did not stop" } });
assert.equal(rowControls(instances[a], activity[a], false).stop, "enabled");
activity = beginAction(activity, b, "opening");
assert.equal(activity[a].error, "the engine did not stop", "another row keeps its own error");
activity = endAction(activity, b);
assert.deepEqual(Object.keys(activity), [a]);
assert.deepEqual(beginAction(activity, a, "starting")[a], { action: "starting" });

// Several starts never move the person several times: only the start asked
// for last opens its project, and only from where it was asked.
const asked = { project: b, from: "/runtime/one" };
assert.equal(opensWhenStarted(asked, b, "/runtime/one"), true);
assert.equal(opensWhenStarted(asked, a, "/runtime/one"), false, "an earlier start only lists");
assert.equal(opensWhenStarted(asked, b, "/runtime/two"), false, "the person moved elsewhere");
assert.equal(opensWhenStarted(undefined, b, "/runtime/one"), false, "nothing is waited for");

// Each state offers what that project can do.
const stopped = rowControls(instance("/p", "stopped"), undefined, false);
assert.deepEqual([stopped.start, stopped.open, stopped.remove], ["enabled", "hidden", "enabled"]);
assert.equal(
	rowControls(instance("/p", "stopped"), undefined, true).start,
	"hidden",
	"a project under review is installed from its review",
);
const failed = rowControls(instance("/p", "failed", { stage: "serve" }), undefined, false);
assert.deepEqual([failed.retry, failed.dismiss, failed.remove], ["enabled", "enabled", "enabled"]);
const starting = rowControls(instance("/p", "starting"), undefined, false);
assert.equal(starting.remove, "disabled");
assert.match(starting.removeBlocked, /finished starting/);
const elsewhere = rowControls(instance("/p", "ready", { origin: "elsewhere" }), undefined, false);
assert.equal(elsewhere.stop, "hidden", "an instance Connectome did not start is never stopped");
assert.equal(elsewhere.open, "enabled");
assert.equal(elsewhere.remove, "enabled");
assert.match(elsewhere.limitation, /cannot stop it yet/);

// Removing says exactly what happens to the engine, the list and the files.
const statement = (row) => removalStatement(row, "D:\\work\\notes").join("\n");
const owned = statement({ project: "/p", name: "notes", instance: instance("/p", "ready") });
assert.match(owned, /Its engine, which Connectome started, is stopped\./);
assert.match(owned, /"notes" is removed from Connectome's project list/);
assert.match(owned, /saved connection is deleted/);
assert.match(owned, /Nothing in D:\\work\\notes is deleted/);
assert.match(owned, /its \.rrflow folder and its data stay where they are/);
const outside = statement({
	project: "/p",
	name: "notes",
	instance: instance("/p", "ready", { origin: "elsewhere" }),
});
assert.match(outside, /started outside Connectome and keeps running/);
assert.doesNotMatch(outside, /is stopped\./);
const idle = statement({ project: "/p", name: "notes", instance: instance("/p", "stopped") });
assert.match(idle, /No engine is running for this project, so nothing is stopped\./);
assert.match(idle, /Nothing in D:\\work\\notes is deleted/);

console.log(
	"Project manager holds: every project listed, rows independent, one start opens, removal stated exactly.",
);
