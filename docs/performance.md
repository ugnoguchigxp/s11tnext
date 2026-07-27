# Performance and size budgets

Run the reproducible workload from the repository root:

```sh
pnpm benchmark
pnpm benchmark:check
```

The benchmark compiles catalogs containing 100, 1,000, and 10,000 contexts, validates and loads a
1,000-context catalog, renders 20,000 invocations, bundles the Runtime for an ES2022 browser, and records
tarball and generated-TypeScript sizes. Results are written to `.artifacts/benchmark.json`.

Timing and memory figures are observational because shared CI runners vary. They are published for
capacity planning but do not fail CI. Deterministic size metrics are checked against
`config/performance-budgets.json`; update a budget only with an explanation in the Changeset.

Reference run on Node.js 24.11.1, macOS arm64:

| Measurement | Result |
| --- | ---: |
| Compile 100 contexts | 10.22 ms |
| Compile 1,000 contexts | 44.13 ms |
| Compile 10,000 contexts | 476.52 ms |
| Validate/load 1,000 contexts | 26.43 ms |
| Render throughput | 257,959 operations/second |
| Minified Runtime browser bundle | 27,218 bytes |
| Runtime / CLI tarballs | 16,326 / 18,680 bytes |
| Generated TypeScript for 1,000 contexts | 153,033 bytes |

The benchmark uses a compact one-locale, one-variable context. Application results will vary with
section count, locale count, and rendered value size. Measure representative application catalogs
before setting production latency or memory limits.
