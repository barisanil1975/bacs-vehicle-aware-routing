# BMAD Project Context Audit — Geocode Validation

**Date:** 2026-09-29  
**Base:** `aca7c16b9abee3453de1894258e26a25ae819cdb`  
**Mode:** audit only

## Existing context

`CLAUDE.md` remains the repo-local instruction source. No new `AGENTS.md` is required.

Relevant deterministic commands:
- `npm test`
- `npm run typecheck`
- `npm run build`

Relevant files:
- `src/lib/distance-service.ts`
- `tests/distance-service.test.ts`

## Boundary

This task validates Nominatim response parsing only. It does not add autocomplete, alter the external endpoint, change rate limiting, or perform live HTTP requests.

## Pitfall

`geocodeAddress()` currently casts JSON directly to the expected response type. A malformed but HTTP-200 payload can therefore propagate `NaN` coordinates or invalid display data instead of failing closed.
