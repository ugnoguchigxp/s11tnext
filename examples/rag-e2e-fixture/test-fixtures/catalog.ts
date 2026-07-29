import {
	createAppCatalog as createFixtureCatalog,
	type PromptKey as FixturePromptKey,
} from "./generated/catalog.generated.js";
import fixtureArtifact from "./generated/catalog.json" with { type: "json" };

export type LlmFixtureKey = FixturePromptKey;

const fixtureCatalog = createFixtureCatalog(fixtureArtifact as unknown);
const renderFixtureText = fixtureCatalog.bindText({
	instructionLocale: "ja-JP",
	fallbackLocales: [],
	trailingNewline: false,
});

export function renderLlmFixture(key: LlmFixtureKey): string {
	return renderFixtureText.p(key, {});
}
