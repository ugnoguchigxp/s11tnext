import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { emitTypes } from "../packages/cli/dist/index.js";
import { compileCatalog } from "../packages/runtime/dist/compiler.js";
import { createCatalog } from "../packages/runtime/dist/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = resolve(repositoryRoot, ".artifacts");
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--check") || arguments_.length > 1) {
	throw new Error("Usage: node scripts/benchmark.mjs [--check]");
}
const checkBudgets = arguments_[0] === "--check";

function definitions(count) {
	const result = [];
	for (let index = 0; index < count; index += 1) {
		result.push({
			key: `benchmark.context${String(index).padStart(5, "0")}`,
			owner: "benchmark",
			contentKind: "text",
			messageRole: "system",
			sourceLocale: "en-US",
			requiredLocales: ["en-US"],
			variables: {
				value: {
					required: true,
					type: "string",
					trust: "trusted",
					placement: "inline",
					encoding: "raw",
				},
			},
			sections: [
				{
					id: "context.text",
					kind: "instruction",
					severity: "must",
					optimizable: false,
					omitIfEmpty: false,
					locales: { "en-US": "Benchmark [[value]]" },
				},
			],
		});
	}
	return result;
}

function compile(count) {
	return compileCatalog(definitions(count), {
		releaseProfile: "benchmark",
		provenance: {
			configPath: "benchmark/s11tnext.config.toml",
			sourceFiles: Array.from(
				{ length: count },
				(_, index) => `benchmark/context${String(index).padStart(5, "0")}.context.toml`,
			),
		},
	});
}

function timed(action) {
	const start = performance.now();
	const value = action();
	return { milliseconds: performance.now() - start, value };
}

const compileResults = {};
let catalog1000;
for (const count of [100, 1_000, 10_000]) {
	const result = timed(() => compile(count));
	compileResults[count] = Number(result.milliseconds.toFixed(2));
	if (count === 1_000) catalog1000 = result.value;
}
if (catalog1000 === undefined) throw new Error("1,000-context benchmark artifact was not created");

const load = timed(() => createCatalog(catalog1000));
const catalog = load.value;
const render = catalog.bind({ instructionLocale: "en-US" });
const renderIterations = 20_000;
const renderStart = performance.now();
for (let index = 0; index < renderIterations; index += 1) {
	render(`benchmark.context${String(index % 1_000).padStart(5, "0")}`, {
		value: "payload",
	});
}
const renderSeconds = (performance.now() - renderStart) / 1_000;
const generatedTypes1000Bytes = Buffer.byteLength(emitTypes(catalog1000));

const browserBundle = await build({
	entryPoints: ["packages/runtime/dist/index.js"],
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	write: false,
	logLevel: "silent",
	minify: true,
});
const runtimeBrowserBundleBytes = browserBundle.outputFiles.reduce(
	(total, file) => total + file.contents.byteLength,
	0,
);

const packageManifest = JSON.parse(
	readFileSync(resolve(artifactDirectory, "packages/manifest.json"), "utf8"),
);
const packageSizes = Object.fromEntries(
	packageManifest.packages.map((entry) => [
		entry.name,
		statSync(resolve(artifactDirectory, "packages", entry.file)).size,
	]),
);

const measurements = {
	node: process.version,
	platform: `${process.platform}-${process.arch}`,
	contexts: {
		compileMilliseconds: compileResults,
		load1000Milliseconds: Number(load.milliseconds.toFixed(2)),
		renderOperationsPerSecond: Math.round(renderIterations / renderSeconds),
	},
	sizes: {
		runtimeBrowserBundleBytes,
		runtimeTarballBytes: packageSizes.s11tnext,
		cliTarballBytes: packageSizes["s11tnext-cli"],
		generatedTypes1000Bytes,
	},
	memory: {
		heapUsedBytesAfterRun: process.memoryUsage().heapUsed,
	},
};

if (checkBudgets) {
	const budgets = JSON.parse(
		readFileSync(resolve(repositoryRoot, "config/performance-budgets.json"), "utf8"),
	);
	const failures = Object.entries(budgets)
		.filter(([name, maximum]) => measurements.sizes[name] > maximum)
		.map(([name, maximum]) => `${name}: ${measurements.sizes[name]} bytes > ${maximum} byte budget`);
	if (failures.length > 0) {
		throw new Error(`Performance size budgets failed:\n${failures.join("\n")}`);
	}
}

mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
	resolve(artifactDirectory, "benchmark.json"),
	`${JSON.stringify(measurements, null, 2)}\n`,
	"utf8",
);
process.stdout.write(`${JSON.stringify(measurements, null, 2)}\n`);
process.stdout.write(
	`${checkBudgets ? "Performance size budgets passed" : "Performance baseline recorded"}.\n`,
);
