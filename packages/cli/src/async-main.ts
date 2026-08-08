import {
	CliUsageError,
	takeCliOption,
} from "./cli-arguments.js";
import { runCli, type CommandIo } from "./main.js";
import { watchProject } from "./watch-command.js";

export type AsyncCommandOptions = {
	signal?: AbortSignal;
};

export async function runCliAsync(
	argumentsInput: readonly string[],
	io: CommandIo = {
		stdout: (value) => process.stdout.write(value),
		stderr: (value) => process.stderr.write(value),
		cwd: process.cwd(),
	},
	options: AsyncCommandOptions = {},
): Promise<number> {
	if (argumentsInput[0] !== "watch") return runCli(argumentsInput, io);
	if (argumentsInput.includes("--help") || argumentsInput.includes("-h")) {
		return runCli(["help", "watch"], io);
	}
	const arguments_ = [...argumentsInput.slice(1)];
	try {
		const format = takeCliOption(arguments_, "--format") ?? "human";
		if (format !== "human" && format !== "json") {
			throw new CliUsageError("--format must be human or json");
		}
		const config = takeCliOption(arguments_, "--config");
		const releaseProfile = takeCliOption(arguments_, "--release-profile");
		if (arguments_.length > 0) {
			throw new CliUsageError(`Unknown argument: ${arguments_[0]}`);
		}
		const buildArguments = [
			"build",
			...(config === undefined ? [] : ["--config", config]),
			...(releaseProfile === undefined
				? []
				: ["--release-profile", releaseProfile]),
			"--format",
			format,
		];
		const initial = runCli(buildArguments, io);
		if (initial !== 0) return initial;
		io.stdout(
			format === "json"
				? `${JSON.stringify({ ok: true, watching: true, config: config ?? "s11tnext.config.toml" })}\n`
				: `Watching ${config ?? "s11tnext.config.toml"} and .context.toml files. Press Ctrl-C to stop.\n`,
		);
		const controller = options.signal === undefined ? new AbortController() : undefined;
		await watchProject({
			cwd: io.cwd,
			signal: options.signal ?? controller!.signal,
			...(config === undefined ? {} : { config }),
			onChange: () => {
				runCli(buildArguments, io);
			},
			onError: (error) => {
				const message = error instanceof Error ? error.stack ?? error.message : String(error);
				io.stderr(`S11TNEXT_INTERNAL_ERROR: ${message}\n`);
			},
		});
		return 0;
	} catch (error) {
		if (error instanceof CliUsageError) {
			let help = "";
			runCli(["help", "watch"], {
				...io,
				stdout: (value) => {
					help += value;
				},
			});
			io.stderr(`${error.message}\n\n${help}`);
			return 2;
		}
		const message = error instanceof Error ? error.stack ?? error.message : String(error);
		io.stderr(`S11TNEXT_INTERNAL_ERROR: ${message}\n`);
		return 3;
	}
}
