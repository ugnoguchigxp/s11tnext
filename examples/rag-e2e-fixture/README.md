# RAG E2E fixture example

[日本語](#日本語) | [English](#english)

## 日本語

このexampleは、S11tnextを通常のRAGプロンプト管理と、E2E用の固定LLM応答fixtureの両方に使用します。実LLM、API key、外部HTTP、embedding、vector databaseは必要ありません。

```text
質問
  -> 決定的なkeyword検索
  -> prompts/ のS11tnext catalogでprovider messageを生成
  -> LlmProvider port
  -> test-fixtures/ のS11tnext catalogを読むfixture provider
  -> JSON shapeと引用文書IDを検証
  -> 回答
```

通常のプロンプトとtest fixtureは別々のS11tnext projectです。

- `prompts/`: providerへ送る`rag.answer`を管理します。質問と検索文書はuntrusted runtime valueとして構造的な境界内へ配置され、messageとmanifestを一緒にprovider portへ渡します。
- `test-fixtures/`: providerが返す固定JSON本文を管理します。`bindText()`で本文だけを取得し、catalogのmessage roleをassistant roleの代用にはしません。fixture keyはtestが明示的に選び、質問文から推測しません。
- `test-fixtures/fixture-llm-provider.ts`: applicationの`LlmProvider` portをtest側から実装し、外部通信なしでfixture本文を返します。通常application moduleはtest fixture artifactへ依存しません。
- `test-fixtures/demo.ts`: applicationとfixture providerを組み合わせるexample専用composition rootです。
- `tests/rag.e2e.test.ts`: 検索から回答検証までを通し、引用のない回答と検索されていない文書の引用を拒否することも確認します。
- `promptfoo/`: Promptfooのcustom TypeScript providerから同じapplication portを呼び出し、実際にレンダリングされたpromptとS11tnext manifestを評価結果へ返します。

実行方法:

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture build
pnpm --filter s11tnext-example-rag-e2e-fixture test
pnpm --filter s11tnext-example-rag-e2e-fixture start
```

生成物を変更せずに最新性を確認するには、次を実行します。

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture catalogs:check
```

Promptfooの評価例を実行するにはNode.js 22.22以降を使用します。最初の実行では固定した
`promptfoo@0.122.0`を`pnpm dlx`が取得しますが、評価自体はfixture providerを使うためLLM APIや
API keyは不要です。

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture eval:promptfoo
```

custom providerはPromptfooの`prompt`フィールドへS11tnextが生成した正確なprovider messageを、
`metadata.s11tnextManifest`へ値本文を含まない監査manifestを設定します。これにより評価画面の
入力とアプリケーション監査IDを対応付けられます。

このexampleのkeyword検索はRAGのデータフローを決定的に示すための最小実装です。S11tnextは検索エンジン、LLM provider、scenario engineを提供しません。検索、provider差し替え、JSON validation、引用検証はホストアプリケーションの責務です。

## English

This example uses S11tnext both for a normal RAG prompt and for fixed LLM response fixtures in an end-to-end test. It needs no real LLM, API key, external HTTP request, embedding service, or vector database.

```text
question
  -> deterministic keyword retrieval
  -> provider message rendered from the prompts/ S11tnext catalog
  -> LlmProvider port
  -> fixture provider backed by the test-fixtures/ S11tnext catalog
  -> JSON shape and citation validation
  -> answer
```

The normal prompt and test fixtures are separate S11tnext projects.

- `prompts/` owns the `rag.answer` message sent to a provider. The question and retrieved documents are rendered as untrusted runtime values inside structural boundaries, and the message travels through the provider port with its manifest.
- `test-fixtures/` owns fixed JSON response bodies. It uses `bindText()` to read only the body and never treats the catalog message role as an assistant role. Tests select a typed fixture key explicitly instead of inferring a scenario from the question.
- `test-fixtures/fixture-llm-provider.ts` implements the application's `LlmProvider` port from the test side and returns fixture text without network access. Normal application modules do not depend on the test fixture artifact.
- `test-fixtures/demo.ts` is the example-only composition root that combines the application with the fixture provider.
- `tests/rag.e2e.test.ts` covers the complete flow and verifies that an answer without citations or with a citation to an unretrieved document fails closed.
- `promptfoo/` calls the same application port from a Promptfoo custom TypeScript provider and reports the actual rendered prompt plus the S11tnext manifest with each evaluation result.

Run the example:

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture build
pnpm --filter s11tnext-example-rag-e2e-fixture test
pnpm --filter s11tnext-example-rag-e2e-fixture start
```

Check generated outputs without updating them:

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture catalogs:check
```

Run the Promptfoo evaluation on Node.js 22.22 or newer. On first use, `pnpm dlx` downloads the pinned
`promptfoo@0.122.0`; the evaluation itself still uses the fixture provider and needs no LLM API or key.

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture eval:promptfoo
```

The custom provider reports the exact S11tnext-rendered provider message through Promptfoo's `prompt`
field and the value-free audit manifest through `metadata.s11tnextManifest`, linking evaluation input to
the application audit identity.

The keyword retriever is intentionally small and deterministic; it demonstrates RAG data flow, not retrieval quality. S11tnext is not a retriever, LLM provider, or scenario engine. The host application owns retrieval, provider substitution, JSON validation, and citation validation.
