import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crossSpawn from "cross-spawn";

const { sync: spawnSync } = crossSpawn;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repositoryRoot, "test-consumer/esm-node");
const artifactDirectory = resolve(repositoryRoot, ".artifacts/packages");
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--registry") || arguments_.length > 1) {
	throw new Error("Usage: node scripts/test-tarball-consumer.mjs [--registry]");
}
const registryMode = arguments_[0] === "--registry";
const registryTag = process.env.S11TNEXT_REGISTRY_TAG ?? "latest";
if (registryMode && !/^[a-z][a-z0-9._-]*$/.test(registryTag)) {
	throw new Error("S11TNEXT_REGISTRY_TAG must be a valid npm dist-tag");
}
const manifest = registryMode
	? null
	: JSON.parse(readFileSync(resolve(artifactDirectory, "manifest.json"), "utf8"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;
const temporary = mkdtempSync(join(tmpdir(), "s11tnext-consumer-"));

function run(command, arguments_, options = {}) {
	const result = spawnSync(command, arguments_, {
		cwd: temporary,
		encoding: "utf8",
		env: { ...process.env, npm_config_yes: "false" },
		...options,
	});
	if (result.status !== 0) {
		process.stderr.write(result.stdout ?? "");
		process.stderr.write(result.stderr ?? "");
		throw new Error(`${command} ${arguments_.join(" ")} failed with exit code ${result.status}`);
	}
	return result.stdout ?? "";
}

try {
	cpSync(fixtureRoot, temporary, { recursive: true });
	const installTargets = [`s11tnext@${registryTag}`, `s11tnext-cli@${registryTag}`];
	if (!registryMode) {
		if (!Array.isArray(manifest?.packages) || manifest.packages.length !== 2) {
			throw new Error("Package manifest is invalid");
		}
		const packageDirectory = resolve(temporary, "packages");
		mkdirSync(packageDirectory);
		installTargets.length = 0;
		for (const entry of manifest.packages) {
			const source = resolve(artifactDirectory, entry.file);
			const destination = resolve(packageDirectory, basename(entry.file));
			cpSync(source, destination);
			installTargets.push(`./packages/${basename(entry.file)}`);
		}
	}
	run(npm, ["install", "--ignore-scripts", "--no-audit", "--fund=false", ...installTargets]);
	if (registryMode) run(npm, ["audit", "signatures"]);

	const lockfile = readFileSync(resolve(temporary, "package-lock.json"), "utf8");
	if (lockfile.includes("workspace:") || lockfile.includes(repositoryRoot)) {
		throw new Error("Consumer lockfile references the workspace");
	}
	const dependencyTree = JSON.parse(run(npm, ["ls", "s11tnext", "s11tnext-cli", "--json", "--all"]));
	if (dependencyTree.dependencies?.s11tnext === undefined) {
		throw new Error("Consumer did not install s11tnext");
	}
	if (dependencyTree.dependencies?.["s11tnext-cli"] === undefined) {
		throw new Error("Consumer did not install s11tnext-cli");
	}
	const installedRuntimeVersion = dependencyTree.dependencies?.s11tnext?.version;
	const installedCliVersion = dependencyTree.dependencies?.["s11tnext-cli"]?.version;
	if (typeof installedRuntimeVersion !== "string" || installedRuntimeVersion !== installedCliVersion) {
		throw new Error("Consumer installed mismatched runtime and CLI versions");
	}
	for (const entry of manifest?.packages ?? []) {
		if (dependencyTree.dependencies?.[entry.name]?.version !== entry.version) {
			throw new Error(
				`Consumer installed ${entry.name}@${dependencyTree.dependencies?.[entry.name]?.version ?? "missing"}; expected ${entry.version}`,
			);
		}
	}

	const binName = process.platform === "win32" ? "s11tnext.cmd" : "s11tnext";
	if (!existsSync(resolve(temporary, "node_modules/.bin", binName))) {
		throw new Error("Consumer has no local s11tnext binary");
	}
	run(npm, ["exec", "--", "s11tnext", "--help"]);
	run(npm, ["exec", "--", "s11tnext", "lint", "--release-profile", "development"]);
	run(npm, ["exec", "--", "s11tnext", "build", "--release-profile", "development"]);
	run(npm, ["exec", "--", "s11tnext", "build", "--check", "--release-profile", "development"]);
	run(npm, ["exec", "--", "tsc", "-p", "tsconfig.json", "--pretty", "false"]);
	const output = run(node, ["dist/src/index.js"]);
	const result = JSON.parse(output);
	const invocation = result.invocation;
	if (invocation.key !== "consumer.identity") throw new Error("Consumer returned the wrong key");
	if (!invocation.content?.text?.includes("tarballを検証する")) {
		throw new Error("Consumer did not render the runtime value");
	}
	if (
		!result.text?.includes("tarballを検証する") ||
		result.statusText !== "準備完了\n" ||
		result.liveStatusTextJa !== "準備完了\n" ||
		result.liveStatusTextEn !== "Ready\n" ||
		result.fixedStatusAfterLanguageChange !== "準備完了\n"
	) {
		throw new Error("Consumer did not preserve snapshot and live language-switch semantics");
	}
	if (
		invocation.manifest?.requestedLocale !== "ja-JP" ||
		invocation.manifest?.resolvedLocale !== "ja-JP" ||
		invocation.manifest?.fallbackLocales?.length !== 0 ||
		invocation.manifest?.renderedHash === undefined ||
		invocation.manifest?.releaseDigest === undefined ||
		invocation.manifest?.policyDigest === undefined
	) {
		throw new Error("Consumer did not retain the invocation manifest");
	}
	if (
		result.renderedHashVerified !== true ||
		result.requestAudit?.finalManifest?.renderedHash !== invocation.manifest?.renderedHash ||
		result.requestAudit?.renderTrace?.length !== 1 ||
		result.requestAudit?.renderTrace?.[0]?.via !== "invoke"
	) {
		throw new Error("Consumer did not retain the request audit");
	}
	const expectedVersion = registryMode ? installedRuntimeVersion : manifest?.packages[0]?.version;
	if (invocation.manifest?.compilerVersion !== expectedVersion) {
		throw new Error(
			`Consumer compiler version ${invocation.manifest?.compilerVersion} does not match ${expectedVersion}`,
		);
	}
	if (result.compilerVersion !== expectedVersion) {
		throw new Error(`Compiler subpath exported ${result.compilerVersion}; expected ${expectedVersion}`);
	}
	if (result.segments?.[0]?.type !== "variable" || result.segments[0].name !== "value") {
		throw new Error("Compiler subpath did not expose tokenizeTemplate");
	}
	process.stdout.write(
		`${registryMode ? "Registry" : "Tarball"} ESM consumer passed for ${expectedVersion}.\n`,
	);
} finally {
	if (process.env.S11TNEXT_KEEP_CONSUMER_TMP === "1") {
		process.stdout.write(`Consumer workspace retained at ${temporary}.\n`);
	} else {
		rmSync(temporary, { recursive: true, force: true });
	}
}
