import { type S11tnextDiagnostic, S11tnextDiagnosticError } from "./diagnostics.js";

type FileSystemTarget = "file" | "sourceDirectory" | "outputDirectory";

type FileSystemDiagnosticOptions = {
	file: string;
	path: Array<string | number>;
	target: FileSystemTarget;
};

export function fileSystemErrorCode(error: unknown): string | undefined {
	if (!(error instanceof Error) || !("code" in error)) return undefined;
	return typeof error.code === "string" ? error.code : undefined;
}

export function createFileSystemDiagnostic(
	error: unknown,
	options: FileSystemDiagnosticOptions,
): S11tnextDiagnostic {
	const systemCode = fileSystemErrorCode(error);
	if (options.target === "sourceDirectory") {
		return {
			code: systemCode === "ENOENT" ? "S11TNEXT_SOURCE_DIR_NOT_FOUND" : "S11TNEXT_SOURCE_DIR_UNREADABLE",
			severity: "error",
			message:
				systemCode === "ENOENT"
					? "Configured source_dir does not exist"
					: "Configured source_dir could not be read",
			file: options.file,
			path: [...options.path],
		};
	}
	if (options.target === "outputDirectory") {
		return {
			code: "S11TNEXT_OUTPUT_DIR_UNWRITABLE",
			severity: "error",
			message: "Configured out_dir could not be written",
			file: options.file,
			path: [...options.path],
		};
	}
	return {
		code: systemCode === "ENOENT" ? "S11TNEXT_FILE_NOT_FOUND" : "S11TNEXT_FILE_UNREADABLE",
		severity: "error",
		message:
			systemCode === "ENOENT"
				? "File was not found"
				: systemCode === "EISDIR"
					? "Expected a file but found a directory"
					: "File could not be read",
		file: options.file,
		path: [...options.path],
	};
}

export function fileSystemFailure(error: unknown, options: FileSystemDiagnosticOptions): never {
	throw new S11tnextDiagnosticError([createFileSystemDiagnostic(error, options)]);
}
