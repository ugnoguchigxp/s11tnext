import { describe, expect, it } from "vitest";

import type { S11tnextDiagnosticError } from "../src/diagnostics.js";
import {
	createFileSystemDiagnostic,
	fileSystemErrorCode,
	fileSystemFailure,
} from "../src/filesystem-diagnostics.js";

function systemError(code: string): Error & { code: string } {
	return Object.assign(new Error(code), { code });
}

describe("filesystem diagnostics", () => {
	it("distinguishes missing, unreadable, and directory file targets", () => {
		expect(
			createFileSystemDiagnostic(systemError("ENOENT"), {
				file: "input.toml",
				path: [],
				target: "file",
			}),
		).toMatchObject({ code: "S11TNEXT_FILE_NOT_FOUND", message: "File was not found" });
		expect(
			createFileSystemDiagnostic(systemError("EACCES"), {
				file: "input.toml",
				path: [],
				target: "file",
			}),
		).toMatchObject({ code: "S11TNEXT_FILE_UNREADABLE", message: "File could not be read" });
		expect(
			createFileSystemDiagnostic(systemError("EISDIR"), {
				file: "input.toml",
				path: [],
				target: "file",
			}),
		).toMatchObject({
			code: "S11TNEXT_FILE_UNREADABLE",
			message: "Expected a file but found a directory",
		});
	});

	it("distinguishes missing and unreadable source directories", () => {
		expect(
			createFileSystemDiagnostic(systemError("ENOENT"), {
				file: "s11tnext.config.toml",
				path: ["source_dir"],
				target: "sourceDirectory",
			}),
		).toMatchObject({ code: "S11TNEXT_SOURCE_DIR_NOT_FOUND" });
		expect(
			createFileSystemDiagnostic(systemError("EPERM"), {
				file: "s11tnext.config.toml",
				path: ["source_dir"],
				target: "sourceDirectory",
			}),
		).toMatchObject({ code: "S11TNEXT_SOURCE_DIR_UNREADABLE" });
	});

	it("normalizes unknown errors and throws diagnostic errors", () => {
		expect(fileSystemErrorCode("failure")).toBeUndefined();
		expect(fileSystemErrorCode(Object.assign(new Error("failure"), { code: 7 }))).toBeUndefined();
		expect(() =>
			fileSystemFailure("failure", {
				file: "output",
				path: ["out_dir"],
				target: "outputDirectory",
			}),
		).toThrowError(
			expect.objectContaining<S11tnextDiagnosticError>({
				diagnostics: [
					expect.objectContaining({
						code: "S11TNEXT_OUTPUT_DIR_UNWRITABLE",
						message: "Configured out_dir could not be written",
					}),
				],
			}),
		);
	});
});
