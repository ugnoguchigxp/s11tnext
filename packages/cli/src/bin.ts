#!/usr/bin/env node

import { runCliAsync } from "./async-main.js";

const controller = new AbortController();
let signalExitCode: number | undefined;
const interrupt = (): void => {
	signalExitCode = 130;
	controller.abort();
};
const terminate = (): void => {
	signalExitCode = 143;
	controller.abort();
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", terminate);
try {
	const commandExitCode = await runCliAsync(process.argv.slice(2), undefined, {
		signal: controller.signal,
	});
	process.exitCode = signalExitCode ?? commandExitCode;
} finally {
	process.removeListener("SIGINT", interrupt);
	process.removeListener("SIGTERM", terminate);
}
