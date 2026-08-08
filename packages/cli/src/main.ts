import { COMPILER_VERSION } from "s11tnext/compiler";

import { buildProject } from "./build-command.js";
import { CliUsageError, takeCliOption } from "./cli-arguments.js";
import { completionScript, type CompletionShell } from "./completion.js";
import { S11tnextDiagnosticError, type S11tnextDiagnostic } from "./diagnostics.js";
import { initProject, type InitTemplate } from "./init-command.js";
import { inspectContext, inspectCoverage } from "./inspect-command.js";
import { lintProject } from "./lint-command.js";

export const HELP = `s11tnext - LLM prompt-message authoring and build tools

Usage:
  s11tnext init [--template minimal|production] [--locale en-US] [--keyspace app] [--owner team] [--release-profile development] [--no-editor] [--dry-run] [--format human|json]
  s11tnext lint --release-profile name [--config s11tnext.config.toml] [--format human|json]
  s11tnext build --release-profile name [--config s11tnext.config.toml] [--check] [--format human|json]
  s11tnext watch --release-profile name [--config s11tnext.config.toml] [--format human|json]
  s11tnext inspect <key> --release-profile name [--resolved] [--locale ja-JP] [--config s11tnext.config.toml] [--format human|json]
  s11tnext inspect --coverage --locale en-US --release-profile name [--fallback-locale ja-JP] [--config s11tnext.config.toml] [--format human|json]
  s11tnext completion bash|zsh|fish
  s11tnext help [command]
  s11tnext --version
  s11tnext --help
`;

const COMMAND_HELP: Record<string, string> = {
	init: `Usage: s11tnext init [--template minimal|production] [--locale locale] [--keyspace name] [--owner name] [--release-profile name] [--no-editor] [--dry-run] [--format human|json]

Create a non-destructive starter project. Existing files are never overwritten. The default editor
setup creates .taplo.toml associations for the JSON Schemas shipped with s11tnext-cli.
`,
	lint: `Usage: s11tnext lint --release-profile name [--config path] [--format human|json]

Validate configuration, authored contexts, locale policy, and variable safety without writing files.
`,
	build: `Usage: s11tnext build --release-profile name [--config path] [--check] [--format human|json]

Compile deterministic catalog.json and catalog.generated.ts outputs.
--check verifies that both generated files are current without writing them.
`,
	watch: `Usage: s11tnext watch --release-profile name [--config path] [--format human|json]

Build once, then rebuild when the project config or a .context.toml file changes. Validation failures
are reported without stopping the watcher.
`,
	inspect: `Usage:
  s11tnext inspect <key> --release-profile name [--resolved] [--locale locale] [--config path] [--format human|json]
  s11tnext inspect --coverage --locale locale --release-profile name [--fallback-locale locale] [--config path] [--format human|json]

Inspect a canonical context or report direct, fallback, and missing locale coverage.
`,
	completion: `Usage: s11tnext completion bash|zsh|fish

Print a completion script to stdout. Evaluate it for the current shell or save it in the shell's
completion directory.
`,
	help: `Usage: s11tnext help [init|lint|build|watch|inspect|completion|version]

Show global help or detailed help for one command.
`,
	version: `Usage: s11tnext version

Print the S11tnext CLI and compiler version.
`,
};

export type CommandIo = {
	stdout(value: string): void;
	stderr(value: string): void;
	cwd: string;
};

function takeFlag(arguments_: string[], name: string): boolean {
	const index = arguments_.indexOf(name);
	if (index === -1) return false;
	arguments_.splice(index, 1);
	return true;
}

function takeOptions(arguments_: string[], name: string): string[] {
	const values: string[] = [];
	for (;;) {
		const value = takeCliOption(arguments_, name);
		if (value === undefined) return values;
		values.push(value);
	}
}

function formatDiagnostic(diagnostic: S11tnextDiagnostic): string {
	const location =
		diagnostic.line === undefined
			? diagnostic.file
			: `${diagnostic.file}:${diagnostic.line}${diagnostic.column === undefined ? "" : `:${diagnostic.column}`}`;
	const path = diagnostic.path.length === 0 ? "" : ` [${diagnostic.path.join(".")}]`;
	return `${location}: ${diagnostic.severity} ${diagnostic.code}${path}: ${diagnostic.message}`;
}

function formatInspectValue(value: unknown, indentation = 0): string[] {
	const prefix = "\t".repeat(indentation);
	if (value === null || typeof value !== "object") return [`${prefix}${String(value)}`];
	if (Array.isArray(value)) {
		if (value.length === 0) return [`${prefix}[]`];
		if (value.every((item) => item === null || typeof item !== "object")) {
			return [`${prefix}[${value.map((item) => JSON.stringify(item)).join(", ")}]`];
		}
		return value.flatMap((item, index) => [
			`${prefix}${index}:`,
			...formatInspectValue(item, indentation + 1),
		]);
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return [`${prefix}{}`];
	return entries.flatMap(([key, item]) => {
		if (item === null || typeof item !== "object") return [`${prefix}${key}: ${String(item)}`];
		if (Array.isArray(item) && item.every((entry) => entry === null || typeof entry !== "object")) {
			return [`${prefix}${key}: [${item.map((entry) => JSON.stringify(entry)).join(", ")}]`];
		}
		return [`${prefix}${key}:`, ...formatInspectValue(item, indentation + 1)];
	});
}

function formatInspectHuman(value: unknown): string {
	return `${formatInspectValue(value).join("\n")}\n`;
}

export function runCli(
	argumentsInput: readonly string[],
	io: CommandIo = {
		stdout: (value) => process.stdout.write(value),
		stderr: (value) => process.stderr.write(value),
		cwd: process.cwd(),
	},
): number {
	const arguments_ = [...argumentsInput];
	if (
		arguments_.length === 0 ||
		arguments_[0] === "--help" ||
		arguments_[0] === "-h"
	) {
		io.stdout(HELP);
		return 0;
	}
	if (
		arguments_.length === 1 &&
		(arguments_[0] === "--version" || arguments_[0] === "-V")
	) {
		io.stdout(`${COMPILER_VERSION}\n`);
		return 0;
	}
	const command = arguments_.shift();
	if (command === "version") {
		if (arguments_.length > 0) {
			io.stderr(`version does not accept arguments\n\n${COMMAND_HELP.version}`);
			return 2;
		}
		io.stdout(`${COMPILER_VERSION}\n`);
		return 0;
	}
	if (command === "help") {
		const topic = arguments_.shift();
		if (arguments_.length > 0) {
			io.stderr(`help accepts at most one command\n\n${COMMAND_HELP.help}`);
			return 2;
		}
		if (topic === undefined) {
			io.stdout(HELP);
			return 0;
		}
		const help = COMMAND_HELP[topic];
		if (help === undefined) {
			io.stderr(`Unknown help topic: ${topic}\n\n${COMMAND_HELP.help}`);
			return 2;
		}
		io.stdout(help);
		return 0;
	}
	if (arguments_.includes("--help") || arguments_.includes("-h")) {
		const help = command === undefined ? undefined : COMMAND_HELP[command];
		if (help === undefined) {
			io.stderr(`Unknown command: ${command ?? ""}\n\n${HELP}`);
			return 2;
		}
		io.stdout(help);
		return 0;
	}
	let format = "human";
	try {
		if (command === "completion") {
			const shell = arguments_.shift();
			if (
				arguments_.length > 0 ||
				(shell !== "bash" && shell !== "zsh" && shell !== "fish")
			) {
				throw new CliUsageError(
					"completion requires exactly one shell: bash, zsh, or fish",
				);
			}
			io.stdout(completionScript(shell as CompletionShell));
			return 0;
		}
		format = takeCliOption(arguments_, "--format") ?? "human";
		if (format !== "human" && format !== "json") {
			throw new CliUsageError("--format must be human or json");
		}
		const config = takeCliOption(arguments_, "--config");
		const releaseProfile = takeCliOption(arguments_, "--release-profile");
		if (command === "init") {
			if (config !== undefined) throw new CliUsageError("init does not accept --config");
			const template = takeCliOption(arguments_, "--template") ?? "minimal";
			if (template !== "minimal" && template !== "production") {
				throw new CliUsageError("--template must be minimal or production");
			}
			const locale = takeCliOption(arguments_, "--locale");
			const keyspace = takeCliOption(arguments_, "--keyspace");
			const owner = takeCliOption(arguments_, "--owner");
			const dryRun = takeFlag(arguments_, "--dry-run");
			const noEditor = takeFlag(arguments_, "--no-editor");
			if (arguments_.length > 0) throw new CliUsageError(`Unknown argument: ${arguments_[0]}`);
			const result = initProject({
				cwd: io.cwd,
				template: template as InitTemplate,
				dryRun,
				editor: !noEditor,
				...(locale === undefined ? {} : { locale }),
				...(keyspace === undefined ? {} : { keyspace }),
				...(owner === undefined ? {} : { owner }),
				...(releaseProfile === undefined ? {} : { releaseProfile }),
			});
			io.stdout(
				format === "json"
					? `${JSON.stringify({ ok: true, ...result })}\n`
					: `${dryRun ? "Would create" : "Created"} ${result.template} S11tnext project:\n${result.files.map((file) => `  ${file}`).join("\n")}\n\nNext: s11tnext build --release-profile ${result.releaseProfile}\n`,
			);
			return 0;
		}
		if (command === "lint") {
			if (arguments_.length > 0) throw new CliUsageError(`Unknown argument: ${arguments_[0]}`);
			const result = lintProject(config, io.cwd, releaseProfile);
			io.stdout(
				format === "json"
					? `${JSON.stringify({ ok: true, ...result })}\n`
					: `Lint passed: ${result.contexts} context(s) in ${result.files} file(s).\n`,
			);
			return 0;
		}
		if (command === "build") {
			const check = takeFlag(arguments_, "--check");
			if (arguments_.length > 0) throw new CliUsageError(`Unknown argument: ${arguments_[0]}`);
			const result = buildProject({
				...(config === undefined ? {} : { config }),
				...(releaseProfile === undefined ? {} : { releaseProfile }),
				check,
				cwd: io.cwd,
			});
			io.stdout(
				format === "json"
					? `${JSON.stringify({ ok: true, ...result })}\n`
					: check
						? `Generated outputs are current (${result.catalogDigest}).\n`
						: `Built ${result.catalogPath} and ${result.typesPath} (${result.catalogDigest}).\n`,
			);
			return 0;
		}
		if (command === "inspect") {
			const locale = takeCliOption(arguments_, "--locale");
			const fallbackLocales = takeOptions(arguments_, "--fallback-locale");
			const coverage = takeFlag(arguments_, "--coverage");
			const resolved = takeFlag(arguments_, "--resolved");
			const key = arguments_.shift();
			if (coverage) {
				if (key !== undefined) {
					throw new CliUsageError("inspect --coverage does not accept a context key");
				}
				if (resolved) throw new CliUsageError("inspect --coverage does not accept --resolved");
				if (locale === undefined) throw new CliUsageError("inspect --coverage requires --locale");
				if (releaseProfile === undefined) {
					throw new CliUsageError("inspect --coverage requires --release-profile");
				}
				const result = inspectCoverage({
					...(config === undefined ? {} : { config }),
					locale,
					fallbackLocales,
					releaseProfile,
					cwd: io.cwd,
				});
				io.stdout(
					format === "json" ? `${JSON.stringify(result, null, 2)}\n` : formatInspectHuman(result),
				);
				return 0;
			}
			if (fallbackLocales.length > 0) {
				throw new CliUsageError("--fallback-locale requires --coverage");
			}
			if (key === undefined) throw new CliUsageError("inspect requires a context key");
			if (arguments_.length > 0) throw new CliUsageError(`Unknown argument: ${arguments_[0]}`);
			const result = inspectContext(key, {
				...(config === undefined ? {} : { config }),
				...(locale === undefined ? {} : { locale }),
				...(releaseProfile === undefined ? {} : { releaseProfile }),
				resolved,
				cwd: io.cwd,
			});
			io.stdout(
				format === "json" ? `${JSON.stringify(result, null, 2)}\n` : formatInspectHuman(result),
			);
			return 0;
		}
		if (command === "watch") {
			throw new CliUsageError("watch requires the asynchronous CLI entry point");
		}
		throw new CliUsageError(`Unknown command: ${command ?? ""}`);
	} catch (error) {
		if (error instanceof CliUsageError) {
			io.stderr(`${error.message}\n\n${HELP}`);
			return 2;
		}
		if (error instanceof S11tnextDiagnosticError) {
			const usageDiagnostic = error.diagnostics.find((diagnostic) =>
				diagnostic.code === "S11TNEXT_RELEASE_PROFILE_REQUIRED",
			);
			if (usageDiagnostic !== undefined) {
				io.stderr(`${usageDiagnostic.message}\n\n${HELP}`);
				return 2;
			}
			io.stderr(
				format === "json"
					? `${JSON.stringify(error.diagnostics)}\n`
					: `${error.diagnostics.map(formatDiagnostic).join("\n")}\n`,
			);
			return 1;
		}
		const message = error instanceof Error ? error.stack ?? error.message : String(error);
		io.stderr(`S11TNEXT_INTERNAL_ERROR: ${message}\n`);
		return 3;
	}
}
