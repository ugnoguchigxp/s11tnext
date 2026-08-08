export class CliUsageError extends Error {}

export function takeCliOption(arguments_: string[], name: string): string | undefined {
	const index = arguments_.indexOf(name);
	if (index === -1) return undefined;
	const value = arguments_[index + 1];
	if (value === undefined || value.startsWith("--")) {
		throw new CliUsageError(`${name} requires a value`);
	}
	arguments_.splice(index, 2);
	return value;
}
