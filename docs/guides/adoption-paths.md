# Adoption paths

S11tnext exposes governance and audit controls without requiring every project to adopt them on day
one. Choose the smallest path that matches the current risk.

## Minimal

Start with one locale, one message, and no runtime variables:

```sh
pnpm --filter s11tnext-example-minimal build
pnpm --filter s11tnext-example-minimal start
```

The complete source is in [`examples/minimal`](../../examples/minimal). Its configuration still names
the source and output directories, source locale, governance mode, and release profile explicitly, but
it does not introduce owners, translations, variable profiles, section profiles, or audit persistence.

## Production

Move to the [getting-started guide](./getting-started.md) when runtime values or multiple locales are
needed. Add:

- a non-raw encoding and `delimited-context` placement for untrusted values;
- explicit fallback locales at each request boundary;
- `s11tnext build --check` in CI;
- both generated files to the same code review.

## Governed

Use [backend integration](./backend-integration.md) and [trust boundaries](./trust-boundaries.md) when
prompt changes require ownership and request evidence. Add:

- keyspace owners and required locale policy;
- request-local render traces through `bindRequest()`;
- manifest persistence beside the provider request;
- release, policy, artifact, message, and rendered-text digest verification.

The Runtime and CLI contracts are identical across all three paths. Moving between paths changes
authoring and host integration, not the artifact model.
