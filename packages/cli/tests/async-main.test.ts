import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandIo } from "../src/main.js";
import type { WatchCommandOptions } from "../src/watch-command.js";

const watchProject = vi.hoisted(() => vi.fn<(options: WatchCommandOptions) => Promise<void>>());

vi.mock("../src/watch-command.js", () => ({ watchProject }));

import { runCliAsync } from "../src/async-main.js";

const temporaryDirectories: string[] = [];

function temporaryFixture(): string {
	const directory = mkdtempSync(join(tmpdir(), "s11tnext-async-main-"));
	temporaryDirectories.push(directory);
	cpSync(new URL("../../../fixtures/valid/content-first", import.meta.url), directory, {
		recursive: true,
	});
	return directory;
}

function temporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "s11tnext-async-main-"));
	temporaryDirectories.push(directory);
	return directory;
}

function capture(cwd: string): { io: CommandIo; stdout(): string; stderr(): string } {
	let stdout = "";
	let stderr = "";
	return {
		io: {
			cwd,
			stdout: (value) => {
				stdout += value;
			},
			stderr: (value) => {
				stderr += value;
			},
		},
		stdout: () => stdout,
		stderr: () => stderr,
	};
}

afterEach(() => {
	watchProject.mockReset();
	vi.restoreAllMocks();
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("asynchronous CLI entry point", () => {
	it("delegates synchronous commands and supports the default process IO", async () => {
		const directory = temporaryDirectory();
		const output = capture(directory);
		expect(await runCliAsync(["version"], output.io)).toBe(0);
		expect(output.stdout()).toMatch(/^\d+\.\d+\.\d+\n$/);
		expect(watchProject).not.toHaveBeenCalled();

		const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		expect(await runCliAsync(["version"])).toBe(0);
		expect(await runCliAsync(["unknown"])).toBe(2);
		expect(stdout).toHaveBeenCalled();
		expect(stderr).toHaveBeenCalled();
	});

	it("renders watch help and usage failures without starting a watcher", async () => {
		for (const arguments_ of [
			["watch", "--help"],
			["watch", "-h"],
			["watch", "--format", "xml"],
			["watch", "--config"],
			["watch", "unexpected"],
		]) {
			const output = capture(temporaryDirectory());
			const code = await runCliAsync(arguments_, output.io);
			if (arguments_.includes("--help") || arguments_.includes("-h")) {
				expect(code).toBe(0);
				expect(output.stdout()).toContain("Usage: s11tnext watch");
			} else {
				expect(code).toBe(2);
				expect(output.stderr()).toContain("Usage: s11tnext watch");
			}
		}
		expect(watchProject).not.toHaveBeenCalled();
	});

	it("returns the initial build failure without starting a watcher", async () => {
		const output = capture(temporaryDirectory());
		expect(
			await runCliAsync(["watch", "--release-profile", "production"], output.io),
		).toBe(1);
		expect(output.stderr()).toContain("S11TNEXT_FILE_NOT_FOUND");
		expect(watchProject).not.toHaveBeenCalled();
	});

	it("runs JSON watch mode and exposes successful and failed rebuild callbacks", async () => {
		const directory = temporaryFixture();
		const output = capture(directory);
		const controller = new AbortController();
		watchProject.mockResolvedValueOnce();
		expect(
			await runCliAsync(
				[
					"watch",
					"--config",
					"s11tnext.config.toml",
					"--release-profile",
					"production",
					"--format",
					"json",
				],
				output.io,
				{ signal: controller.signal },
			),
		).toBe(0);
		expect(output.stdout()).toContain('"watching":true');
		const options = watchProject.mock.calls[0]?.[0];
		expect(options).toMatchObject({
			cwd: directory,
			config: "s11tnext.config.toml",
			signal: controller.signal,
		});
		expect(options?.onChange()).toBe(true);

		writeFileSync(join(directory, "s11tnext.config.toml"), "invalid = [\n");
		expect(options?.onChange()).toBe(false);
		options?.onError(new Error("rebuild crashed"));
		options?.onError("non-error failure");
		expect(output.stderr()).toContain("S11TNEXT_INTERNAL_ERROR: Error: rebuild crashed");
		expect(output.stderr()).toContain("S11TNEXT_INTERNAL_ERROR: non-error failure");
	});

	it("normalizes watcher failures and creates an internal abort signal", async () => {
		const directory = temporaryFixture();
		const errorOutput = capture(directory);
		watchProject.mockRejectedValueOnce(new Error("watcher failed"));
		expect(
			await runCliAsync(["watch", "--release-profile", "production"], errorOutput.io),
		).toBe(3);
		expect(errorOutput.stderr()).toContain("S11TNEXT_INTERNAL_ERROR: Error: watcher failed");
		expect(watchProject.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);

		const valueOutput = capture(directory);
		watchProject.mockRejectedValueOnce("watcher stopped");
		expect(
			await runCliAsync(["watch", "--release-profile", "production"], valueOutput.io),
		).toBe(3);
		expect(valueOutput.stderr()).toContain("S11TNEXT_INTERNAL_ERROR: watcher stopped");
	});
});
