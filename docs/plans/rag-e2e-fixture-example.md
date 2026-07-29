# RAG E2E Fixture Example Implementation Plan

## Status

- Plan status: `implemented`
- Document created: 2026-07-29
- Implementation completed: 2026-07-30
- Target repository: `s11tnext`
- Target example: `examples/rag-e2e-fixture`
- Primary scope: 通常のRAGプロンプトcatalogと、テスト専用LLM応答fixture catalogを使う決定的なE2Eシナリオ
- Runtime policy: 実LLM、外部HTTP、vector database、embedding APIを使用しない
- Dependency policy: 既存の`s11tnext`、`s11tnext-cli`、TypeScript、Vitestを使用し、新しいruntime依存を追加しない

## 1. 目的

S11tnextの通常用途であるプロンプト管理に加え、LLM providerの固定応答を別のtest専用catalogで管理し、RAG風アプリケーションのE2E fixtureとして利用できることを示す。

完成状態は次の一文に集約する。

> ローカル文書への決定的な検索、型付きRAGプロンプト生成、fixture providerによるLLM応答、JSON応答と引用元の検証までを、実LLMやネットワークなしで一つのE2Eシナリオとして再現できる。

## 2. E2Eシナリオ

利用者が次の質問を入力する。

```text
S11tnextはLLMプロンプトをどのように管理しますか？
```

アプリケーションは次の処理を行う。

1. 小さなローカルcorpusから、質問に一致する文書をkeywordで検索する。
2. 質問と検索文書を、通常のRAGプロンプトcatalogへruntime valueとして渡す。
3. 生成したprovider messageを`LlmProvider` portへ送る。
4. E2Eでは実providerの代わりに、test専用S11tnext catalogを読むfixture providerを使用する。
5. fixture providerは、回答本文と引用文書IDを持つJSON文字列を返す。
6. アプリケーションはJSON shapeを検証し、すべての引用IDが今回検索した文書に含まれることを確認する。
7. E2E testは、最終回答、引用、providerへ渡したmessage、S11tnext manifestを確認する。

E2E境界は、質問入力から検索、プロンプト生成、provider port、応答parse、引用検証、最終結果までとする。HTTP server、ブラウザ、実providerのwire protocolはこのexampleの境界に含めない。

## 3. Locked Decisions

### 3.1 二つのS11tnext projectを分離する

通常のprovider向けプロンプトと、LLMが返すtest fixture本文は、別のconfig、source、generated artifactで管理する。

- `prompts/`: アプリケーションがproviderへ送るRAGプロンプト。
- `test-fixtures/`: E2Eだけが読む固定LLM応答。

fixtureを通常のprompt keyspaceへ混ぜない。生成物も共有しない。

### 3.2 検索は決定的なkeyword方式にする

corpusはコード内の少数の文書で構成し、各文書に明示的なkeywordを持たせる。検索は次の規則に固定する。

1. 質問に含まれるkeyword数でscoreする。
2. scoreが0の文書を除外する。
3. score降順、同点の場合は文書IDのcode-unit順で並べる。
4. 上位1件だけをprovider contextへ渡す。

embedding、ベクトル類似度、形態素解析、外部検索は使用しない。この検索はRAGのデータフローを示すfixtureであり、検索品質の例ではない。

### 3.3 検索文書と質問をuntrustedとして扱う

通常prompt catalogでは、質問と検索結果をruntime inputとして扱う。

- 質問: `untrusted.text`、`delimited-context`、`delimited-text`
- 検索文書: `untrusted.json`、`delimited-context`、`json-value`

corpusがexample内の固定値でも、実際のRAGで外部由来になる境界を正しく示すため、`trusted`へ緩和しない。

### 3.4 provider差し替えはportで行う

アプリケーションは次の最小portにだけ依存する。

```ts
interface LlmProvider {
  generate(request: LlmRequest): Promise<string>;
}
```

`LlmRequest`は、S11tnext invocationから得たmessage role、本文、manifestを保持する。fixture providerは同じportを実装し、受け取ったrequestを読み取り専用で記録してtestから確認可能にする。

fixture providerは質問本文、keyword、正規表現からscenarioを推測しない。constructorまたはfactoryへ渡された型付きfixture keyを明示的に使用する。

### 3.5 fixture catalogはtext-onlyで利用する

LLM応答fixtureはproviderが返す本文であり、S11tnextのprovider-message roleとして送信するものではない。fixture側は`bindText()`を使い、次のbindingを固定する。

```ts
{
  instructionLocale: "ja-JP",
  fallbackLocales: [],
  trailingNewline: false
}
```

provider上のassistant応答という意味はfixture provider portが所有する。fixture catalogのdefault message roleをassistant roleの代替として解釈しない。

通常prompt側は`bind()`を使い、`instructionLocale: "ja-JP"`、`fallbackLocales: []`、`trailingNewline: false`をrequestごとに固定する。provider portへは本文だけでなくinvocation manifestも渡す。

### 3.6 generated artifactは静的JSON importで読み込む

二つの`catalog.json`は、それぞれのcatalog facadeからJSON import attributesを使って読み込み、generated factoryへ`unknown`として渡す。`tsconfig.json`では`resolveJsonModule: true`を有効にし、TypeScript buildがJSONを`dist`へ含めることをfocused buildと`start`で検証する。

cwd依存のpath探索、test専用path分岐、runtimeでのTOML読み込みは追加しない。

### 3.7 scenario state machineを作らない

初期exampleは1回の検索と1回のprovider呼び出しに限定する。turn queue、retry、tool call、streaming、record/replayは追加しない。

fixtureは次の三つだけを用意する。

- `llmFixture.empty-citations`: 引用を持たない拒否確認用応答。
- `llmFixture.grounded-answer`: 検索文書を正しく引用する成功応答。
- `llmFixture.unsupported-citation`: 検索されていない文書IDを引用する拒否確認用応答。

negative fixtureは別workflowではなく、同じRAG境界が引用なしとunsupported citationをfail-closeすることを確認する。

## 4. Target Architecture

```text
question
   |
   v
deterministic keyword retriever -----> retrieved document
   |                                        |
   +-------------------+--------------------+
                       |
                       v
             prompts/ S11tnext catalog
             bind() -> message + manifest
                       |
                       v
                 LlmProvider port
                       |
                       v
          test fixture provider (E2E only)
                       |
                       v
        test-fixtures/ S11tnext catalog
        bindText() -> fixed JSON response
                       |
                       v
             JSON and citation guard
                       |
                       v
                  RAG answer
```

S11tnextはprompt/fixture本文、型付きkey、runtime value encoding、artifact整合性を所有する。検索、scenario選択、provider呼び出し、JSON validation、引用検証はexample applicationが所有する。

## 5. Proposed File Layout

```text
examples/rag-e2e-fixture/
  README.md
  package.json
  tsconfig.json

  prompts/
    s11tnext.config.toml
    contexts/
      rag/
        answer.context.toml
    generated/
      catalog.json
      catalog.generated.ts

  test-fixtures/
    s11tnext.config.toml
    catalog.ts
    demo.ts
    fixture-llm-provider.ts
    contexts/
      llmFixture/
        empty-citations.context.toml
        grounded-answer.context.toml
        unsupported-citation.context.toml
    generated/
      catalog.json
      catalog.generated.ts

  src/
    corpus.ts
    prompt-catalog.ts
    rag.ts

  tests/
    rag.e2e.test.ts
```

### File responsibilities

- `prompts/contexts/rag/answer.context.toml`
  - 取得資料だけを根拠に回答する指示を定義する。
  - 出力を`{"answer": string, "citations": string[]}`へ固定する。
  - `message_role = "user"`を明示する。
- `test-fixtures/contexts/llmFixture/*.context.toml`
  - providerから返るJSON文字列だけを保持する。
  - scenario分岐、検索条件、application stateを持たない。
- `src/prompt-catalog.ts`
  - 通常promptのgenerated factoryへartifactを`unknown`として渡す。
  - application側へ`bind()`したprompt rendererを公開する。
- `test-fixtures/catalog.ts`
  - fixture専用generated factoryへartifactを`unknown`として渡す。
  - test側へ`bindText()`したfixture rendererを公開する。
- `src/corpus.ts`
  - 文書型、固定corpus、決定的keyword retrieverを所有する。
- `test-fixtures/fixture-llm-provider.ts`
  - test fixture keyを明示的に受け、`LlmProvider`を実装する。
  - 受信したrequestのsnapshotをtest向けに保持する。
  - 通常application moduleからimportされない。
- `test-fixtures/demo.ts`
  - applicationとfixture providerを組み合わせるexample専用composition rootとする。
  - build済みscenarioの`start` entrypointとして使用する。
- `src/rag.ts`
  - provider port、RAG orchestration、応答shape検証、citation subset検証を所有する。
- `tests/rag.e2e.test.ts`
  - application全体の成功case、引用なし、unsupported citation、検索結果なしを確認する。

## 6. Implementation Tasks

### Task 1: 変更前baselineを採取する

実装前に次を実行し、既存exampleが成功することとworking treeを記録する。

```sh
git status --short
pnpm test:examples
pnpm typecheck
```

既存失敗がある場合は、新exampleの失敗と混同せず、実装結果に明記する。

### Task 2: workspace packageを追加する

`examples/rag-e2e-fixture/package.json`を追加する。

- package name: `s11tnext-example-rag-e2e-fixture`
- `private: true`
- runtime dependency: `s11tnext: workspace:*`
- dev dependencies:
  - `s11tnext-cli: workspace:*`
  - rootと同じversionの`vitest`
- Node.js enginesは既存exampleと同じ範囲にする。

scriptsは次の責務に分ける。

- `catalogs:build`: prompt catalogとfixture catalogを順にbuildする。
- `catalogs:check`: 両catalogを`build --check`する。
- `build`: catalogs build後に`tsc -b`する。
- `test`: focused E2E testを実行する。
- `check`: catalogs check、`tsc -b`、focused E2E testをすべて実行する。
- `start`: build済みの成功scenarioを実行する。

`pnpm install --lockfile-only`でworkspace importerをlockfileへ反映する。

`tsconfig.json`は既存exampleと同じNodeNext / project reference構成を継承し、次を追加する。

- `rootDir: "."`
- `outDir: "dist"`
- `resolveJsonModule: true`
- `src/**/*.ts`、`test-fixtures/**/*.ts`、`tests/**/*.ts`、両方のcatalog JSONをtypecheck対象にする。
- `packages/runtime`へのproject referenceを持つ。

### Task 3: 通常RAG prompt catalogを作る

`prompts/s11tnext.config.toml`へ次を定義する。

- source locale: `ja-JP`
- keyspace: `rag`
- release profile: `example`
- `untrusted.text`と`untrusted.json` variable profile

`rag.answer`は次を要求する。

- 取得資料だけを根拠にする。
- 根拠がない内容を補完しない。
- JSON objectだけを返す。
- `answer`をstring、`citations`を文書IDのstring arrayにする。

質問と取得文書の両方をplaceholderとして宣言し、生成型により不足・余分な値をcompile時に検出できるようにする。

### Task 4: test fixture catalogを作る

`test-fixtures/s11tnext.config.toml`へ次を定義する。

- source locale: `ja-JP`
- keyspace: `llmFixture`
- release profile: `e2e`
- runtime variableなし

成功fixtureは、S11tnextの説明文書だけを引用する有効なJSONにする。negative fixtureは、引用が空の応答と、同じshapeを保ちながら検索されない文書IDを1件含む応答を用意する。

両configをCLIでbuildし、TOML source、`catalog.json`、`catalog.generated.ts`を同じ変更へ含める。generated fileは手編集しない。

### Task 5: 小さなRAG applicationを実装する

`src/corpus.ts`へ最低2件の文書を置く。

- S11tnextのプロンプト管理を説明する関連文書。
- 別topicを説明する非関連文書。

retrieverはLocked Decisionのscore規則を実装し、検索結果が0件の場合はproviderを呼ばず、安定したapplication errorを返す。

`src/rag.ts`は次の順序を固定する。

1. 文書検索。
2. `rag.answer` invocation生成。
3. invocationのrole、content、manifestをprovider portへ渡す。
4. provider responseを`JSON.parse`する。
5. plain object、`answer: string`、`citations: string[]`を検証する。
6. citationが1件以上あり、すべて検索文書IDのsubsetであることを検証する。
7. immutableな最終結果を返す。

新しいschema validation packageは追加しない。example内の小さなtype guardで必要なshapeだけを検証する。

### Task 6: fixture providerを実装する

fixture providerは作成時に`LlmFixtureKey`を受け取り、`generate()`ごとにそのkeyの本文を返す。

- text bindingは一度だけ作成する。
- 暗黙fallbackを追加しない。
- terminal newlineを追加しない。
- request本文からfixture keyを選ばない。
- environment variable、global mutable queue、filesystemへの書き込みを使用しない。
- request snapshotはinstance-localに保持し、test終了後に共有stateを残さない。

### Task 7: E2E testを追加する

成功caseでは次をassertする。

1. 最終回答がgrounded fixtureの`answer`と一致する。
2. citationが関連文書IDだけを含む。
3. provider requestに質問と関連文書が含まれる。
4. provider requestに非関連文書が含まれない。
5. message roleが`rag.answer`でauthoringした`user`と一致する。
6. manifestの`key`が`rag.answer`である。
7. fixture responseの末尾に暗黙改行が追加されていない。

negative caseでは`llmFixture.empty-citations`と`llmFixture.unsupported-citation`を明示指定し、引用なしと検索されていないcitationをapplicationが拒否することをassertする。検索結果が0件の場合にproviderを呼ばないことも確認する。

testは実LLM、`fetch`、socket、API key、`.env`を使用しない。time、random、process間共有stateにも依存させない。

### Task 8: repository統合と説明を追加する

次を更新する。

- root `tsconfig.json`へproject referenceを追加する。
- root `examples:update`へ新exampleのbuildを追加する。
- root `test:examples`へ新exampleのcheckを追加する。
- root `README.md`の日本語・英語のexample一覧へ追加する。
- example固有`README.md`へ、実行方法、アーキテクチャ、mock境界、非目標を記載する。

root READMEでは「S11tnextがLLM providerやRAG engineを提供する」と表現しない。「固定LLM応答を決定的なtyped fixtureとして管理できる」と説明する。

## 7. Verification

### Focused verification

```sh
pnpm --filter s11tnext-example-rag-e2e-fixture catalogs:check
pnpm --filter s11tnext-example-rag-e2e-fixture test
pnpm --filter s11tnext-example-rag-e2e-fixture build
pnpm --filter s11tnext-example-rag-e2e-fixture start
```

期待結果:

- 両catalogのgenerated outputがcurrentである。
- E2Eのsuccess / empty citations / unsupported citation / no retrieval caseが成功する。
- TypeScript buildが成功する。
- `start`がgrounded answerと関連文書IDをJSONで表示する。

### Repository verification

```sh
pnpm test:examples
pnpm typecheck
pnpm build
git diff --check
```

期待結果:

- 既存二つを含む全exampleが成功する。
- 新しいproject referenceを含む型検査が成功する。
- runtime / CLI / exampleのbuildが成功する。
- whitespace errorがない。

### Failure isolation

- catalog check失敗:
  - 対象config、TOML source、二つのgenerated fileのstale差分を確認する。
- retrieval assertion失敗:
  - keyword score、0件除外、tie-break、上位1件への制限を確認する。
- prompt assertion失敗:
  - placeholder profile、runtime value、locale binding、message roleを確認する。
- fixture assertion失敗:
  - 明示fixture key、`fallbackLocales: []`、`trailingNewline: false`を確認する。
- JSON / citation validation失敗:
  - provider response shapeと、retrieved document IDのsubset判定を確認する。
- repository build失敗:
  - root project reference、JSON artifactの解決、package scriptのworking directoryを確認する。

検証が完了するまでexampleを完了扱いにしない。

## 8. Acceptance Criteria

- `examples/rag-e2e-fixture`だけでRAG風scenarioの目的、実行方法、境界を理解できる。
- 通常promptとtest fixtureが別々のS11tnext config / source / generated artifactを持つ。
- 質問と検索文書がuntrusted runtime valueとして安全にrenderされる。
- providerへ送るmessageとmanifestの対応が失われない。
- fixture providerが明示keyから固定応答を返し、request本文からscenarioを推測しない。
- success caseが検索、prompt、provider、parse、citation validationを一続きで通る。
- 引用なしとunsupported citationがfail-closeする。
- 検索結果が0件の場合はproviderを呼ばない。
- 実LLM、外部HTTP、credential、embedding、vector databaseを必要としない。
- generated artifactのstale check、focused E2E、全example check、root buildが成功する。
- READMEがS11tnextの責務をprovider mock frameworkやRAG frameworkへ拡張して説明していない。

## 9. Non-goals

- OpenAI、Anthropic、Azure、Bedrock互換HTTP mock。
- streaming、SSE、retry、rate limit、provider error envelope。
- embeddings、vector database、semantic search、reranking。
- multi-turn chat、tool calling、agent loop、scenario state machine。
- UI、HTTP API、Playwright、database。
- production trafficのrecord / replay。
- 回答品質、検索精度、RAG evaluation benchmark。
- fixture catalogをproduction prompt catalogへ統合すること。
- S11tnext runtimeまたはCLIの公開API変更。

これらはexampleの主目的を広げるため、今回の実装へ含めない。
