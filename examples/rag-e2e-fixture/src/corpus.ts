export type RagDocument = Readonly<{
	id: string;
	title: string;
	text: string;
	keywords: readonly string[];
}>;

export const EXAMPLE_QUESTION = "S11tnextはLLMプロンプトをどのように管理しますか？";

export const RAG_CORPUS: readonly RagDocument[] = Object.freeze([
	Object.freeze({
		id: "s11tnext-overview",
		title: "S11tnext overview",
		text: "S11tnextは、LLMプロンプトをアプリケーションコードから分離してTOMLで管理し、決定的なJSONと型付きTypeScriptへコンパイルします。",
		keywords: Object.freeze(["s11tnext", "プロンプト"]),
	}),
	Object.freeze({
		id: "vitest-overview",
		title: "Vitest overview",
		text: "Vitestは、Viteを利用するTypeScript向けのテストランナーです。",
		keywords: Object.freeze(["vitest", "テスト"]),
	}),
]);

function compareCodeUnits(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function retrieveDocuments(
	question: string,
	corpus: readonly RagDocument[] = RAG_CORPUS,
): readonly RagDocument[] {
	const normalizedQuestion = question.toLowerCase();
	return corpus
		.map((document) => ({
			document,
			score: document.keywords.filter((keyword) => normalizedQuestion.includes(keyword.toLowerCase())).length,
		}))
		.filter(({ score }) => score > 0)
		.sort((left, right) => right.score - left.score || compareCodeUnits(left.document.id, right.document.id))
		.slice(0, 1)
		.map(({ document }) => document);
}
