# Design-partner program

The next adoption milestone is three independent teams completing a real, redacted S11tnext evaluation.
The purpose is to replace repository-centric confidence with evidence about migration cost, review value,
and operational fit. Participation is free, best-effort, and does not create an SLA.

## Suitable partners

A partner should have a TypeScript or JavaScript application, at least one prompt currently assembled in
code or templates, and a willingness to share aggregate findings publicly or privately. Production data,
prompt text, credentials, model outputs, and customer identifiers are never required.

To volunteer, open the **Adoption report or design-partner interest** issue form with a synthetic use-case
description. Use private vulnerability reporting instead if the finding has security impact.

## Thirty-day evaluation

1. **Baseline:** record the current prompt count, locales, review workflow, change lead time, and known
   stale-generation or prompt-drift incidents.
2. **Migration:** move one bounded prompt path by following the
   [inline-prompt migration guide](../guides/migrating-inline-prompts.md). Record hands-on time and any
   missing documentation or CLI behavior.
3. **Operation:** use generated artifacts and invocation manifests in normal development for at least two
   weeks. Exercise a failed validation, a stale-output check, and rollback to the previous prompt path.
4. **Review:** report the aggregate measures below, plus keep/adopt, extend-evaluation, or stop and why.

## Measures

| Measure | Definition |
| --- | --- |
| Time to first valid build | Elapsed and hands-on time from installation to the first generated catalog |
| Migration effort | Hands-on time and number of source prompts migrated |
| Catalog scale | Approximate keys, locales, variants, and contributors; ranges are acceptable |
| Defects caught | Validation, stale-output, trust-classification, or review findings before release |
| Change lead time | Median time from prompt edit to reviewed artifact before and during evaluation |
| Audit usefulness | Whether digests or invocation manifests answered a real review/debugging question |
| Runtime impact | Observed bundle, latency, or integration overhead and measurement method |
| Retention decision | Keep, extend, or remove S11tnext after 30 days, with the main reason |

The maintainer publishes only aggregate counts unless the partner explicitly approves attribution. The
project has no default telemetry; all evidence is voluntarily submitted. Success for the first cohort is
three completed evaluations, at least two retained integrations, a median time to first valid build under
30 minutes, and every reported blocker either fixed or tracked with an owner and disposition.

## Feedback contract

Feedback may influence the roadmap but does not guarantee implementation. High-value reports include a
synthetic reproduction, desired outcome, current workaround, and compatibility constraints. At the end
of each cohort, the maintainer records the number invited, started, completed, retained, and the resulting
issues without inventing missing data.
