import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

import { parseProjectConfig } from "../src/config.js";

const schema = JSON.parse(
	readFileSync(
		new URL("../../../schemas/s11tnext-config.schema.json", import.meta.url),
		"utf8",
	),
) as object;
const validate = new Ajv2020({ strict: true }).compile(schema);

const validConfigs = [
	"../../../fixtures/valid/content-first/s11tnext.config.toml",
	"../../../fixtures/valid/locale-rollout/s11tnext.config.toml",
	"../../../fixtures/valid/mixed-source/s11tnext.config.toml",
	"../../../examples/minimal/s11tnext.config.toml",
	"../../../examples/node-basic/s11tnext.config.toml",
];

describe("project config JSON Schema", () => {
	it("accepts repository fixtures that the runtime parser accepts", () => {
		for (const path of validConfigs) {
			const input = parse(readFileSync(new URL(path, import.meta.url), "utf8"));
			expect(validate(input), path).toBe(true);
			expect(() => parseProjectConfig(input, path)).not.toThrow();
		}
	});

	it("rejects unsupported fields and unsafe variable profiles", () => {
		const base = parse(
			readFileSync(new URL(validConfigs[0]!, import.meta.url), "utf8"),
		) as Record<string, unknown>;
		expect(validate({ ...base, unsupported: true })).toBe(false);
		expect(() =>
			parseProjectConfig({ ...base, unsupported: true }, "config.toml"),
		).toThrow();

		const unsafe = structuredClone(base) as Record<string, unknown>;
		unsafe.variable_profiles = {
			"unsafe.text": {
				type: "string",
				trust: "untrusted",
				placement: "inline",
				encoding: "raw",
			},
		};
		expect(validate(unsafe)).toBe(false);
		expect(() => parseProjectConfig(unsafe, "config.toml")).toThrow();
	});
});
