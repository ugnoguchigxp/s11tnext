import { type FSWatcher, watch } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { parseProjectConfig } from "./config.js";
import { loadToml } from "./toml-loader.js";

type WatchListener = (eventType: "rename" | "change", filename: string | Buffer | null) => void;

type WatchHandle = Pick<FSWatcher, "close"> & Partial<Pick<FSWatcher, "on" | "removeListener">>;

type WatchRegistration = {
	handle: WatchHandle;
	onError(error: Error): void;
};

export type WatchCommandOptions = {
	config?: string;
	cwd: string;
	signal: AbortSignal;
	onChange(): boolean | undefined;
	onError(error: unknown): void;
	debounceMilliseconds?: number;
	watchFactory?: (path: string, options: { recursive: boolean }, listener: WatchListener) => WatchHandle;
	resolveSourceDirectory?: (configPath: string) => string;
	schedule?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
	cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

function projectSourceDirectory(configPath: string, cwd: string): string {
	const configDirectory = dirname(configPath);
	const displayFile = relative(cwd, configPath) || "s11tnext.config.toml";
	const config = parseProjectConfig(loadToml(configPath, displayFile), displayFile);
	return resolve(configDirectory, config.sourceDir);
}

export async function watchProject(options: WatchCommandOptions): Promise<void> {
	if (options.signal.aborted) return;
	const configPath = resolve(options.cwd, options.config ?? "s11tnext.config.toml");
	const configDirectory = dirname(configPath);
	const watchFactory = options.watchFactory ?? watch;
	const resolveSourceDirectory =
		options.resolveSourceDirectory ?? ((path: string) => projectSourceDirectory(path, options.cwd));
	const schedule = options.schedule ?? setTimeout;
	const cancel = options.cancel ?? clearTimeout;
	const registrations = new Set<WatchRegistration>();
	let sourceRegistration: WatchRegistration | undefined;
	let sourceDirectory: string | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let refreshSourceAfterBuild = false;
	let rejectWatch: ((error: Error) => void) | undefined;

	function register(path: string, recursive: boolean, listener: WatchListener): WatchRegistration {
		const handle = watchFactory(path, { recursive }, listener);
		const registration: WatchRegistration = {
			handle,
			onError: (error) => rejectWatch?.(error),
		};
		handle.on?.("error", registration.onError);
		registrations.add(registration);
		return registration;
	}

	function unregister(registration: WatchRegistration): void {
		registration.handle.removeListener?.("error", registration.onError);
		registration.handle.close();
		registrations.delete(registration);
	}

	function refreshSourceWatcher(): void {
		const nextDirectory = resolveSourceDirectory(configPath);
		if (nextDirectory === sourceDirectory) return;
		const nextRegistration = register(nextDirectory, true, sourceListener);
		const previousRegistration = sourceRegistration;
		sourceDirectory = nextDirectory;
		sourceRegistration = nextRegistration;
		if (previousRegistration !== undefined) unregister(previousRegistration);
	}

	function scheduleBuild(refreshSource: boolean): void {
		if (options.signal.aborted) return;
		refreshSourceAfterBuild ||= refreshSource;
		if (timer !== undefined) cancel(timer);
		timer = schedule(() => {
			timer = undefined;
			const shouldRefreshSource = refreshSourceAfterBuild;
			refreshSourceAfterBuild = false;
			try {
				const succeeded = options.onChange() !== false;
				if (succeeded && shouldRefreshSource) refreshSourceWatcher();
			} catch (error) {
				options.onError(error);
			}
		}, options.debounceMilliseconds ?? 75);
	}

	const configListener: WatchListener = (_eventType, filename) => {
		const candidate = filename === null ? null : resolve(configDirectory, String(filename));
		if (candidate !== null && candidate !== configPath) return;
		scheduleBuild(true);
	};
	const sourceListener: WatchListener = (eventType, filename) => {
		if (filename !== null && eventType === "change" && !String(filename).endsWith(".context.toml")) {
			return;
		}
		scheduleBuild(false);
	};

	let abortListener: (() => void) | undefined;
	const completion = new Promise<void>((resolvePromise, rejectPromise) => {
		abortListener = resolvePromise;
		rejectWatch = rejectPromise;
		options.signal.addEventListener("abort", abortListener, { once: true });
	});
	try {
		register(configDirectory, false, configListener);
		refreshSourceWatcher();
		if (options.signal.aborted) return;
		await completion;
	} finally {
		if (abortListener !== undefined) {
			options.signal.removeEventListener("abort", abortListener);
		}
		if (timer !== undefined) cancel(timer);
		for (const registration of [...registrations]) unregister(registration);
	}
}
