import { readFileSync } from "node:fs";

import { createAppCatalog } from "../.s11tnext/catalog.generated.js";

const artifact: unknown = JSON.parse(
	readFileSync(new URL("../../.s11tnext/catalog.json", import.meta.url), "utf8"),
);
const catalog = createAppCatalog(artifact);
const invocation = catalog.bind({ instructionLocale: "en-US" })("greeting", {});

process.stdout.write(`${invocation.role}: ${invocation.content.text}`);
