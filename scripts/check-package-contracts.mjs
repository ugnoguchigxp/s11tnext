import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crossSpawn from "cross-spawn";

const { sync: spawnSync } = crossSpawn;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = resolve(repositoryRoot, ".artifacts/packages");
const manifest = JSON.parse(readFileSync(resolve(artifactDirectory, "manifest.json"), "utf8"));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--update") || arguments_.length > 1) {
	throw new Error("Usage: node scripts/check-package-contracts.mjs [--update]");
}
const updateApiReports = arguments_[0] === "--update";
const apiConfigs = [
	"packages/runtime/api-extractor.json",
	"packages/runtime/api-extractor.compiler.json",
	"packages/cli/api-extractor.json",
];

function run(command, arguments_) {
	const result = spawnSync(command, arguments_, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${arguments_.join(" ")} failed with exit code ${result.status}`);
	}
}

if (!Array.isArray(manifest.packages) || manifest.packages.length !== 2) {
	throw new Error("Package manifest must contain runtime and CLI tarballs");
}

for (const entry of manifest.packages) {
	const tarball = resolve(artifactDirectory, entry.file);
	run(pnpm, ["exec", "publint", "run", tarball, "--strict"]);
	run(pnpm, [
		"exec",
		"attw",
		tarball,
		"--profile",
		"esm-only",
		"--no-definitely-typed",
		"--no-emoji",
		"--no-color",
	]);
}

for (const config of apiConfigs) {
	run(pnpm, ["exec", "api-extractor", "run", "--config", config, ...(updateApiReports ? ["--local"] : [])]);
}

process.stdout.write(
	`Package metadata, TypeScript resolution, and ${apiConfigs.length} API reports passed.\n`,
);
