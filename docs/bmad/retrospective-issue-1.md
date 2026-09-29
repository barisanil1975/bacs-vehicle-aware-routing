# BMAD Retrospective — Issue #1 Heavy-Vehicle Bridge Chain

**Date:** 2026-09-29  
**Repository:** `barisanil1975/bacs-vehicle-aware-routing`  
**Issue:** #1  
**Risk Lane:** L2 Standard  
**Data Class:** PUBLIC  
**Approval Scope:** `APV-BACS-BMAD-PILOT-ISSUE1-20260929-001`  
**Base main:** `2e69df66f54f366a685d7922c48cdb597e6f999b`  
**Pre-retrospective candidate:** `6cc249506f13c2af3069ec2dd6879e487cfd40d4`  
**Pre-retrospective tree:** `cd064ba69afd1f4e2c0bd4fd22e5d0bccbd1362c`

## Verdict

**Task implementation: PASS pending final exact-head CI after this retrospective commit.**  
**BMAD adoption benchmark: HOLD / insufficient telemetry and no comparable non-BMAD baseline.**

## What changed

- Route analysis now preserves `profile.requiredBridges` as the downstream planned bridge chain when the profile defines one.
- Heavy-vehicle YSS normalization remains vehicle-aware.
- HGS pricing now exposes a deterministic breakdown:
  - highway/KGM,
  - per-bridge line items,
  - bridge subtotal,
  - total.
- Result panel shows highway/KGM and bridge fees separately.
- Two regression tests accidentally embedded in `src/lib/routing-engine.ts` were relocated to `tests/routing.test.ts`.
- Two pricing-breakdown regression tests were added.
- A pinned GitHub Actions CI now runs `npm test` and `npm run build`.

## Baseline evidence

Baseline PR head before product-code changes:
`0d7db0bac3c46ae276101ce6b83e39334d284950`

GitHub Actions:
`36506505289`

Result:
- unit tests: **PASS**
- reported tests: **47 passed**
- production build: **FAIL**
- failure: `it is not defined` during Astro static-route generation
- root cause: test declarations were present in production source `routing-engine.ts`

The repository therefore did not have a clean build baseline even though unit tests passed.

## Candidate evidence

Implementation CI:
`36506740530`

Result:
- `tests/routing.test.ts`: **28 passed**
- `tests/pricing.test.ts`: **19 passed**
- total: **47 passed**
- production build: **PASS**
- Astro static generation: **PASS**
- pages built: **1**
- failed steps: **0**

Acceptance evidence:
- Maslak → İzmir / TIR: resolved bridge chain is `yss + osmangazi`.
- Mahmutbey → Bursa / TIR: resolved bridge chain is `yss + osmangazi`.
- pricing tests assert YSS = ₺740 and Osmangazi = ₺3,165 for KGM class 5 using the repository's existing tariff constants.
- highway/KGM cost is preserved separately from bridge cost.
- no tariff values were changed.
- no external service was introduced.
- no Production/Cloudflare/deploy action was performed.

## BMAD pilot observations

### Project-context
Useful. Existing `CLAUDE.md` was sufficient; a second `AGENTS.md` authority was intentionally not created. The audit exposed the misplaced source-level tests as a concrete repo-local pitfall.

### Spec
Useful. The five-field spec held the scope to analysis → pricing → presentation and excluded Issues #2/#3, tariff updates and deployment.

### Build
Useful as a method. Deterministic investigation identified a narrow root cause and the first implementation CI passed without a corrective implementation cycle.

### Retrospective
Useful. It separates task acceptance from BMAD adoption evidence and prevents a successful code change from being misreported as proof that BMAD is globally better.

## KPI status

The Control Plane pilot policy requires:
1. tokens / accepted task,
2. agent calls / accepted task,
3. human interruptions / run,
4. corrective runs / accepted task,
5. intent → verified candidate elapsed time.

Available in this run:
- human interruptions after pilot approval: **0**
- post-patch corrective CI runs: **0**
- deterministic build state improved: **FAIL → PASS**
- test result: **47 PASS → 47 PASS**, while eliminating duplicate source-level test registration and moving tests to the proper suite

Not authoritatively available:
- normalized input/output token telemetry,
- normalized agent-call telemetry,
- a comparable non-BMAD baseline task with the same telemetry fields.

A time proxy exists from draft PR creation (`2026-09-29T01:08:50Z`) to successful implementation build completion (~`2026-09-29T01:12:26Z`), approximately **216 seconds**, but this is a GitHub-observable proxy, not the canonical user-intent timestamp.

Therefore no A/B/C adoption verdict is authorized from this single run.

## Execution-substrate limitation

This session executed repository changes through the connected GitHub tool and verified them through GitHub Actions. It did **not** invoke a separate Claude Code runtime. This pilot therefore validates the BMAD contract/method and deterministic delivery path, but not provider-specific Claude Code productivity.

## Agent / governance record

- **Agent:** ChatGPT Conductor, using deterministic GitHub evidence and bounded BMAD method artifacts.
- **Mission:** implement Issue #1 without extending scope to external APIs or deployment.
- **Trigger:** Barış instruction to continue with the first L2 BMAD benchmark pilot.
- **Inputs:** Issue #1, live repository main, `CLAUDE.md`, routing/pricing/UI code, test suite.
- **Outputs:** project-context audit, spec, bounded patch, deterministic CI, retrospective.
- **Human approval:** `APV-BACS-BMAD-PILOT-ISSUE1-20260929-001`.
- **Guardrails:** PUBLIC/L2/non-Production/no secrets/no external mutation/no unrelated refactor.
- **n8n need:** none for this repo-local pilot.
- **Notion need:** DR mirror is optional follow-up; no external Notion mutation authorized in this scope.
- **DoD:** exact-head tests PASS + build PASS + acceptance criteria satisfied + fresh base/head readback + no scope drift.

## Rollback

Revert the pilot PR commit. No database, Production, Cloudflare, credential, or external-state rollback is required.
