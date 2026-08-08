# GitHub governance runbook

Repository settings are part of the release boundary. They cannot be guaranteed by files in a clone, so
maintainers must audit them after repository creation, ownership changes, and before a stable release.

## Required `main` rules

- Require a pull request before merging.
- Require the aggregate check-run named `required`, bind it to the GitHub Actions app, and
  require branches to be up to date.
- Require conversation resolution.
- Block force pushes and deletion.
- Apply the rule to administrators.
- Do not configure pull-request bypass allowances or ruleset bypass actors.
- Route ownership with `CODEOWNERS`.
- With one maintainer, do not pretend that an independent approval is possible. After a second active
  maintainer is recorded in `MAINTAINERS.md`, require code-owner review and at least one approval from a
  non-author.

Use a ruleset or branch-protection rule, but do not configure both with conflicting requirements. The
manual audit command is read-only:

```sh
pnpm governance:audit
pnpm governance:audit:stable
```

The first command checks branch protection or rulesets plus private vulnerability reporting through
GitHub CLI. The stable audit additionally requires `npm-stable` to block administrator bypass, have a
required reviewer, accept protected branches only, and keep `S11TNEXT_STABLE_RELEASE_ENABLED` disabled.
Immediately before an approved stable dispatch, set that variable to `true` and run
`pnpm governance:audit:stable-ready`. npm trusted publishers for both packages remain an npm-side check.

## Release traceability

Every stable release must have the same version in both packages, registry provenance, an annotated
`v<version>` tag, and a GitHub Release targeting the exact immutable publish commit. The release workflow
verifies this relationship after creating or reusing the release. Never republish an npm version to fix a
tag or release: repair only the missing GitHub object after verifying the commit.
