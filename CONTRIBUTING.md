# Contributing

Use Node.js 20.19+, 22, or 24 and the pnpm version pinned in `package.json`.

Before submitting a change, run:

```sh
pnpm install --frozen-lockfile
pnpm verify:repository
```

`pnpm verify:repository` includes coverage, generated-example freshness, schema drift, cross-version hash
checks, packed-package contracts, isolated consumer tests, and the performance budget. Use `pnpm verify`
while iterating locally.

Keep the runtime free of Node.js builtins, filesystem access, process state, and TOML parsing. Public
contract changes must include fixtures, deterministic tests, a Changeset, and an intentionally reviewed
`pnpm api:report` diff. Generated `catalog.json` and `catalog.generated.ts` files must change together.

Pull requests should describe the user-visible outcome, compatibility impact, verification performed,
and rollback plan. See [MAINTAINERS.md](./MAINTAINERS.md) for review and maintainer expectations and
[SUPPORT.md](./SUPPORT.md) for support boundaries.
