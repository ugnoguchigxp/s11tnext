import { describe, expect, it } from "vitest";

import { EXAMPLE_QUESTION } from "../src/corpus.js";
import S11tnextRagProvider from "./provider.js";

describe("Promptfoo S11tnext provider", () => {
	it("reports the actual rendered prompt and audit manifest", async () => {
		const provider = new S11tnextRagProvider({ id: "promptfoo:s11tnext" });
		const response = await provider.callApi(EXAMPLE_QUESTION);
		expect(provider.id()).toBe("promptfoo:s11tnext");
		expect(response.error).toBeUndefined();
		expect(JSON.parse(response.output ?? "null")).toEqual({
			answer:
				"S11tnextは、LLMプロンプトをアプリケーションコードから分離してTOMLで管理し、決定的なJSONと型付きTypeScriptへコンパイルします。",
			citations: ["s11tnext-overview"],
			retrievedDocumentIds: ["s11tnext-overview"],
		});
		expect(response.prompt).toContain(EXAMPLE_QUESTION);
		expect(response.prompt).toContain("s11tnext-overview");
		expect(response.metadata).toEqual(
			expect.objectContaining({
				providerMessageRole: "user",
				s11tnextManifest: expect.objectContaining({
					key: "rag.answer",
					messageRole: "user",
				}),
			}),
		);
	});

	it("returns application validation failures as provider errors", async () => {
		const provider = new S11tnextRagProvider({
			config: { fixtureKey: "llmFixture.unsupported-citation" },
		});
		const response = await provider.callApi(EXAMPLE_QUESTION);
		expect(response.output).toBeUndefined();
		expect(response.error).toContain("unretrieved-document");
	});
});
