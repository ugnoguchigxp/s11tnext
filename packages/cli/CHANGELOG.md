# s11tnext-cli

## 0.2.0

### Minor Changes

- 28fa293: Drop Node.js 20 after its upstream end of life. Supported Node.js releases are now 22 and 24.

### Patch Changes

- d5f39b1: Distinguish missing files and source directories from permission, directory, and other filesystem read
  failures in CLI diagnostics.

  The scoped source watcher and actionable filesystem diagnostics increase the packed CLI from 22,908
  bytes on the preceding main commit to 23,602 bytes. Raise its deterministic size ceiling from 23,000 to
  24,500 bytes, retaining 3.8% headroom while continuing to reject larger unreviewed growth.

- cb2d35b: Add safe project scaffolding, continuous catalog rebuilds with a public asynchronous CLI entry point,
  distributable editor schemas, clearer migration guidance, and a Promptfoo evaluation example. Strengthen
  repository-wide and release traceability checks.
- Updated dependencies [28fa293]
  - s11tnext@0.2.0

## 0.1.3

### Patch Changes

- 020c0d3: Escape invisible C0/C1 control and bidirectional-override characters in delimited runtime values, and
  reject JSON values deeper than 256 containers with a stable diagnostic. Add required CI aggregation,
  recurring registry-consumer validation, stable-release provenance checks, package metadata and public
  API reports, generated-example freshness checks, stronger branch coverage gates, a minimal adoption
  path, and performance size budgets.
- Updated dependencies [020c0d3]
  - s11tnext@0.1.3

## 0.1.2

### Patch Changes

- aea25be: Add newline-preserving `delimited-text` encoding, optional variables and
  conditional sections, keyspace-scoped release locale requirements, reusable
  section profiles, configurable terminal newlines, document and keyspace
  source-locale overrides, generated TypeScript indentation, and byte-range
  composition receipts. Add authored `system`/`user` provider-message roles,
  role-aware invocations and message hashes, and version 2 artifacts that reject
  unversioned or incompatible catalogs. Remove unverifiable section `enforcement` claims.
  Document composite TypeScript and Bun support boundaries, correct the published
  package status, and make verification workflows build package exports before
  tests that resolve them.
- Updated dependencies [aea25be]
  - s11tnext@0.1.2

## 0.1.0

### Minor Changes

- 2aa483d: Publish the initial S11tnext runtime and CLI packages.

  - Compile content-first TOML into one deterministic catalog format with path-derived keys and generated
    TypeScript contracts.
  - Render trusted and delimited untrusted values through a portable, browser-compatible runtime.
  - Audit immutable invocations, request-local render traces, locale coverage, and content digests.
  - Validate authoring, translations, artifacts, package contents, and isolated npm consumers fail-closed.

### Patch Changes

- Updated dependencies [2aa483d]
  - s11tnext@0.1.0

## 0.0.0

Initial development version.
