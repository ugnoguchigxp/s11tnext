import { createAppCatalog as createPromptCatalog } from "../prompts/generated/catalog.generated.js";
import promptArtifact from "../prompts/generated/catalog.json" with { type: "json" };

import type { RagDocument } from "./corpus.js";

const promptCatalog = createPromptCatalog(promptArtifact as unknown);
const renderPrompt = promptCatalog.bind({
	instructionLocale: "ja-JP",
	fallbackLocales: [],
	trailingNewline: false,
});

export function renderRagPrompt(question: string, retrievedDocuments: readonly RagDocument[]) {
	return renderPrompt("rag.answer", {
		question,
		retrievedDocuments: retrievedDocuments.map(({ id, title, text }) => ({
			id,
			title,
			text,
		})),
	});
}
