import type { LlmProvider, LlmRequest } from "../src/rag.js";
import {
	renderLlmFixture,
	type LlmFixtureKey,
} from "./catalog.js";

export class FixtureLlmProvider implements LlmProvider {
	readonly #requests: LlmRequest[] = [];
	readonly #responses: string[] = [];

	constructor(private readonly fixtureKey: LlmFixtureKey) {}

	get requests(): readonly LlmRequest[] {
		return Object.freeze([...this.#requests]);
	}

	get responses(): readonly string[] {
		return Object.freeze([...this.#responses]);
	}

	generate(request: LlmRequest): Promise<string> {
		const response = renderLlmFixture(this.fixtureKey);
		this.#requests.push(
			Object.freeze({
				message: Object.freeze({ ...request.message }),
				manifest: request.manifest,
			}),
		);
		this.#responses.push(response);
		return Promise.resolve(response);
	}
}
