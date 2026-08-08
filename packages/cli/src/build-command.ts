import { mkdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { assertCatalogArtifact } from "s11tnext";

import { compileProject } from "./compile-source.js";
import { type S11tnextDiagnostic, S11tnextDiagnosticError } from "./diagnostics.js";
import { emitTypes } from "./emit-types.js";
import { fileSystemErrorCode, fileSystemFailure } from "./filesystem-diagnostics.js";
import { replaceGeneratedPair } from "./generated-output.js";

export type BuildResult = {
	catalogPath: string;
	typesPath: string;
	catalogDigest: string;
	checked: boolean;
};

function stale(file: string): never {
	const diagnostic: S11tnextDiagnostic = {
		code: "S11TNEXT_BUILD_STALE",
		severity: "error",
		message: "Generated output is missing or stale",
		file,
		path: [],
	};
	throw new S11tnextDiagnosticError([diagnostic]);
}

function sameBytes(path: string, expected: string): boolean {
	try {
		return readFileSync(path, "utf8") === expected;
	} catch (error) {
		if (fileSystemErrorCode(error) === "ENOENT") return false;
		fileSystemFailure(error, { file: path, path: [], target: "file" });
	}
}

function posix(path: string): string {
	return path.split(sep).join("/");
}

export function buildProject(
	options: { config?: string; check?: boolean; cwd?: string; releaseProfile?: string } = {},
): BuildResult {
	const project = compileProject(options.config, options.cwd, options.releaseProfile);
	const catalogBytes = `${JSON.stringify(project.artifact, null, 2)}\n`;
	const parsedArtifact: unknown = JSON.parse(catalogBytes);
	assertCatalogArtifact(parsedArtifact);
	const typeBytes = emitTypes(project.artifact, {
		indent: project.config.generation.typeScriptIndent,
	});
	const outputDirectory = resolve(project.configDirectory, project.config.outDir);
	const catalogPath = resolve(outputDirectory, "catalog.json");
	const typesPath = resolve(outputDirectory, "catalog.generated.ts");
	if (options.check === true) {
		if (!sameBytes(catalogPath, catalogBytes)) stale(catalogPath);
		if (!sameBytes(typesPath, typeBytes)) stale(typesPath);
		return { catalogPath, typesPath, catalogDigest: project.artifact.catalogDigest, checked: true };
	}
	try {
		mkdirSync(outputDirectory, { recursive: true });
		replaceGeneratedPair([
			{ path: catalogPath, content: catalogBytes },
			{ path: typesPath, content: typeBytes },
		]);
	} catch (error) {
		const cwd = options.cwd ?? process.cwd();
		fileSystemFailure(error, {
			file: posix(relative(cwd, project.configPath)) || "s11tnext.config.toml",
			path: ["out_dir"],
			target: "outputDirectory",
		});
	}
	return { catalogPath, typesPath, catalogDigest: project.artifact.catalogDigest, checked: false };
}
