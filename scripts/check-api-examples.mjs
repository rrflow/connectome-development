#!/usr/bin/env node
/**
 * Type-checks the API reference's TypeScript example for every operation of
 * the pinned engine against the pinned `@rrflow/rrd-client`, so an example
 * that names a missing option, a wrong operation or a wrong call shape fails
 * here instead of in a reader's editor.
 *
 *   node scripts/check-api-examples.mjs
 *
 * The operation list is the SDK's generated endpoint map (method, path,
 * authentication, mutation), the same catalogue projection the page reads.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The generated map is one JSON object literal followed by `as const`; Node
// does not strip types under node_modules, so it is read as text.
const generated = readFileSync(
	join(root, "node_modules/@rrflow/rrd-client/src/generated/endpoints.ts"),
	"utf8",
);
const literal = generated.match(/export const endpoints = (\{[\s\S]*?\n\}) as const;/);
if (!literal) {
	throw new Error("the SDK endpoint map has an unexpected shape");
}
const endpoints = JSON.parse(literal[1]);
const { operationExamples } = await import(
	`file://${join(root, "src/screens/connectome/pages/RuntimeConnection/api/examples.ts").replaceAll("\\", "/")}`
);

const target = { endpoint: "http://127.0.0.1:9477", instance: "local" };
const operations = Object.entries(endpoints).map(([operation, descriptor]) => ({
	operation,
	method: descriptor.method.toLowerCase(),
	path: descriptor.path,
	authentication: descriptor.authentication,
	mutation: descriptor.mutation,
	request_type: "RequestType",
	response_type: "ResponseType",
}));
if (operations.length === 0) {
	throw new Error("the SDK endpoint map is empty");
}

const IMPORT = 'import { RrdClient } from "@rrflow/rrd-client";';
const bodies = operations.map((operation, index) => {
	const example = operationExamples(operation, target).js;
	if (!example.startsWith(IMPORT)) {
		throw new Error(`${operation.operation}: the example does not start with the SDK import`);
	}
	const body = example
		.slice(IMPORT.length)
		.trim()
		.split("\n")
		.map((line) => `\t${line}`)
		.join("\n");
	return `// ${operation.operation}\nexport async function example${index}() {\n${body}\n\treturn result;\n}`;
});

// Inside node_modules so the pinned SDK resolves, and outside the source tree.
const work = join(root, "node_modules/.cache/api-examples");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
writeFileSync(
	join(work, "examples.ts"),
	[
		'import { RrdClient, type Session } from "@rrflow/rrd-client";',
		"declare const session: Session;",
		"// biome-ignore lint: any payload stands for each operation's request type",
		"declare const payload: any;",
		"",
		...bodies,
		"",
	].join("\n"),
);
writeFileSync(
	join(work, "tsconfig.json"),
	JSON.stringify(
		{
			compilerOptions: {
				strict: true,
				noEmit: true,
				target: "ES2022",
				module: "ESNext",
				moduleResolution: "Bundler",
				allowImportingTsExtensions: true,
				skipLibCheck: true,
				types: [],
				lib: ["ES2022", "DOM"],
			},
			files: ["examples.ts"],
		},
		null,
		1,
	),
);
const tsc = spawnSync(
	process.execPath,
	[join(root, "node_modules/typescript/bin/tsc"), "-p", work],
	{
		encoding: "utf8",
	},
);
if (tsc.status !== 0) {
	process.stdout.write(tsc.stdout);
	process.stderr.write(tsc.stderr);
	throw new Error(
		"an API reference TypeScript example does not type-check against the pinned SDK",
	);
}
console.log(
	`API reference examples type-check: ${operations.length} operations against the pinned @rrflow/rrd-client.`,
);
