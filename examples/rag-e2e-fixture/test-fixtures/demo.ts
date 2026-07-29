import { EXAMPLE_QUESTION } from "../src/corpus.js";
import { answerQuestion } from "../src/rag.js";
import { FixtureLlmProvider } from "./fixture-llm-provider.js";

const provider = new FixtureLlmProvider("llmFixture.grounded-answer");
const result = await answerQuestion(EXAMPLE_QUESTION, provider);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
