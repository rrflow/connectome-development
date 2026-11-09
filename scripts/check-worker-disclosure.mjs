import assert from "node:assert/strict";
import { WorkerDraftCache } from "../src/rrflow/tasks.ts";

const draft = {
	attempt_id: "attempt-1",
	selection_attempt_id: "selection-1",
	binding_id: "worker",
	service_id: "local-fixture",
	content: "source-derived text",
	content_sha256: "a".repeat(64),
	response_sha256: "b".repeat(64),
	task_sha256: "c".repeat(64),
	configuration_sha256: "d".repeat(64),
	elapsed_ms: "1",
	source: null,
};

const cache = new WorkerDraftCache();
const visible = cache.begin(true);
assert.equal(cache.commit(visible, draft), true);
assert.equal(cache.read(), draft, "an authorized attempt can disclose its readback");

const denied = cache.begin(true);
assert.equal(cache.read(), null, "starting current access clears old source-derived text");
assert.equal(cache.commit(denied, null), true, "successful withheld readback stays empty");
assert.equal(cache.read(), null);

const restored = cache.begin(true);
assert.equal(cache.commit(restored, draft), true, "restored authority can read historical output");
assert.equal(cache.read(), draft);

const delayed = cache.begin(true);
cache.clear(); // context switch or a later denied read while IPC is in flight
assert.equal(cache.commit(delayed, draft), false, "late response cannot restore cleared output");
assert.equal(cache.read(), null);

const failed = cache.begin(true);
assert.equal(cache.read(), null, "failed budget or attempt access leaves no draft cached");
assert.equal(cache.commit(failed, null), true, "failure remains a withheld disclosure");
const lateFailure = cache.begin(true);
cache.clear(); // a read failure or context switch precedes its delayed reply
assert.equal(cache.commit(lateFailure, draft), false, "a result arriving after failure is stale");
assert.equal(cache.read(), null);

console.log("worker draft disclosure cache cases passed");
