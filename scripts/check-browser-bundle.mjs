import { Buffer } from "node:buffer";

import { build } from "esbuild";

const result = await build({
	entryPoints: ["packages/runtime/dist/index.js"],
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	write: false,
	logLevel: "silent",
});

if (result.outputFiles.length !== 1 || result.outputFiles[0].contents.length === 0) {
	throw new Error("Browser bundle smoke produced no output");
}

const source = result.outputFiles[0].text;
for (const forbidden of [/node:/u, /\brequire\s*\(/u, /\bprocess\./u, /\bBuffer\b/u]) {
	if (forbidden.test(source)) throw new Error(`Browser bundle contains forbidden Node.js code: ${forbidden}`);
}

const encoded = Buffer.from(result.outputFiles[0].contents).toString("base64");
const bundle = await import(`data:text/javascript;base64,${encoded}`);
for (const exported of ["assertCatalogArtifact", "createCatalog", "hashRendered", "verifyRenderedHash"]) {
	if (typeof bundle[exported] !== "function") {
		throw new Error(`Browser bundle is missing the ${exported} function`);
	}
}

process.stdout.write("Runtime evaluates as a Node-free ESM browser-target bundle.\n");
