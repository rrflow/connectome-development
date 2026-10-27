/**
 * Code examples for one catalogue operation, in each language RRFlow ships a
 * client for.
 *
 * Every example is derived from the operation's catalogue entry (its id,
 * method, path, authentication and mutation flag) and the SDKs' generic call,
 * which all six clients expose under the same operation identity. Nothing here
 * keeps a per-operation table: an operation the engine adds gets examples
 * without a change in Connectome.
 */
import type { RrdOperation } from "~/rrflow/runtime";

export type ExampleLanguage = "cli" | "js" | "py" | "go" | "java" | "csharp";

export const EXAMPLE_LANGUAGES: { value: ExampleLanguage; label: string; title: string }[] = [
	{ value: "cli", label: "CLI", title: "curl" },
	{ value: "js", label: "TypeScript", title: "TypeScript" },
	{ value: "py", label: "Python", title: "Python" },
	{ value: "go", label: "Go", title: "Go" },
	{ value: "java", label: "Java", title: "Java" },
	{ value: "csharp", label: ".NET", title: "C#" },
];

/** A saved documentation language RRFlow has no client for falls back to curl. */
export function exampleLanguage(saved: string | undefined): ExampleLanguage {
	return EXAMPLE_LANGUAGES.some((language) => language.value === saved)
		? (saved as ExampleLanguage)
		: "cli";
}

export interface ExampleTarget {
	/** The engine's base URL, for example `http://127.0.0.1:9477`. */
	endpoint: string;
	/** The estate instance the client is bound to. */
	instance: string;
}

const segments = (operation: string) => operation.split("-");
const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** `query-index-ensure` as Go names it: `OperationQueryIndexEnsure`. */
export const goOperation = (operation: string) =>
	`Operation${segments(operation).map(capitalized).join("")}`;
/** As Java names it: `QUERY_INDEX_ENSURE`. */
export const javaOperation = (operation: string) => operation.toUpperCase().replaceAll("-", "_");
/** As .NET names it: `QueryIndexEnsure`. */
export const dotnetOperation = (operation: string) => segments(operation).map(capitalized).join("");

/** The `{name}` parameters of a path template, in order. */
export function pathParameters(path: string): string[] {
	return [...path.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]);
}

const GET = "get";

function curl(operation: RrdOperation, target: ExampleTarget): string {
	const path = operation.path.replace(
		/\{([a-z_]+)\}/g,
		(_, name: string) => `$${name.toUpperCase()}`,
	);
	const url = `${target.endpoint}${path}`;
	const lines: string[] = [];
	if (operation.method === GET) {
		lines.push(`curl -s "${url}"`);
	} else {
		lines.push(`curl -s -X ${operation.method.toUpperCase()} "${url}"`);
		lines.push(`  -H "Content-Type: application/json"`);
	}
	if (operation.authentication === "session_bearer") {
		lines.push(`  -H "X-RRD-Session: $SESSION"`, `  -H "Authorization: Bearer $TOKEN"`);
	} else if (operation.authentication === "api_key") {
		lines.push(`  -H "X-RRD-Principal: $PRINCIPAL"`, `  -H "Authorization: ApiKey $API_KEY"`);
	}
	if (operation.method !== GET) {
		lines.push("  --data @request.json");
	}
	const command = lines.join(" \\\n");
	if (operation.method === GET) {
		return command;
	}
	const key = operation.mutation ? " and a context with a fresh idempotency_key" : "";
	return `# request.json is an RRD request envelope whose payload is a ${operation.request_type}${key}.\n${command}`;
}

function typescript(operation: RrdOperation, target: ExampleTarget): string {
	const options: string[] = [];
	if (operation.authentication === "session_bearer") options.push("session");
	if (operation.authentication === "api_key")
		options.push('apiKey: { principalId: "<principal>", credential: "<api key>" }');
	if (operation.mutation) options.push('idempotencyKey: "<unique key>"');
	const parameters = pathParameters(operation.path);
	if (parameters.length > 0) {
		options.push(
			`pathParameters: { ${parameters.map((name) => `${name}: "<${name}>"`).join(", ")} }`,
		);
	}
	const payload = operation.method === GET ? "undefined" : "payload";
	const lines = [
		'import { RrdClient } from "@rrflow/rrd-client";',
		"",
		`const client = new RrdClient({ baseUrl: "${target.endpoint}", instance: "${target.instance}" });`,
	];
	if (operation.authentication === "session_bearer") {
		lines.push("// session comes from client.createSession(...).");
	}
	if (operation.method !== GET) {
		lines.push(`// payload is a ${operation.request_type}.`);
	}
	lines.push(
		`const result = await client.call("${operation.operation}", ${payload}, { ${options.join(", ")} });`,
	);
	return lines.join("\n").replace("{  }", "{}");
}

function python(operation: RrdOperation, target: ExampleTarget): string {
	const options: string[] = [];
	if (operation.authentication === "session_bearer") options.push("session=session");
	if (operation.authentication === "api_key")
		options.push('principal_id="<principal>", api_key="<api key>"');
	if (operation.mutation) options.push('idempotency_key="<unique key>"');
	const parameters = pathParameters(operation.path);
	if (parameters.length > 0) {
		options.push(
			`path_parameters={${parameters.map((name) => `"${name}": "<${name}>"`).join(", ")}}`,
		);
	}
	const payload = operation.method === GET ? "None" : "payload";
	const lines = [
		"from rrd_client import RequestOptions, RrdClient",
		"",
		`client = RrdClient("${target.endpoint}", "${target.instance}")`,
	];
	if (operation.authentication === "session_bearer") {
		lines.push("# session comes from client.create_session(...).");
	}
	if (operation.method !== GET) {
		lines.push(`# payload is a ${operation.request_type}.`);
	}
	lines.push(
		`result = client.call("${operation.operation}", ${payload}, RequestOptions(${options.join(", ")}))`,
	);
	return lines.join("\n");
}

function go(operation: RrdOperation, target: ExampleTarget): string {
	const options: string[] = [];
	if (operation.authentication === "session_bearer") options.push("Session: session");
	if (operation.authentication === "api_key")
		options.push(
			'APIKey: &rrd.APIKeyCredentials{PrincipalID: "<principal>", Credential: "<api key>"}',
		);
	if (operation.mutation) options.push('IdempotencyKey: "<unique key>"');
	const parameters = pathParameters(operation.path);
	if (parameters.length > 0) {
		options.push(
			`PathParameters: map[string]string{${parameters.map((name) => `"${name}": "<${name}>"`).join(", ")}}`,
		);
	}
	const payload = operation.method === GET ? "nil" : "payload";
	const lines = [
		'import rrd "github.com/rrflow/rrflow/sdks/go"',
		"",
		`client, err := rrd.NewClient(rrd.Config{BaseURL: "${target.endpoint}", Instance: "${target.instance}"})`,
	];
	lines.push("// ctx is a context.Context.");
	if (operation.authentication === "session_bearer") {
		lines.push("// session comes from client.CreateSession(...).");
	}
	if (operation.method !== GET) {
		lines.push(`// payload is a ${operation.request_type}.`);
	}
	lines.push(
		`result, err := client.Call(ctx, rrd.${goOperation(operation.operation)}, ${payload}, rrd.RequestOptions{${options.join(", ")}})`,
	);
	return lines.join("\n");
}

function java(operation: RrdOperation, target: ExampleTarget): string {
	const parameters = pathParameters(operation.path);
	const pathMap =
		parameters.length > 0
			? `Map.of(${parameters.map((name) => `"${name}", "<${name}>"`).join(", ")})`
			: "Map.of()";
	const key = operation.mutation ? '"<unique key>"' : "null";
	let options: string;
	if (operation.authentication === "api_key") {
		options = `new RequestOptions(null, null, ${key}, null, ${pathMap}, null, null, null)\n        .withApiKey("<principal>", "<api key>")`;
	} else if (operation.authentication === "session_bearer") {
		options = `new RequestOptions(null, null, ${key}, null, ${pathMap}, null, session, null)`;
	} else if (operation.mutation || parameters.length > 0) {
		options = `new RequestOptions(null, null, ${key}, null, ${pathMap}, null, null, null)`;
	} else {
		options = "RequestOptions.empty()";
	}
	const payload = operation.method === GET ? "null" : "payload";
	const lines = [
		"import io.rrflow.rrd.OperationId;",
		"import io.rrflow.rrd.RequestOptions;",
		"import io.rrflow.rrd.RrdClient;",
		...(options.includes("Map.of") ? ["import java.util.Map;"] : []),
		"import tools.jackson.databind.JsonNode;",
		"",
		`RrdClient client = new RrdClient("${target.endpoint}", "${target.instance}");`,
	];
	if (operation.authentication === "session_bearer") {
		lines.push("// session comes from client.createSession(...).");
	}
	if (operation.method !== GET) {
		lines.push(`// payload is a ${operation.request_type}.`);
	}
	lines.push(
		`JsonNode result = client.call(OperationId.${javaOperation(operation.operation)}, ${payload}, ${options});`,
	);
	return lines.join("\n");
}

function dotnet(operation: RrdOperation, target: ExampleTarget): string {
	const options: string[] = [];
	if (operation.authentication === "session_bearer") options.push("Session = session");
	if (operation.authentication === "api_key")
		options.push('ApiKey = new ApiKeyCredentials("<principal>", "<api key>")');
	if (operation.mutation) options.push('IdempotencyKey = "<unique key>"');
	const parameters = pathParameters(operation.path);
	if (parameters.length > 0) {
		options.push(
			`PathParameters = new Dictionary<string, string> { ${parameters.map((name) => `["${name}"] = "<${name}>"`).join(", ")} }`,
		);
	}
	const payload = operation.method === GET ? "null" : "payload";
	const lines = [
		// The package is Rrflow.Rrd.Client; its namespace is Rrflow.Rrd.
		"using Rrflow.Rrd;",
		"",
		`using var client = new RrdClient(new RrdClientOptions { BaseUri = new Uri("${target.endpoint}"), Instance = "${target.instance}" });`,
	];
	if (operation.authentication === "session_bearer") {
		lines.push("// session comes from client.CreateSessionAsync(...).");
	}
	if (operation.method !== GET) {
		lines.push(`// payload is a ${operation.request_type}.`);
	}
	const built =
		options.length > 0
			? `new RequestOptions { ${options.join(", ")} }`
			: "new RequestOptions()";
	lines.push(
		`var result = await client.CallAsync(OperationId.${dotnetOperation(operation.operation)}, ${payload}, ${built});`,
	);
	return lines.join("\n");
}

/** One example per language for `operation` against `target`. */
export function operationExamples(
	operation: RrdOperation,
	target: ExampleTarget,
): Record<ExampleLanguage, string> {
	return {
		cli: curl(operation, target),
		js: typescript(operation, target),
		py: python(operation, target),
		go: go(operation, target),
		java: java(operation, target),
		csharp: dotnet(operation, target),
	};
}
