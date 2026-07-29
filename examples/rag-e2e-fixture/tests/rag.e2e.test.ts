import { verifyPromptMessageHash } from "s11tnext";
import { describe, expect, it } from "vitest";

import {
	EXAMPLE_QUESTION,
	RAG_CORPUS,
	retrieveDocuments,
} from "../src/corpus.js";
import { answerQuestion } from "../src/rag.js";
import { FixtureLlmProvider } from "../test-fixtures/fixture-llm-provider.js";

describe("RAG E2E with an S11tnext LLM fixture", () => {
	it("uses document IDs to break equal retrieval scores", () => {
		const documents = [
			{
				id: "document-z",
				title: "Z",
				text: "Z",
				keywords: ["shared"],
			},
			{
				id: "document-a",
				title: "A",
				text: "A",
				keywords: ["shared"],
			},
		] as const;

		expect(
			retrieveDocuments("shared", documents).map(({ id }) => id),
		).toEqual(["document-a"]);
	});

	it("retrieves context and returns a grounded answer without a real LLM", async () => {
		const firstRetrieval = retrieveDocuments(EXAMPLE_QUESTION);
		const secondRetrieval = retrieveDocuments(EXAMPLE_QUESTION);
		expect(firstRetrieval).toEqual(secondRetrieval);
		expect(firstRetrieval.map(({ id }) => id)).toEqual([
			"s11tnext-overview",
		]);

		const provider = new FixtureLlmProvider(
			"llmFixture.grounded-answer",
		);
		const result = await answerQuestion(EXAMPLE_QUESTION, provider);

		expect(result).toEqual({
			answer:
				"S11tnextは、LLMプロンプトをアプリケーションコードから分離してTOMLで管理し、決定的なJSONと型付きTypeScriptへコンパイルします。",
			citations: ["s11tnext-overview"],
			retrievedDocumentIds: ["s11tnext-overview"],
		});

		expect(provider.requests).toHaveLength(1);
		const request = provider.requests[0];
		if (request === undefined) {
			throw new Error("Expected the fixture provider to receive one request.");
		}
		expect(request.message.role).toBe("user");
		expect(request.message.content).toContain(EXAMPLE_QUESTION);
		expect(request.message.content).toContain("s11tnext-overview");
		expect(request.message.content).toContain(RAG_CORPUS[0]!.text);
		expect(request.message.content).not.toContain("vitest-overview");
		expect(request.message.content).not.toContain(RAG_CORPUS[1]!.text);
		expect(request.manifest.key).toBe("rag.answer");
		expect(request.manifest.messageRole).toBe(request.message.role);
		expect(
			verifyPromptMessageHash(
				{
					role: request.message.role,
					text: request.message.content,
				},
				request.manifest.messageHash,
			),
		).toBe(true);
		expect(provider.responses[0]?.endsWith("\n")).toBe(false);
	});

	it("rejects a citation that was not retrieved", async () => {
		const provider = new FixtureLlmProvider(
			"llmFixture.unsupported-citation",
		);

		await expect(answerQuestion(EXAMPLE_QUESTION, provider)).rejects.toThrow(
			"The LLM response cited an unretrieved document: unretrieved-document",
		);
		expect(provider.requests).toHaveLength(1);
	});

	it("rejects an answer without a citation", async () => {
		const provider = new FixtureLlmProvider(
			"llmFixture.empty-citations",
		);

		await expect(answerQuestion(EXAMPLE_QUESTION, provider)).rejects.toThrow(
			"The LLM response does not match the RAG answer contract.",
		);
		expect(provider.requests).toHaveLength(1);
	});

	it("does not call the provider when retrieval returns no documents", async () => {
		const provider = new FixtureLlmProvider(
			"llmFixture.grounded-answer",
		);

		await expect(
			answerQuestion("一致するkeywordがない質問です。", provider),
		).rejects.toThrow("No documents matched the question.");
		expect(provider.requests).toHaveLength(0);
	});
});
