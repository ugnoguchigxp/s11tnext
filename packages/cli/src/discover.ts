import { readdirSync, type Stats, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import {
	parseAndResolveAuthoring,
	type ResolvedAuthoringDocument,
	validateResolvedDocuments,
} from "./authoring.js";
import { parseProjectConfig, type S11tnextProjectConfig } from "./config.js";
import { type S11tnextDiagnostic, S11tnextDiagnosticError } from "./diagnostics.js";
import { fileSystemErrorCode, fileSystemFailure } from "./filesystem-diagnostics.js";
import { resolvesWithin } from "./path-safety.js";
import { loadToml } from "./toml-loader.js";

export type LoadedProject = {
	configPath: string;
	configDirectory: string;
	sourceFiles: string[];
	config: S11tnextProjectConfig;
	documents: ResolvedAuthoringDocument[];
	releaseProfile: string;
};

function compareCodeUnits(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function posix(path: string): string {
	return path.split(sep).join("/");
}

function diagnostic(code: string, message: string, file: string, path: Array<string | number> = []): never {
	const value: S11tnextDiagnostic = { code, severity: "error", message, file, path };
	throw new S11tnextDiagnosticError([value]);
}

function discoverFiles(directory: string, configDirectory: string): string[] {
	const files: string[] = [];
	function visit(current: string): void {
		for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) =>
			compareCodeUnits(left.name, right.name),
		)) {
			const path = resolve(current, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile() && entry.name.endsWith(".context.toml")) files.push(path);
		}
	}
	visit(directory);
	return files.sort((left, right) =>
		compareCodeUnits(posix(relative(configDirectory, left)), posix(relative(configDirectory, right))),
	);
}

function optionalStats(
	path: string,
	file: string,
	diagnosticPath: Array<string | number>,
	target: "sourceDirectory",
): Stats;
function optionalStats(
	path: string,
	file: string,
	diagnosticPath: Array<string | number>,
	target: "outputDirectory",
): Stats | undefined;
function optionalStats(
	path: string,
	file: string,
	diagnosticPath: Array<string | number>,
	target: "sourceDirectory" | "outputDirectory",
): Stats | undefined {
	try {
		return statSync(path);
	} catch (error) {
		if (fileSystemErrorCode(error) === "ENOENT" && target === "outputDirectory") return undefined;
		fileSystemFailure(error, { file, path: diagnosticPath, target });
	}
}

export function loadProject(
	configArgument?: string,
	cwd = process.cwd(),
	releaseProfile?: string,
	options: { validateRequiredCoverage?: boolean } = {},
): LoadedProject {
	const configPath = resolve(cwd, configArgument ?? "s11tnext.config.toml");
	const configDirectory = dirname(configPath);
	const configDisplay = posix(relative(cwd, configPath)) || "s11tnext.config.toml";
	const config = parseProjectConfig(loadToml(configPath, configDisplay), configDisplay);
	const sourceDirectory = resolve(configDirectory, config.sourceDir);
	const relativeSource = relative(configDirectory, sourceDirectory);
	if (isAbsolute(relativeSource) || relativeSource === ".." || relativeSource.startsWith(`..${sep}`)) {
		diagnostic("S11TNEXT_CONFIG_INVALID", "source_dir escapes the config directory", configDisplay, [
			"source_dir",
		]);
	}
	const sourceStats = optionalStats(sourceDirectory, configDisplay, ["source_dir"], "sourceDirectory");
	if (!sourceStats.isDirectory()) {
		diagnostic("S11TNEXT_CONFIG_INVALID", "Configured source_dir is not a directory", configDisplay, [
			"source_dir",
		]);
	}
	if (!resolvesWithin(configDirectory, sourceDirectory)) {
		diagnostic("S11TNEXT_CONFIG_INVALID", "source_dir resolves outside the config directory", configDisplay, [
			"source_dir",
		]);
	}
	const outputDirectory = resolve(configDirectory, config.outDir);
	if (!resolvesWithin(configDirectory, outputDirectory)) {
		diagnostic("S11TNEXT_CONFIG_INVALID", "out_dir resolves outside the config directory", configDisplay, [
			"out_dir",
		]);
	}
	const outputStats = optionalStats(outputDirectory, configDisplay, ["out_dir"], "outputDirectory");
	if (outputStats !== undefined && !outputStats.isDirectory()) {
		diagnostic("S11TNEXT_CONFIG_INVALID", "Configured out_dir is not a directory", configDisplay, [
			"out_dir",
		]);
	}
	let absoluteFiles: string[];
	try {
		absoluteFiles = discoverFiles(sourceDirectory, configDirectory);
	} catch (error) {
		fileSystemFailure(error, {
			file: configDisplay,
			path: ["source_dir"],
			target: "sourceDirectory",
		});
	}
	if (absoluteFiles.length === 0) {
		diagnostic("S11TNEXT_SOURCE_EMPTY", "No .context.toml files were found", configDisplay, ["source_dir"]);
	}
	if (releaseProfile === undefined) {
		diagnostic("S11TNEXT_RELEASE_PROFILE_REQUIRED", "--release-profile is required", configDisplay, [
			"release_profiles",
		]);
	}
	const sourceFiles = absoluteFiles.map((file) => posix(relative(configDirectory, file)));
	const documents = absoluteFiles.map((file) => {
		const displayFile = posix(relative(configDirectory, file));
		const sourcePath = posix(relative(sourceDirectory, file));
		return parseAndResolveAuthoring(
			loadToml(file, displayFile),
			displayFile,
			sourcePath,
			config,
			releaseProfile,
			options,
		);
	});
	validateResolvedDocuments(documents);
	return {
		config,
		configPath,
		configDirectory,
		documents,
		sourceFiles,
		releaseProfile,
	};
}
