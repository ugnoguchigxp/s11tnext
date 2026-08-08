# Migrating inline prompts

Move one provider message at a time. S11tnext does not require a flag day and does not take ownership of
model settings, tool definitions, output validators, retries, or provider calls.

## 1. Inventory the current boundary

For each inline template, record:

- the provider-message role (`system` or `user`);
- every runtime value and its source;
- the source locale and required translations;
- the owning team and release environment;
- whether exact trailing newlines or other byte-level formatting matter;
- the existing tests, logs, or fixtures that prove current behavior.

Treat user input, retrieval results, tool output, webhook payloads, and previous model output as
`untrusted`. Do not change model parameters or application validation during the prompt move; that makes
behavioral differences easier to attribute.

## 2. Create the project boundary

For an empty package, scaffold a governed starter:

```sh
npx s11tnext-cli init --template production --locale en-US --owner application-team
```

In an existing S11tnext project, add a new `.context.toml` under the appropriate keyspace instead of
running `init`. Use `init --dry-run` when you only want to inspect the starter paths.

## 3. Convert one template

Before:

```ts
const content = `Review only the supplied evidence.\n${evidence}`;
await provider.generate({ messages: [{ role: "user", content }] });
```

After authoring `contexts/reviewer/evaluate.context.toml`:

```toml
message_role = "user"

text = '''Review only the supplied evidence.
[[evidence]]'''

[variables.evidence]
profile = "untrusted.text"
```

Build and use the generated contract:

```ts
const render = catalog.bind({ instructionLocale: "en-US" });
const invocation = render("reviewer.evaluate", { evidence });
await provider.generate({
  messages: [{ role: invocation.role, content: invocation.content.text }],
});
```

The generated value map makes missing, extra, and mistyped variables fail during TypeScript checking or
at the runtime boundary. Preserve `invocation.manifest` beside the provider request when audit identity is
required.

## 4. Prove equivalence before rollout

Add a fixture test that renders representative values and compares the role and content to the old
implementation. Test boundary-shaped values such as closing tags, control characters, multiline text,
empty optional values, and fallback locales. A move from raw interpolation to a delimited untrusted
profile intentionally changes bytes; review that security change rather than accepting a broad snapshot
update.

Run:

```sh
s11tnext lint --release-profile development
s11tnext build --release-profile development
s11tnext build --check --release-profile development
npm test
```

## 5. Roll out and remove the old path

Deploy the generated JSON and TypeScript files as one pair. Canary the migrated key, confirm the recorded
catalog/message hashes and locale resolution, then delete the inline template. Repeat for the next key.
Rollback restores the previous generated pair and application revision together; do not mix artifacts
from different compiler versions.

## Completion checklist

- No provider path still renders a second copy of the migrated prompt.
- Every runtime value has an explicit type, trust, placement, and encoding policy.
- Required locales pass `inspect --coverage`.
- The provider uses `invocation.role`, not a hard-coded replacement role.
- Generated outputs pass `build --check` and are reviewed together.
- Model settings, tools, authorization, output validation, and retries remain application-owned.
