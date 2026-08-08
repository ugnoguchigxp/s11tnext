import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildProject } from "../src/build-command.js";
import { S11tnextDiagnosticError } from "../src/diagnostics.js";
import { initProject } from "../src/init-command.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "s11tnext-init-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("init command", () => {
	it("creates a minimal buildable project with Taplo schema associations", () => {
		const directory = temporaryDirectory();
		const result = initProject({ cwd: directory });
		expect(result).toEqual({
			created: true,
			files: ["s11tnext.config.toml", "contexts/app/greeting.context.toml", ".taplo.toml"],
			template: "minimal",
			locale: "en-US",
			releaseProfile: "development",
		});
		expect(readFileSync(join(directory, ".taplo.toml"), "utf8")).toContain("s11tnext-authoring.schema.json");
		expect(buildProject({ cwd: directory, releaseProfile: "development" }).catalogDigest).toMatch(
			/^sha256:[0-9a-f]{64}$/,
		);
	});

	it("creates a governed production starter with custom identifiers", () => {
		const directory = temporaryDirectory();
		const result = initProject({
			cwd: directory,
			template: "production",
			locale: "ja-JP",
			keyspace: "coding.agent",
			owner: "agent-platform",
			releaseProfile: "production",
			editor: false,
		});
		expect(result.files).toEqual(["s11tnext.config.toml", "contexts/coding/agent/greeting.context.toml"]);
		expect(readFileSync(join(directory, "s11tnext.config.toml"), "utf8")).toContain("require_owner = true");
		expect(buildProject({ cwd: directory, releaseProfile: "production" }).checked).toBe(false);
	});

	it("previews without writing and refuses to overwrite existing files", () => {
		const directory = temporaryDirectory();
		const preview = initProject({ cwd: directory, dryRun: true });
		expect(preview.created).toBe(false);
		expect(existsSync(join(directory, "s11tnext.config.toml"))).toBe(false);
		writeFileSync(join(directory, "s11tnext.config.toml"), "preserve = true\n");
		expect(() => initProject({ cwd: directory })).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [expect.objectContaining({ code: "S11TNEXT_INIT_CONFLICT" })],
			}),
		);
		expect(readFileSync(join(directory, "s11tnext.config.toml"), "utf8")).toBe("preserve = true\n");
	});

	it("reports a parent-file conflict before writing", () => {
		const directory = temporaryDirectory();
		writeFileSync(join(directory, "contexts"), "preserve\n");
		expect(() => initProject({ cwd: directory, dryRun: true })).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [expect.objectContaining({ code: "S11TNEXT_INIT_CONFLICT" })],
			}),
		);
		expect(() => initProject({ cwd: directory })).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [expect.objectContaining({ code: "S11TNEXT_INIT_CONFLICT" })],
			}),
		);
		expect(readFileSync(join(directory, "contexts"), "utf8")).toBe("preserve\n");
		expect(existsSync(join(directory, "s11tnext.config.toml"))).toBe(false);
	});

	it("rejects invalid starter identifiers", () => {
		const directory = temporaryDirectory();
		expect(() => initProject({ cwd: directory, locale: "invalid locale" })).toThrow(S11tnextDiagnosticError);
		expect(() => initProject({ cwd: directory, keyspace: "../escape" })).toThrow(S11tnextDiagnosticError);
		expect(() => initProject({ cwd: directory, releaseProfile: "bad profile" })).toThrow(
			S11tnextDiagnosticError,
		);
	});

	it.skipIf(process.platform === "win32")("rejects a source path symlinked outside the project", () => {
		const directory = temporaryDirectory();
		const outside = temporaryDirectory();
		symlinkSync(outside, join(directory, "contexts"), "dir");
		expect(() => initProject({ cwd: directory })).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [expect.objectContaining({ code: "S11TNEXT_INIT_UNSAFE_PATH" })],
			}),
		);
	});

	it.skipIf(process.platform === "win32")("rejects a dangling source-directory symlink", () => {
		const directory = temporaryDirectory();
		const outside = temporaryDirectory();
		symlinkSync(join(outside, "missing"), join(directory, "contexts"), "dir");
		expect(() => initProject({ cwd: directory })).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [expect.objectContaining({ code: "S11TNEXT_INIT_UNSAFE_PATH" })],
			}),
		);
	});

	it.skipIf(process.platform === "win32")("reports initialization write failures", () => {
		const directory = temporaryDirectory();
		chmodSync(directory, 0o500);
		try {
			expect(() => initProject({ cwd: directory })).toThrowError(
				expect.objectContaining<S11tnextDiagnosticError>({
					diagnostics: [
						expect.objectContaining({
							code: "S11TNEXT_INIT_IO",
							file: "s11tnext.config.toml",
						}),
					],
				}),
			);
		} finally {
			chmodSync(directory, 0o700);
		}
	});
});
