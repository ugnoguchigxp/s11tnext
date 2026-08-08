# GitHub governance runbook

Repository settings are part of the release boundary. They cannot be guaranteed by files in a clone, so
maintainers must audit them after repository creation, ownership changes, and before a stable release.

## Required `main` rules

- Require a pull request before merging.
- Require the aggregate status check named `CI / required`, bind it to the GitHub Actions app, and
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
```

It checks branch protection or rulesets plus private vulnerability reporting through GitHub CLI. An
authenticated repository administrator must separately verify required reviewers on `npm-stable`, npm
trusted publishers for both packages, and `S11TNEXT_STABLE_RELEASE_ENABLED` before dispatch.

## Release traceability

Every stable release must have the same version in both packages, registry provenance, an annotated
`v<version>` tag, and a GitHub Release targeting the exact immutable publish commit. The release workflow
verifies this relationship after creating or reusing the release. Never republish an npm version to fix a
tag or release: repair only the missing GitHub object after verifying the commit.
