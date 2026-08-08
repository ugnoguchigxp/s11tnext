# s11tnext-cli

Loads TOML, validates sources, and emits deterministic catalog JSON and TypeScript.
Supported Node.js releases are 22 and 24.

Published on npm; `0.x` compatibility is pre-release. Review the changelog when upgrading.

```sh
npm install --save-dev s11tnext-cli
```

```sh
s11tnext init [options]
s11tnext lint [--config s11tnext.config.toml] --release-profile name [--format human|json]
s11tnext build [--config s11tnext.config.toml] --release-profile name [--check] [--format human|json]
s11tnext watch --release-profile name [options]
s11tnext inspect key [--resolved] [--locale ja-JP] --release-profile name [--format human|json]
s11tnext inspect --coverage --locale en-US [--fallback-locale ja-JP] --release-profile name [--format human|json]
s11tnext completion bash|zsh|fish
s11tnext help [command]
s11tnext --version
```

`init` scaffolds without overwriting. `watch` rebuilds after edits. Taplo schemas are included.
`runCliAsync()` supports `watch`; `runCli()` is synchronous.

The CLI derives canonical dot keys from source paths and resolves locale, owner, and variable policy at
project level. Every authoring command requires an explicit release profile.

Root `message_role = "system" | "user"` selects the provider role and defaults to `system`. Generated
types preserve role-specific `PromptInvocation` results; `messageHash` exists only after rendering.

Source locale may be overridden per keyspace or document. Variables may be optional, sections may use
`omit_if_empty`, and generated TypeScript indentation can be configured while retaining deterministic
output.

Coverage inspection reports keys as `direct`, explicit `fallback`, or `missing` without changing build
policy. Release profiles may scope required locales by keyspace. Reusable section profiles provide
`kind`, `severity`, and `optimizable`.

See the [getting-started guide](https://github.com/ugnoguchigxp/s11tnext/blob/main/docs/guides/getting-started.md),
[compatibility policy](https://github.com/ugnoguchigxp/s11tnext/blob/main/docs/specification/compatibility.md),
and [troubleshooting guide](https://github.com/ugnoguchigxp/s11tnext/blob/main/docs/guides/troubleshooting.md).
