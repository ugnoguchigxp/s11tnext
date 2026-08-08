import type { FSWatcher } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { watchProject } from "../src/watch-command.js";

type WatchListener = (
	eventType: "rename" | "change",
	filename: string | Buffer | null,
) => void;

describe("watch command", () => {
	it("watches only the config and source directories and refreshes changed sources", async () => {
		const listeners = new Map<string, WatchListener>();
		const closes = new Map<string, ReturnType<typeof vi.fn>>();
		const watchCalls: Array<{ path: string; recursive: boolean }> = [];
		let sourceDirectory = "/project/contexts";
		let scheduled: (() => void) | undefined;
		const cancel = vi.fn();
		const onChange = vi.fn(() => true);
		const controller = new AbortController();
		const promise = watchProject({
			cwd: "/project",
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
			{ path: "/project", recursive: false },
			{ path: "/project/contexts", recursive: true },
		]);
		listeners.get("/project")?.("change", "README.md");
		expect(scheduled).toBeUndefined();
		listeners.get("/project/contexts")?.("change", "README.md");
		expect(scheduled).toBeUndefined();
		listeners.get("/project/contexts")?.("change", "app/greeting.context.toml");
		expect(scheduled).toBeTypeOf("function");
		const sourceBuild = scheduled;

		sourceDirectory = "/project/prompts";
		listeners.get("/project")?.("rename", "s11tnext.config.toml");
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(scheduled).not.toBe(sourceBuild);
		scheduled?.();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(watchCalls.at(-1)).toEqual({ path: "/project/prompts", recursive: true });
		expect(closes.get("/project/contexts")).toHaveBeenCalledTimes(1);

		controller.abort();
		await expect(promise).resolves.toBeUndefined();
		expect(closes.get("/project")).toHaveBeenCalledTimes(1);
		expect(closes.get("/project/prompts")).toHaveBeenCalledTimes(1);
	});

	it("rebuilds for source renames and reports rebuild exceptions without stopping", async () => {
		let sourceListener: WatchListener | undefined;
		const expected = new Error("rebuild failed");
		const onError = vi.fn();
		const controller = new AbortController();
		const promise = watchProject({
			cwd: "/project",
			signal: controller.signal,
			onChange: () => {
				throw expected;
			},
			onError,
			debounceMilliseconds: 0,
			resolveSourceDirectory: () => "/project/contexts",
			watchFactory: (path, _options, listener) => {
				if (path === "/project/contexts") sourceListener = listener;
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

	it("keeps the current source watcher when a changed config does not build", async () => {
		let configListener: WatchListener | undefined;
		const watchFactory = vi.fn((path: string, _options: { recursive: boolean }, listener: WatchListener) => {
			if (path === "/project") configListener = listener;
			return { close: vi.fn() };
		});
		const controller = new AbortController();
		const promise = watchProject({
			cwd: "/project",
			signal: controller.signal,
			onChange: () => false,
			onError: vi.fn(),
			resolveSourceDirectory: () => "/project/contexts",
			watchFactory,
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		configListener?.("change", null);
		expect(watchFactory).toHaveBeenCalledTimes(2);
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
			cwd: "/project",
			signal: controller.signal,
			onChange: vi.fn(),
			onError: vi.fn(),
			resolveSourceDirectory: () => "/project/contexts",
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
				cwd: "/project",
				signal: controller.signal,
				onChange: vi.fn(),
				onError: vi.fn(),
				watchFactory,
			}),
		).resolves.toBeUndefined();
		expect(watchFactory).not.toHaveBeenCalled();
	});
});
