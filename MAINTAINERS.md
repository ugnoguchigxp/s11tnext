# Maintainers

## Current ownership

The project currently has one maintainer:

| GitHub | Scope |
| --- | --- |
| `@ugnoguchigxp` | Repository administration, releases, security coordination, runtime and CLI |

This is a material continuity risk, not a two-person governance claim. `CODEOWNERS` records current
ownership so review routing is explicit. Branch protection must require the aggregate `required` check-run
check and a pull request, but a two-approval rule must not be enabled until at least two active,
independent maintainers exist.

## Becoming a maintainer

A contributor may be nominated after demonstrating all of the following:

1. Several substantive contributions across code, tests, documentation, or user support.
2. Consistent review quality, especially around compatibility, trust boundaries, and release safety.
3. Respectful collaboration and reliable follow-through over at least eight weeks.
4. Agreement to use 2FA and follow the release and security runbooks.

Promotion is recorded in a pull request updating this file and `CODEOWNERS`. Repository administration,
npm ownership, and stable-release approval are granted separately and only as needed.

## Review and release rules

- No change may bypass the required CI aggregate.
- The author must document user impact, verification, and rollback needs.
- Public API or schema changes require fixtures, tests, documentation, a Changeset, and an API report.
- A maintainer must not fabricate a second approval. Stable publishing stays disabled until `npm-stable`
  has an explicit required reviewer; the sole maintainer may be that reviewer only as a documented
  transitional control.
- After a second maintainer is established, require code-owner review and at least one approval from
  someone other than the author for workflow, release, and security-policy changes.

## Continuity

At least two active maintainers is the target. When that target is reached, both should have documented,
independently tested access to GitHub security advisories and the npm trusted-publishing configuration.
If the sole maintainer becomes unavailable, publication pauses; contributors may fork under Apache-2.0,
but nobody should claim authority over the original npm packages without control of their registry
accounts.
