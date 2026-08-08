import type { FSWatcher } from "node:fs";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveProjectSourceDirectory, watchProject } from "../src/watch-command.js";

type WatchListener = (eventType: "rename" | "change", filename: string | Buffer | null) => void;

const temporaryDirectories: string[] = [];
const projectDirectory = resolve("/project");
const projectContexts = resolve(projectDirectory, "contexts");
const projectPrompts = resolve(projectDirectory, "prompts");
const projectNewContexts = resolve(projectDirectory, "new-contexts");

function temporaryFixture(): string {
	const directory = mkdtempSync(join(tmpdir(), "s11tnext-watch-"));
	temporaryDirectories.push(directory);
	cpSync(new URL("../../../fixtures/valid/content-first", import.meta.url), directory, { recursive: true });
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("watch command", () => {
	it.skipIf(process.platform === "win32")(
		"resolves only source directories contained by the config directory",
		() => {
			const directory = temporaryFixture();
			const outside = temporaryFixture();
			const configPath = join(directory, "s11tnext.config.toml");
			expect(resolveProjectSourceDirectory(configPath, directory)).toBe(join(directory, "contexts"));
			symlinkSync(join(outside, "contexts"), join(directory, "linked-contexts"), "dir");
			writeFileSync(
				configPath,
				readFileSync(configPath, "utf8").replace('source_dir = "contexts"', 'source_dir = "linked-contexts"'),
			);
			expect(() => resolveProjectSourceDirectory(configPath, directory)).toThrow(
				"source_dir resolves outside the config directory",
			);
		},
	);

	it("watches only the config and source directories and refreshes changed sources", async () => {
		const listeners = new Map<string, WatchListener>();
		const closes = new Map<string, ReturnType<typeof vi.fn>>();
		const watchCalls: Array<{ path: string; recursive: boolean }> = [];
		let sourceDirectory = projectContexts;
		let scheduled: (() => void) | undefined;
		const cancel = vi.fn();
		const onChange = vi.fn(() => true);
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange,
			onError: vi.fn(),
			resolveSourceDirectory: () => sourceDirectory,
			watchFactory: (path, options, listener) => {
				watchCalls.push({ path, recursive: options.recursive });
				listeners.set(path, listener);
				const close = vi.fn();
				closes.set(path, close);
				return { close };
			},
			schedule: (callback) => {
				scheduled = callback;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel,
		});

		expect(watchCalls).toEqual([
			{ path: projectDirectory, recursive: false },
			{ path: projectContexts, recursive: true },
		]);
		listeners.get(projectDirectory)?.("change", "README.md");
		expect(scheduled).toBeUndefined();
		listeners.get(projectContexts)?.("change", "README.md");
		expect(scheduled).toBeUndefined();
		listeners.get(projectContexts)?.("change", "app/greeting.context.toml");
		expect(scheduled).toBeTypeOf("function");
		const sourceBuild = scheduled;

		sourceDirectory = projectPrompts;
		listeners.get(projectDirectory)?.("rename", "s11tnext.config.toml");
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(scheduled).not.toBe(sourceBuild);
		scheduled?.();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(watchCalls.at(-1)).toEqual({ path: projectPrompts, recursive: true });
		expect(closes.get(projectContexts)).toHaveBeenCalledTimes(1);

		controller.abort();
		await expect(promise).resolves.toBeUndefined();
		expect(closes.get(projectDirectory)).toHaveBeenCalledTimes(1);
		expect(closes.get(projectPrompts)).toHaveBeenCalledTimes(1);
	});

	it("rebuilds for source renames and reports rebuild exceptions without stopping", async () => {
		let sourceListener: WatchListener | undefined;
		const expected = new Error("rebuild failed");
		const onError = vi.fn();
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange: () => {
				throw expected;
			},
			onError,
			debounceMilliseconds: 0,
			resolveSourceDirectory: () => projectContexts,
			watchFactory: (path, _options, listener) => {
				if (path === projectContexts) sourceListener = listener;
				return { close: vi.fn() };
			},
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		sourceListener?.("rename", "nested-directory");
		expect(onError).toHaveBeenCalledWith(expected);
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("does not reparse unchanged config after a successful source rebuild", async () => {
		let sourceListener: WatchListener | undefined;
		const resolveSourceDirectory = vi.fn(() => projectContexts);
		const onChange = vi.fn(() => true);
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange,
			onError: vi.fn(),
			resolveSourceDirectory,
			watchFactory: (path, _options, listener) => {
				if (path === projectContexts) sourceListener = listener;
				return { close: vi.fn() };
			},
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		sourceListener?.("change", "app/greeting.context.toml");
		expect(onChange).toHaveBeenCalledOnce();
		expect(resolveSourceDirectory).toHaveBeenCalledOnce();
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("keeps the current source watcher when a changed config cannot be parsed", async () => {
		let configListener: WatchListener | undefined;
		let resolveCalls = 0;
		const onError = vi.fn();
		const watchFactory = vi.fn((path: string, _options: { recursive: boolean }, listener: WatchListener) => {
			if (path === projectDirectory) configListener = listener;
			return { close: vi.fn() };
		});
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange: () => false,
			onError,
			resolveSourceDirectory: () => {
				resolveCalls += 1;
				if (resolveCalls === 1) return projectContexts;
				throw new Error("invalid config");
			},
			watchFactory,
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		configListener?.("change", null);
		expect(watchFactory).toHaveBeenCalledTimes(2);
		expect(onError).not.toHaveBeenCalled();
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("moves to a valid new source directory while its first build is failing", async () => {
		let configListener: WatchListener | undefined;
		let sourceDirectory = projectContexts;
		const closes = new Map<string, ReturnType<typeof vi.fn>>();
		const watchFactory = vi.fn((path: string, _options: { recursive: boolean }, listener: WatchListener) => {
			if (path === projectDirectory) configListener = listener;
			const close = vi.fn();
			closes.set(path, close);
			return { close };
		});
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange: () => false,
			onError: vi.fn(),
			resolveSourceDirectory: () => sourceDirectory,
			watchFactory,
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		sourceDirectory = projectNewContexts;
		configListener?.("change", "s11tnext.config.toml");
		expect(watchFactory).toHaveBeenLastCalledWith(
			projectNewContexts,
			{ recursive: true },
			expect.any(Function),
		);
		expect(closes.get(projectContexts)).toHaveBeenCalledOnce();
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("reports config reparse failures that contradict a successful rebuild", async () => {
		let configListener: WatchListener | undefined;
		let resolveCalls = 0;
		const expected = new Error("config changed during rebuild");
		const onError = vi.fn();
		const controller = new AbortController();
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange: () => true,
			onError,
			resolveSourceDirectory: () => {
				resolveCalls += 1;
				if (resolveCalls === 1) return projectContexts;
				throw expected;
			},
			watchFactory: (path, _options, listener) => {
				if (path === projectDirectory) configListener = listener;
				return { close: vi.fn() };
			},
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		configListener?.("change", "s11tnext.config.toml");
		expect(onError).toHaveBeenCalledWith(expected);
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("rejects fatal watcher errors and removes listeners from every watcher", async () => {
		const watcherErrors: Array<(error: Error) => void> = [];
		const closes: Array<ReturnType<typeof vi.fn>> = [];
		const removeListener = vi.fn();
		const controller = new AbortController();
		const expected = new Error("watcher failed");
		const promise = watchProject({
			cwd: projectDirectory,
			signal: controller.signal,
			onChange: vi.fn(),
			onError: vi.fn(),
			resolveSourceDirectory: () => projectContexts,
			watchFactory: () => {
				const close = vi.fn();
				closes.push(close);
				return {
					close,
					on: ((_event: "error", callback: (error: Error) => void) => {
						watcherErrors.push(callback);
					}) as FSWatcher["on"],
					removeListener: ((_event: "error", callback: (error: Error) => void) => {
						removeListener(callback);
					}) as FSWatcher["removeListener"],
				};
			},
		});

		watcherErrors[1]?.(expected);
		await expect(promise).rejects.toBe(expected);
		expect(removeListener).toHaveBeenCalledTimes(2);
		for (const close of closes) expect(close).toHaveBeenCalledTimes(1);
	});

	it("does not create watchers after an early abort", async () => {
		const controller = new AbortController();
		controller.abort();
		const watchFactory = vi.fn();
		await expect(
			watchProject({
				cwd: projectDirectory,
				signal: controller.signal,
				onChange: vi.fn(),
				onError: vi.fn(),
				watchFactory,
			}),
		).resolves.toBeUndefined();
		expect(watchFactory).not.toHaveBeenCalled();
	});
});
