import { answerQuestion } from "../src/rag.js";
import {
	FixtureLlmProvider,
} from "../test-fixtures/fixture-llm-provider.js";
import type { LlmFixtureKey } from "../test-fixtures/catalog.js";

type PromptfooProviderOptions = {
	id?: string;
	config?: {
		fixtureKey?: LlmFixtureKey;
	};
};

export type PromptfooProviderResponse = {
	output?: string;
	error?: string;
	prompt?: string;
	metadata?: Record<string, unknown>;
};

export default class S11tnextRagProvider {
	readonly #id: string;
	readonly #fixtureKey: LlmFixtureKey;

	constructor(options: PromptfooProviderOptions = {}) {
		this.#id = options.id ?? "s11tnext-rag-fixture";
		this.#fixtureKey =
			options.config?.fixtureKey ?? "llmFixture.grounded-answer";
	}

	id(): string {
		return this.#id;
	}

	async callApi(prompt: string): Promise<PromptfooProviderResponse> {
		const fixture = new FixtureLlmProvider(this.#fixtureKey);
		try {
			const result = await answerQuestion(prompt, fixture);
			const request = fixture.requests[0];
			if (request === undefined) {
				return { error: "S11tnext RAG provider produced no audited request." };
			}
			return {
				output: JSON.stringify(result),
				prompt: request.message.content,
				metadata: {
					providerMessageRole: request.message.role,
					s11tnextManifest: request.manifest,
				},
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
