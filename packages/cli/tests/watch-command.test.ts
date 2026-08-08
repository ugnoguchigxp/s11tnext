import type { FSWatcher } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { watchProject } from "../src/watch-command.js";

type WatchListener = (
	eventType: "rename" | "change",
	filename: string | Buffer | null,
) => void;

describe("watch command", () => {
	it("debounces relevant files, ignores other files, and closes on abort", async () => {
		let listener: WatchListener | undefined;
		let scheduled: (() => void) | undefined;
		const close = vi.fn();
		const cancel = vi.fn();
		const onChange = vi.fn();
		const controller = new AbortController();
		const promise = watchProject({
			cwd: "/project",
			signal: controller.signal,
			onChange,
			onError: vi.fn(),
			watchFactory: (_path, _options, callback) => {
				listener = callback;
				return { close };
			},
			schedule: (callback) => {
				scheduled = callback;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel,
		});

		listener?.("change", "README.md");
		expect(scheduled).toBeUndefined();
		listener?.("change", "contexts/app/greeting.context.toml");
		const first = scheduled;
		listener?.("rename", "s11tnext.config.toml");
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(first).not.toBe(scheduled);
		scheduled?.();
		expect(onChange).toHaveBeenCalledTimes(1);

		controller.abort();
		await expect(promise).resolves.toBeUndefined();
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("reports rebuild exceptions without stopping", async () => {
		let listener: WatchListener | undefined;
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
			watchFactory: (_path, _options, callback) => {
				listener = callback;
				return { close: vi.fn() };
			},
			schedule: (callback) => {
				callback();
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
		});

		listener?.("change", null);
		expect(onError).toHaveBeenCalledWith(expected);
		controller.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it("rejects fatal watcher errors and removes listeners", async () => {
		let watcherError: ((error: Error) => void) | undefined;
		const close = vi.fn();
		const removeListener = vi.fn();
		const controller = new AbortController();
		const expected = new Error("watcher failed");
		const promise = watchProject({
			cwd: "/project",
			signal: controller.signal,
			onChange: vi.fn(),
			onError: vi.fn(),
			watchFactory: () => ({
				close,
				on: ((_event: "error", callback: (error: Error) => void) => {
					watcherError = callback;
				}) as FSWatcher["on"],
				removeListener: ((_event: "error", callback: (error: Error) => void) => {
					removeListener(callback);
				}) as FSWatcher["removeListener"],
			}),
		});

		watcherError?.(expected);
		await expect(promise).rejects.toBe(expected);
		expect(removeListener).toHaveBeenCalledWith(watcherError);
		expect(close).toHaveBeenCalledTimes(1);
	});
});
