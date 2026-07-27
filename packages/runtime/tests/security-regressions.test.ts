import { describe, expect, it } from "vitest";

import { encodeValue } from "../src/encoding.js";
import type { S11tnextCompiledVariable } from "../src/types.js";

const delimitedText: S11tnextCompiledVariable = {
	required: true,
	type: "string",
	trust: "untrusted",
	placement: "delimited-context",
	encoding: "delimited-text",
};

const jsonValue: S11tnextCompiledVariable = {
	required: true,
	type: "json",
	trust: "untrusted",
	placement: "delimited-context",
	encoding: "json-value",
};

describe("security regression corpus", () => {
	it("escapes invisible controls and bidi overrides while preserving text newlines", () => {
		const value = "left\u0000\u0085\u202eright\u2066\nnext\r\nlast";

		expect(encodeValue(value, delimitedText, ["value"])).toBe(
			"left\\u0000\\u0085\\u202eright\\u2066\nnext\r\nlast",
		);
	});

	it("serializes prototype-shaped keys as inert JSON data", () => {
		const value = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(value, "__proto__", {
			enumerable: true,
			value: { polluted: true },
		});
		value.constructor = "data";

		const encoded = encodeValue(value, jsonValue, ["value"]);
		const decoded = JSON.parse(encoded) as Record<string, unknown>;

		expect(encoded).toBe('{"__proto__":{"polluted":true},"constructor":"data"}');
		expect(Object.hasOwn(decoded, "__proto__")).toBe(true);
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	});

	it("handles deliberately deep and large plain JSON inputs deterministically", () => {
		let deep: Record<string, unknown> = { value: "leaf" };
		for (let depth = 0; depth < 128; depth += 1) deep = { child: deep };
		const large = { deep, text: "x".repeat(256 * 1024) };

		const first = encodeValue(large, jsonValue, ["value"]);
		const second = encodeValue(large, jsonValue, ["value"]);

		expect(second).toBe(first);
		expect(first.length).toBeGreaterThan(256 * 1024);
	});

	it("rejects excessive JSON nesting with a stable runtime diagnostic", () => {
		let value: unknown = "leaf";
		for (let depth = 0; depth < 256; depth += 1) value = { child: value };

		expect(() => encodeValue(value, jsonValue, ["value"])).not.toThrow();
		const excessive = { child: value };

		expect(() => encodeValue(excessive, jsonValue, ["value"])).toThrowError(
			expect.objectContaining({
				code: "S11TNEXT_VALUE_INVALID",
				message: expect.stringContaining("256 nested containers"),
			}),
		);
	});
});
