import { readFileSync } from "node:fs";

import { parse } from "smol-toml";

import { type S11tnextDiagnostic, S11tnextDiagnosticError } from "./diagnostics.js";
import { fileSystemFailure } from "./filesystem-diagnostics.js";

type TomlError = Error & { line?: number; column?: number };

export function loadToml(filePath: string, displayFile: string): unknown {
	let source: string;
	try {
		source = readFileSync(filePath, "utf8");
	} catch (error) {
		fileSystemFailure(error, { file: displayFile, path: [], target: "file" });
	}
	try {
		return parse(source);
	} catch (error) {
		const tomlError = error as TomlError;
		const diagnostic: S11tnextDiagnostic = {
			code: "S11TNEXT_TOML_SYNTAX",
			severity: "error",
			message: tomlError.message,
			file: displayFile,
			path: [],
		};
		if (tomlError.line !== undefined) diagnostic.line = tomlError.line;
		if (tomlError.column !== undefined) diagnostic.column = tomlError.column;
		throw new S11tnextDiagnosticError([diagnostic]);
	}
}
