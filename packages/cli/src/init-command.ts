import {
	closeSync,
	mkdirSync,
	openSync,
	rmdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import { S11tnextDiagnosticError, type S11tnextDiagnostic } from "./diagnostics.js";
import { pathEntryExists, resolvesWithin } from "./path-safety.js";

export type InitTemplate = "minimal" | "production";

export type InitOptions = {
	cwd?: string;
	dryRun?: boolean;
	editor?: boolean;
	keyspace?: string;
	locale?: string;
	owner?: string;
	releaseProfile?: string;
	template?: InitTemplate;
};

export type InitResult = {
	created: boolean;
	files: string[];
	template: InitTemplate;
	locale: string;
	releaseProfile: string;
};

const LOCALE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const KEYSPACE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const PROFILE_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;

function fail(code: string, message: string, file: string): never {
	const diagnostic: S11tnextDiagnostic = {
		code,
		severity: "error",
		message,
		file,
		path: [],
	};
	throw new S11tnextDiagnosticError([diagnostic]);
}

function displayPath(cwd: string, path: string): string {
	return relative(cwd, path).split(sep).join("/");
}

function tomlString(value: string): string {
	return JSON.stringify(value);
}

function configBytes(options: {
	keyspace: string;
	locale: string;
	owner: string;
	releaseProfile: string;
	template: InitTemplate;
}): string {
	const governance = options.template === "production";
	return `source_dir = "contexts"
out_dir = ".s11tnext"

[authoring]
source_locale = ${tomlString(options.locale)}

[governance]
require_owner = ${governance ? "true" : "false"}

[keyspaces.${tomlString(options.keyspace)}]
owner = ${tomlString(options.owner)}

[release_profiles.${tomlString(options.releaseProfile)}]
required_locales = ["$source"]
${
		options.template === "production"
			? `
[variable_profiles."untrusted.text"]
type = "string"
trust = "untrusted"
placement = "delimited-context"
encoding = "delimited-text"
`
			: ""
}`;
}

function contextBytes(template: InitTemplate): string {
	if (template === "production") {
		return `message_role = "user"

text = '''Handle the following request.
[[request]]'''

[variables.request]
profile = "untrusted.text"
`;
	}
	return `text = "You are a concise and helpful assistant."
`;
}

function taploBytes(): string {
	return `[[rule]]
include = ["s11tnext.config.toml"]

[rule.schema]
path = "./node_modules/s11tnext-cli/dist/schemas/s11tnext-config.schema.json"

[[rule]]
include = ["contexts/**/*.context.toml"]

[rule.schema]
path = "./node_modules/s11tnext-cli/dist/schemas/s11tnext-authoring.schema.json"
`;
}

function hasErrorCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

function hasDirectoryAncestor(path: string): boolean {
	let cursor = dirname(path);
	while (!pathEntryExists(cursor)) cursor = dirname(cursor);
	return statSync(cursor).isDirectory();
}

export function initProject(options: InitOptions = {}): InitResult {
	const cwd = resolve(options.cwd ?? process.cwd());
	const template = options.template ?? "minimal";
	const locale = options.locale ?? "en-US";
	const keyspace = options.keyspace ?? "app";
	const owner = options.owner ?? "app-team";
	const releaseProfile = options.releaseProfile ?? "development";
	if (template !== "minimal" && template !== "production") {
		fail("S11TNEXT_INIT_INVALID", "template must be minimal or production", "s11tnext.config.toml");
	}
	if (!LOCALE_PATTERN.test(locale)) {
		fail("S11TNEXT_INIT_INVALID", "locale must be a supported locale identifier", "s11tnext.config.toml");
	}
	if (!KEYSPACE_PATTERN.test(keyspace)) {
		fail("S11TNEXT_INIT_INVALID", "keyspace must be a valid dotted keyspace", "s11tnext.config.toml");
	}
	if (owner.length === 0 || /[\u0000-\u001f\u007f]/.test(owner)) {
		fail("S11TNEXT_INIT_INVALID", "owner must be a non-empty printable string", "s11tnext.config.toml");
	}
	if (!PROFILE_PATTERN.test(releaseProfile)) {
		fail("S11TNEXT_INIT_INVALID", "release profile name is invalid", "s11tnext.config.toml");
	}

	const contextPath = resolve(
		cwd,
		"contexts",
		...keyspace.split("."),
		"greeting.context.toml",
	);
	const outputs = [
		{
			path: resolve(cwd, "s11tnext.config.toml"),
			content: configBytes({ keyspace, locale, owner, releaseProfile, template }),
		},
		{ path: contextPath, content: contextBytes(template) },
		...(options.editor === false
			? []
			: [{ path: resolve(cwd, ".taplo.toml"), content: taploBytes() }]),
	];
	for (const output of outputs) {
		const display = displayPath(cwd, output.path);
		if (!resolvesWithin(cwd, output.path)) {
			fail("S11TNEXT_INIT_UNSAFE_PATH", "Initialization target resolves outside the project", display);
		}
		if (pathEntryExists(output.path)) {
			fail("S11TNEXT_INIT_CONFLICT", "Refusing to overwrite an existing file", display);
		}
		if (!hasDirectoryAncestor(output.path)) {
			fail("S11TNEXT_INIT_CONFLICT", "A parent path prevents creating this file", display);
		}
	}
	const files = outputs.map(({ path }) => displayPath(cwd, path));
	if (options.dryRun === true) {
		return { created: false, files, template, locale, releaseProfile };
	}

	const createdFiles: string[] = [];
	const createdDirectories: string[] = [];
	try {
		for (const output of outputs) {
			const directory = dirname(output.path);
			let firstCreated: string | undefined;
			try {
				firstCreated = mkdirSync(directory, { recursive: true });
			} catch (error) {
				if (hasErrorCode(error, "EEXIST") || hasErrorCode(error, "ENOTDIR")) {
					fail(
						"S11TNEXT_INIT_CONFLICT",
						"A parent path prevents creating this file",
						displayPath(cwd, output.path),
					);
				}
				throw error;
			}
			if (firstCreated !== undefined) {
				let created = directory;
				for (;;) {
					createdDirectories.push(created);
					if (created === firstCreated) break;
					created = dirname(created);
				}
			}
			let descriptor: number;
			try {
				descriptor = openSync(output.path, "wx", 0o644);
			} catch (error) {
				if (hasErrorCode(error, "EEXIST")) {
					fail(
						"S11TNEXT_INIT_CONFLICT",
						"Refusing to overwrite an existing file",
						displayPath(cwd, output.path),
					);
				}
				throw error;
			}
			createdFiles.push(output.path);
			try {
				writeFileSync(descriptor, output.content, "utf8");
			} finally {
				closeSync(descriptor);
			}
		}
	} catch (error) {
		for (const path of createdFiles.reverse()) rmSync(path, { force: true });
		for (const path of new Set(createdDirectories)) {
			try {
				rmdirSync(path);
			} catch {
				// Preserve directories that are no longer empty or were concurrently created.
			}
		}
		throw error;
	}
	return { created: true, files, template, locale, releaseProfile };
}
