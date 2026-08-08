import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const selectedPackage = process.argv[2];
const packageBuilds = {
	runtime: {
		declarationEntries: ["index.d.ts", "compiler.d.ts"],
		entryPoints: [
			resolve(repositoryRoot, "packages/runtime/src/index.ts"),
			resolve(repositoryRoot, "packages/runtime/src/compiler.ts"),
		],
		external: ["@noble/hashes/*"],
		outdir: resolve(repositoryRoot, "packages/runtime/dist"),
		platform: "neutral",
	},
	cli: {
		declarationEntries: ["index.d.ts"],
		entryPoints: [
			resolve(repositoryRoot, "packages/cli/src/index.ts"),
			resolve(repositoryRoot, "packages/cli/src/bin.ts"),
		],
		external: ["s11tnext", "s11tnext/compiler", "smol-toml"],
		outdir: resolve(repositoryRoot, "packages/cli/dist"),
		platform: "node",
		staticFiles: [
			{
				source: resolve(repositoryRoot, "schemas/s11tnext-authoring.schema.json"),
				target: "schemas/s11tnext-authoring.schema.json",
			},
			{
				source: resolve(repositoryRoot, "schemas/s11tnext-config.schema.json"),
				target: "schemas/s11tnext-config.schema.json",
			},
		],
	},
};

function removeJavaScriptFiles(directory) {
	if (!existsSync(directory)) return;
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) removeJavaScriptFiles(path);
		else if (entry.name.endsWith(".js")) rmSync(path);
	}
}

function filesUnder(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		return entry.isDirectory() ? filesUnder(path) : [path];
	});
}

function pruneDeclarations(directory, entries) {
	const retained = new Set();
	const pending = entries.map((entry) => resolve(directory, entry));
	while (pending.length > 0) {
		const path = pending.pop();
		if (path === undefined || retained.has(path)) continue;
		retained.add(path);
		const imports = readFileSync(path, "utf8").matchAll(
			/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']/g,
		);
		for (const imported of imports) {
			const specifier = imported[1];
			if (specifier === undefined) continue;
			const declarationPath = resolve(dirname(path), specifier.replace(/\.js$/, ".d.ts"));
			if (existsSync(declarationPath)) pending.push(declarationPath);
		}
	}
	for (const path of filesUnder(directory)) {
		if (path.endsWith(".d.ts") && !retained.has(path)) rmSync(path);
	}
}

if (selectedPackage === "clean") {
	for (const options of Object.values(packageBuilds)) {
		removeJavaScriptFiles(options.outdir);
		if (options.staticFiles !== undefined) {
			rmSync(resolve(options.outdir, "schemas"), { recursive: true, force: true });
		}
	}
	process.exit(0);
}

const names = selectedPackage === undefined ? Object.keys(packageBuilds) : [selectedPackage];

for (const name of names) {
	const options = packageBuilds[name];
	if (options === undefined) {
		throw new TypeError(`Unknown package build: ${name}`);
	}
	const { declarationEntries, staticFiles, ...buildOptions } = options;
	removeJavaScriptFiles(options.outdir);
	if (staticFiles !== undefined) {
		rmSync(resolve(options.outdir, "schemas"), { recursive: true, force: true });
	}
	await build({
		...buildOptions,
		bundle: true,
		chunkNames: "chunks/[name]-[hash]",
		format: "esm",
		logLevel: "silent",
		minify: true,
		splitting: true,
		target: "es2022",
	});
	pruneDeclarations(options.outdir, declarationEntries);
	for (const file of staticFiles ?? []) {
		const target = resolve(options.outdir, file.target);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, JSON.stringify(JSON.parse(readFileSync(file.source, "utf8"))));
	}
}
