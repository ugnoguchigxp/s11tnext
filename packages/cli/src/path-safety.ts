import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(root: string, candidate: string): boolean {
	const path = relative(root, candidate);
	return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

export function resolvesWithin(root: string, target: string): boolean {
	const realRoot = realpathSync(root);
	let existingAncestor = target;
	while (!pathEntryExists(existingAncestor)) {
		const parent = dirname(existingAncestor);
		if (parent === existingAncestor) return false;
		existingAncestor = parent;
	}
	let realAncestor: string;
	try {
		realAncestor = realpathSync(existingAncestor);
	} catch (error) {
		if (isMissingPathError(error)) return false;
		throw error;
	}
	const unresolvedSuffix = relative(existingAncestor, target);
	return isWithin(realRoot, resolve(realAncestor, unresolvedSuffix));
}

export function pathEntryExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if (isMissingPathError(error)) return false;
		throw error;
	}
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}
