import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const entry = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConfigStore } from "/src/shell/stores/config.tsx";
import { WorkbenchPanel } from "/src/screens/connectome/pages/RuntimeConnection/workbench.tsx";
const action = (name) => ({id:name, name, label:name});
const event = (id, actions) => ({id,kind:"factoid",mode:"interactive",title:id,body:"",component:"card",requiresOperatorSignoff:true,triggers:[],actions,catamorphismTarget:"clyffy",catamorphismNote:""});
const template = {id:"template",name:"Test",description:"",schema:"",skills:[],researchReferences:[],minimumRequirements:[],filePatterns:[],folderPatterns:[],createdAtUnixMs:1,updatedAtUnixMs:1,steps:[],learningEvents:[event("refresh event",[action("refresh-storage-signals"),action("refresh-governed-flights")]),event("capture event",[action("capture-runtime-receipt")])]};
useConfigStore.getState().addConnection({id:"a", name:"A", workbench:{workbenches:[{id:"w",name:"W",description:"",createdAtUnixMs:1,updatedAtUnixMs:1}],activeWorkbenchId:"w",receipts:[],templates:[template],linkedPaths:[],remoteSources:[]}});
window.eventControls = {calls:[], defer:false, release:null, fail:false, profile:()=>useConfigStore.getState().connections.find(c=>c.id==="a").workbench};
window.eventControls.schemaDefer = false;
window.eventControls.schemaRelease = null;
window.eventControls.schemaFail = false;
window.eventControls.changeEvent = (restore) => {
  const store = useConfigStore.getState();
  const workbench = store.connections.find(c=>c.id==="a").workbench;
  const next = restore ? template : {...template, learningEvents:template.learningEvents.map(e=>e.id==="capture event"?{...e,body:"changed"}:e)};
  store.updateConnection({id:"a",workbench:{...workbench,templates:[next]}});
};
window.eventControls.clearWorkbenches = () => {
  const store = useConfigStore.getState();
  const workbench = store.connections.find(c=>c.id==="a").workbench;
  store.updateConnection({id:"a",workbench:{...workbench,workbenches:[],activeWorkbenchId:undefined}});
};
window.eventControls.addConcurrentNote = () => {
  const store = useConfigStore.getState();
  const workbench = store.connections.find(c=>c.id==="a").workbench;
  store.updateConnection({id:"a",workbench:{...workbench,receipts:[{id:"concurrent",workbenchId:"w",kind:"testing",intent:"concurrent",context:"",diagnostics:"",recordedAtUnixMs:1},...workbench.receipts]}});
};
window.eventControls.switchWorkbench = () => {
  const store = useConfigStore.getState();
  const workbench = store.connections.find(c=>c.id==="a").workbench;
  const other = {id:"other",name:"Other",description:"",createdAtUnixMs:1,updatedAtUnixMs:1};
  store.updateConnection({id:"a",workbench:{...workbench,workbenches:[...workbench.workbenches,other],activeWorkbenchId:"other"}});
};
const storage = {runtime_cursor:7,physical:{profile:"test",headline:[]}};
const client = {
  schema: async () => { window.eventControls.calls.push("schema"); if(window.eventControls.schemaDefer) await new Promise(resolve=>window.eventControls.schemaRelease=resolve); if(window.eventControls.schemaFail) throw new Error("schema failed"); return {schema_revision:3,tables:[{}],truncated:true,known_at_cursor:9}; },
  workbenchSnapshot: async () => { window.eventControls.calls.push("flights"); return {after_cursor:0,flights:[],truncated:false}; },
  storage: async () => { window.eventControls.calls.push("storage"); if (window.eventControls.defer) await new Promise(resolve=>window.eventControls.release=resolve); if(window.eventControls.fail) throw new Error("storage failed"); return storage; },
  capabilities: async () => ({implementation:"rrflow",implementation_version:"1",configuration_revision:1}),
  database: async () => ({graph:{nodes:[],edges:[]}}),
  vectorCollections: async () => ({collections:[]}),
  physicalStorage: async () => {throw new Error("not supplied in component test");},
  inventoryNeighborhood: async () => {throw new Error("not supplied in component test");},
};
const queryClient = new QueryClient({defaultOptions:{queries:{retry:false}}});
window.eventControls.queryClient = queryClient;
function App() {
  const [session, setSession] = useState("session-a");
  return React.createElement(MantineProvider,null,
    React.createElement(QueryClientProvider,{client:queryClient},
      React.createElement("button",{onClick:()=>setSession(session==="session-a"?"session-b":"session-a")},"Switch session"),
      React.createElement(WorkbenchPanel,{client,connectionId:"a",sessionKey:session,connected:true,onOpenGraph:()=>{},onOpenStorage:()=>{},onSelectRecord:()=>{},onOpenRoute:(route)=>{window.eventControls.route=route;}})));
}
createRoot(document.getElementById("root")).render(React.createElement(App));
`;

const server = await createServer({
	server: { host: "127.0.0.1", port: 0 },
	plugins: [
		{
			name: "event-browser",
			resolveId(id) {
				if (id === "/event-entry") return "\0event-entry.js";
			},
			load(id) {
				if (id === "\0event-entry.js") return entry;
			},
			configureServer(vite) {
				vite.middlewares.use("/__event-test", async (_request, response, next) => {
					try {
						const html = await vite.transformIndexHtml(
							"/__event-test",
							'<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/event-entry"></script></body></html>',
						);
						response.setHeader("Content-Type", "text/html");
						response.end(html);
					} catch (error) {
						next(error);
					}
				});
			},
		},
	],
});
let browser;
try {
	await server.listen();
	const address = server.httpServer.address();
	assert.ok(address && typeof address !== "string");
	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`http://127.0.0.1:${address.port}/__event-test`);
	await page.getByText("refresh event", { exact: true }).waitFor();
	assert.equal(await page.getByRole("button", { name: "Open step" }).count(), 4);
	assert.equal(await page.getByRole("button", { name: "Open skill lens" }).count(), 3);
	const readinessRoutes = [
		"knowledge/models",
		"knowledge/records",
		"knowledge/vectors",
		"system/storage",
	];
	for (const [index, route] of readinessRoutes.entries()) {
		await page.getByRole("button", { name: "Open step" }).nth(index).click();
		assert.equal(await page.evaluate(() => window.eventControls.route), route);
	}
	for (const [index, route] of readinessRoutes.slice(0, 3).entries()) {
		await page.getByRole("button", { name: "Open skill lens" }).nth(index).click();
		assert.equal(await page.evaluate(() => window.eventControls.route), route);
	}
	for (const [index, route] of [...readinessRoutes, "reasoning/workbench"].entries()) {
		await page
			.getByRole("button", { name: `Step ${index + 1}: ${route}`, exact: true })
			.click();
		assert.equal(await page.evaluate(() => window.eventControls.route), route);
	}
	await page.getByRole("button", { name: "Start routine" }).click();
	assert.equal(await page.evaluate(() => window.eventControls.route), "knowledge/models");
	await page.getByRole("textbox", { name: "Routine", exact: true }).click();
	await page.getByRole("option", { name: "Cold trigger triage" }).dispatchEvent("click");
	await page.getByRole("button", { name: "Start routine" }).click();
	assert.equal(await page.evaluate(() => window.eventControls.route), "system/storage");
	for (const [index, route] of [
		"system/storage",
		"knowledge/vectors",
		"reasoning/workbench",
	].entries()) {
		await page
			.getByRole("button", { name: `Step ${index + 1}: ${route}`, exact: true })
			.click();
		assert.equal(await page.evaluate(() => window.eventControls.route), route);
	}
	await page.getByRole("button", { name: "Record outcome" }).click();
	assert.equal(await page.evaluate(() => window.eventControls.route), "reasoning/workbench");
	await page.getByRole("textbox", { name: "Route plan" }).click();
	await page.getByRole("option", { name: "Cold vector follow-up route" }).dispatchEvent("click");
	assert.equal(await page.getByRole("button", { name: "Open step" }).count(), 3);
	for (const [index, route] of [
		"system/storage",
		"knowledge/vectors",
		"reasoning/workbench",
	].entries()) {
		await page.getByRole("button", { name: "Open step" }).nth(index).click();
		assert.equal(await page.evaluate(() => window.eventControls.route), route);
	}
	assert.equal(
		(await page.evaluate(() => window.eventControls.calls)).includes("storage"),
		false,
	);
	const run = page.getByRole("button", { name: "Approve and run" });
	await page.evaluate(() => {
		window.eventControls.calls = [];
	});
	await run.first().click();
	await page.getByText('Event "refresh event" completed.').waitFor();
	assert.deepEqual(await page.evaluate(() => window.eventControls.calls), ["storage", "flights"]);
	const firstNote = (await page.evaluate(() => window.eventControls.profile())).receipts[0];
	assert.equal(firstNote.intent, "MCPL event executed: refresh event");
	assert.equal(firstNote.kind, "testing");
	assert.match(firstNote.context, /template=Test/);
	assert.match(firstNote.diagnostics, /actions=refresh-storage-signals,refresh-governed-flights/);
	await run.nth(1).click();
	await page.getByText('Event "capture event" completed.').waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 3);
	await page.evaluate(() => {
		window.eventControls.fail = true;
	});
	await run.first().click();
	await page.getByText("Event stopped: storage failed", { exact: false }).waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 3);
	await page.evaluate(() => {
		window.eventControls.fail = false;
		window.eventControls.defer = true;
		window.eventControls.calls = [];
		window.eventControls.release = null;
	});
	await run.nth(1).click();
	await page.waitForFunction(() => window.eventControls.release !== null);
	await page.evaluate(() => {
		window.eventControls.changeEvent(false);
		window.eventControls.release();
	});
	await page.getByText("Workbench context changed; event stopped.", { exact: false }).waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 3);
	await page.evaluate(() => {
		window.eventControls.changeEvent(true);
		window.eventControls.release = null;
		window.eventControls.calls = [];
	});
	await run.first().click();
	await page.waitForFunction(() => window.eventControls.release !== null);
	await page.getByRole("button", { name: "Switch session" }).click();
	await page.waitForFunction(() => window.eventControls.calls.includes("flights"));
	const flightCount = (await page.evaluate(() => window.eventControls.calls)).filter(
		(call) => call === "flights",
	).length;
	await page.evaluate(() => window.eventControls.release());
	await page.waitForTimeout(100);
	assert.deepEqual(
		await page.evaluate(() => window.eventControls.calls.filter((call) => call === "storage")),
		["storage"],
	);
	assert.equal(
		(await page.evaluate(() => window.eventControls.calls)).filter((call) => call === "flights")
			.length,
		flightCount,
	);
	assert.equal(await page.getByText('Event "refresh event" completed.').count(), 0);
	await page.getByRole("button", { name: "Read schema" }).click();
	await page.getByText("Schema 3; 1 tables returned (truncated); cursor 9.").waitFor();
	assert.equal(await page.getByText("UI elapsed", { exact: false }).count(), 1);
	await page.getByRole("button", { name: "Read database" }).click();
	await page.getByText("Returned graph: 0 nodes, 0 edges.").waitFor();
	await page.evaluate(() => {
		window.eventControls.defer = false;
	});
	await page.getByRole("button", { name: "Read storage" }).click();
	await page.getByText("Storage profile test; cursor 7.").waitFor();
	await page.getByRole("button", { name: "Read flights", exact: true }).click();
	await page.getByText("0 flights returned after cursor 0.").waitFor();
	await page.getByRole("button", { name: "Capture diagnostic note" }).click();
	await page
		.getByText("Local diagnostic note saved; this is not an engine audit receipt.")
		.waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 4);
	await page.getByRole("button", { name: "Open storage", exact: true }).click();
	assert.equal(await page.evaluate(() => window.eventControls.route), "system/storage");
	await page.evaluate(() => {
		window.eventControls.schemaFail = true;
	});
	await page.getByRole("button", { name: "Read schema" }).click();
	await page.getByText("schema failed", { exact: true }).waitFor();
	await page.evaluate(() => {
		window.eventControls.schemaFail = false;
		window.eventControls.schemaDefer = true;
		window.eventControls.queryClient.removeQueries({ queryKey: ["rrd-schema", "session-b"] });
	});
	await page.getByRole("button", { name: "Read schema" }).click();
	await page.waitForFunction(() => window.eventControls.schemaRelease !== null);
	await page.getByRole("button", { name: "Switch session" }).click();
	await page.evaluate(() => window.eventControls.schemaRelease());
	await page.waitForTimeout(100);
	assert.equal(
		await page.getByText("Schema 3; 1 tables returned (truncated); cursor 9.").count(),
		0,
	);
	assert.equal(
		await page.evaluate(() =>
			window.eventControls.queryClient.getQueryData(["rrd-schema", "session-b"]),
		),
		undefined,
	);
	await page.evaluate(() => {
		window.eventControls.defer = true;
		window.eventControls.release = null;
	});
	await page.getByRole("button", { name: "Capture diagnostic note" }).click();
	await page.waitForFunction(() => window.eventControls.release !== null);
	await page.getByRole("button", { name: "Switch session" }).click();
	await page.evaluate(() => window.eventControls.release());
	await page.waitForTimeout(100);
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 4);
	assert.equal(
		await page
			.getByText("Local diagnostic note saved; this is not an engine audit receipt.")
			.count(),
		0,
	);
	await page.evaluate(() => {
		window.eventControls.release = null;
	});
	await run.first().click();
	await page.waitForFunction(() => window.eventControls.release !== null);
	await page.evaluate(() => {
		window.eventControls.addConcurrentNote();
		window.eventControls.release();
	});
	await page.getByText('Event "refresh event" completed.').waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 6);
	assert.ok(
		(await page.evaluate(() => window.eventControls.profile())).receipts.some(
			(note) => note.id === "concurrent",
		),
	);
	await page.evaluate(() => {
		window.eventControls.release = null;
	});
	await run.nth(1).click();
	await page.waitForFunction(() => window.eventControls.release !== null);
	await page.evaluate(() => {
		window.eventControls.switchWorkbench();
		window.eventControls.release();
	});
	await page.waitForTimeout(100);
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 6);
	await page.evaluate(() => {
		window.eventControls.defer = false;
		window.eventControls.clearWorkbenches();
	});
	await run.first().click();
	await page.getByText('Event "refresh event" completed.').waitFor();
	assert.equal((await page.evaluate(() => window.eventControls.profile())).receipts.length, 6);
	assert.deepEqual(errors, []);
	console.log(
		"Workbench event browser: explicit runs, local capture, errors and session switch passed.",
	);
} finally {
	if (browser) await browser.close();
	await server.close();
}
