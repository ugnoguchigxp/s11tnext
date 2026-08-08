import type { PromptInvocation } from "s11tnext";

import { RAG_CORPUS, type RagDocument, retrieveDocuments } from "./corpus.js";
import { renderRagPrompt } from "./prompt-catalog.js";

export type LlmRequest = Readonly<{
	message: Readonly<{
		role: PromptInvocation["role"];
		content: string;
	}>;
	manifest: PromptInvocation["manifest"];
}>;

export interface LlmProvider {
	generate(request: LlmRequest): Promise<string>;
}

export type RagAnswer = Readonly<{
	answer: string;
	citations: readonly string[];
	retrievedDocumentIds: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRagAnswer(value: string): {
	answer: string;
	citations: string[];
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error("The LLM response is not valid JSON.");
	}
	if (
		!isRecord(parsed) ||
		typeof parsed.answer !== "string" ||
		parsed.answer.trim().length === 0 ||
		!Array.isArray(parsed.citations) ||
		parsed.citations.length === 0 ||
		!parsed.citations.every((citation) => typeof citation === "string" && citation.trim().length > 0)
	) {
		throw new Error("The LLM response does not match the RAG answer contract.");
	}
	return {
		answer: parsed.answer,
		citations: [...parsed.citations],
	};
}

export async function answerQuestion(
	question: string,
	provider: LlmProvider,
	corpus: readonly RagDocument[] = RAG_CORPUS,
): Promise<RagAnswer> {
	const retrievedDocuments = retrieveDocuments(question, corpus);
	if (retrievedDocuments.length === 0) {
		throw new Error("No documents matched the question.");
	}

	const invocation = renderRagPrompt(question, retrievedDocuments);
	const response = await provider.generate(
		Object.freeze({
			message: Object.freeze({
				role: invocation.role,
				content: invocation.content.text,
			}),
			manifest: invocation.manifest,
		}),
	);
	const answer = parseRagAnswer(response);
	const retrievedDocumentIds = retrievedDocuments.map(({ id }) => id);
	const allowedCitations = new Set(retrievedDocumentIds);
	for (const citation of answer.citations) {
		if (!allowedCitations.has(citation)) {
			throw new Error(`The LLM response cited an unretrieved document: ${citation}`);
		}
	}

	return Object.freeze({
		answer: answer.answer,
		citations: Object.freeze(answer.citations),
		retrievedDocumentIds: Object.freeze(retrievedDocumentIds),
	});
}
