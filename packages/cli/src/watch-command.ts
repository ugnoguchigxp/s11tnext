import { watch, type FSWatcher } from "node:fs";
import { dirname, resolve } from "node:path";

type WatchListener = (
	eventType: "rename" | "change",
	filename: string | Buffer | null,
) => void;

type WatchHandle = Pick<FSWatcher, "close"> &
	Partial<Pick<FSWatcher, "on" | "removeListener">>;

export type WatchCommandOptions = {
	config?: string;
	cwd: string;
	signal: AbortSignal;
	onChange(): void;
	onError(error: unknown): void;
	debounceMilliseconds?: number;
	watchFactory?: (
		path: string,
		options: { recursive: true },
		listener: WatchListener,
	) => WatchHandle;
	schedule?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
	cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

export async function watchProject(options: WatchCommandOptions): Promise<void> {
	if (options.signal.aborted) return;
	const configPath = resolve(options.cwd, options.config ?? "s11tnext.config.toml");
	const root = dirname(configPath);
	const watchFactory = options.watchFactory ?? watch;
	const schedule = options.schedule ?? setTimeout;
	const cancel = options.cancel ?? clearTimeout;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const listener: WatchListener = (_eventType, filename) => {
		if (options.signal.aborted) return;
		const candidate = filename === null ? null : resolve(root, String(filename));
		if (
			candidate !== null &&
			candidate !== configPath &&
			!candidate.endsWith(".context.toml")
		) {
			return;
		}
		if (timer !== undefined) cancel(timer);
		timer = schedule(() => {
			timer = undefined;
			try {
				options.onChange();
			} catch (error) {
				options.onError(error);
			}
		}, options.debounceMilliseconds ?? 75);
	};
	const watcher = watchFactory(root, { recursive: true }, listener);
	let abortListener: (() => void) | undefined;
	let watcherErrorListener: ((error: Error) => void) | undefined;
	try {
		await new Promise<void>((resolvePromise, rejectPromise) => {
			if (options.signal.aborted) {
				resolvePromise();
				return;
			}
			abortListener = resolvePromise;
			watcherErrorListener = rejectPromise;
			options.signal.addEventListener("abort", abortListener, { once: true });
			watcher.on?.("error", watcherErrorListener);
		});
	} finally {
		if (abortListener !== undefined) {
			options.signal.removeEventListener("abort", abortListener);
		}
		if (watcherErrorListener !== undefined) {
			watcher.removeListener?.("error", watcherErrorListener);
		}
		if (timer !== undefined) cancel(timer);
		watcher.close();
	}
}
