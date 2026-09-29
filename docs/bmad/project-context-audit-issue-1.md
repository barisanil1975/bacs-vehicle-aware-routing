# BMAD Project Context Audit — Issue #1

**Date:** 2026-09-29  
**Repository:** `barisanil1975/bacs-vehicle-aware-routing`  
**Base:** `2e69df66f54f366a685d7922c48cdb597e6f999b`  
**Mode:** audit / no instruction-file rewrite

## Existing context

`CLAUDE.md` already defines the repo-local implementation role, minimum safe patch rule, test/build requirement, no-secret rule, no broad refactor rule, and expected technical handoff format.

## Decision

Retain `CLAUDE.md` for this pilot. Do not create a second instruction authority in `AGENTS.md`.

The following facts are the minimum repo-local context for Issue #1:
- product code is in `src/lib/` and `src/components/`;
- routing regression tests are in `tests/routing.test.ts`;
- pricing regression tests are in `tests/pricing.test.ts`;
- deterministic commands are `npm test` and `npm run build`;
- Issue #1 must not change the public request signature or introduce an external service;
- no Production/Cloudflare action belongs to this pilot.

## Observed pitfall

Two heavy-vehicle regression tests were appended to `src/lib/routing-engine.ts` instead of `tests/routing.test.ts`. The implementation patch may relocate those exact tests into the test suite; this is in-scope corrective work, not a broad refactor.
