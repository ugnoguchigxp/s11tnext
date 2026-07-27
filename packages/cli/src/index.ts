export { parseAndResolveAuthoring, validateResolvedDocuments } from "./authoring.js";
export type { ResolutionOrigins, ResolvedAuthoringDocument } from "./authoring.js";
export { parseProjectConfig } from "./config.js";
export type {
	S11tnextProjectConfig,
	S11tnextReleaseProfile,
	S11tnextSectionProfile,
} from "./config.js";
export { buildProject } from "./build-command.js";
export type { BuildResult } from "./build-command.js";
export { compileProject } from "./compile-source.js";
export type { CompiledProject } from "./compile-source.js";
export { loadProject } from "./discover.js";
export type { LoadedProject } from "./discover.js";
export { emitTypes } from "./emit-types.js";
export { inspectContext, inspectCoverage } from "./inspect-command.js";
export type { LocaleCoverageResult } from "./inspect-command.js";
export { lintProject } from "./lint-command.js";
export { runCli } from "./main.js";
export type { CommandIo } from "./main.js";
export { S11tnextDiagnosticError } from "./diagnostics.js";
export type {
	S11tnextDiagnostic,
	S11tnextDiagnosticSeverity,
} from "./diagnostics.js";
