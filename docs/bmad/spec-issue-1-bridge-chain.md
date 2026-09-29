# BMAD Spec — Issue #1 Heavy-Vehicle Bridge Chain

## Why

For European Istanbul → South Marmara/Aegean heavy-vehicle routes, the route profile already plans `YSS + Osmangazi`, but downstream analysis/pricing falls back to `detectBridges()` and loses YSS. The UI consequently shows an incomplete bridge chain and a combined toll figure without separate bridge/highway lines.

## Capabilities

**CAP-1 — Planned bridge chain survives analysis**  
For `TIR 22-26t`, Maslak → İzmir and Mahmutbey → Bursa must expose the route-profile bridge chain in route order as `yss, osmangazi`.

**CAP-2 — Pricing uses the resolved route analysis**  
Toll pricing must calculate each resolved bridge in the analysis chain and preserve highway/KGM cost separately from bridge cost.

**CAP-3 — Presentation exposes the breakdown**  
The result panel must show highway/KGM and each bridge fee as separate visible lines while retaining a total toll amount.

**CAP-4 — Regression tests live in the test suite**  
The two heavy-vehicle regression tests currently appended to `routing-engine.ts` must be moved into `tests/routing.test.ts`; pricing tests must verify YSS + Osmangazi separation.

## Constraints

- Risk Lane: L2 Standard.
- Data class: PUBLIC.
- No external API/service changes.
- No public `QuoteRequest` signature change.
- No Production/Cloudflare/deploy action.
- Minimum safe patch; no unrelated routing refactor.
- Existing 2026 tariff values remain unchanged.
- Deterministic verification: `npm test` and `npm run build`.
- Test count must rise from baseline 43 to at least 46.

## Non-goals

- Nominatim/autocomplete (Issue #2).
- Cloudflare asset/cache repair (Issue #3).
- Updating KGM tariff values.
- Reworking the full route heuristic model.
- Deployment or live-site verification.

## Success signal

All of the following are true on the exact PR head:
1. Maslak → İzmir / TIR resolves `YSS + Osmangazi`.
2. Mahmutbey → Bursa / TIR resolves `YSS + Osmangazi`.
3. YSS and Osmangazi have separate bridge-cost entries.
4. Highway/KGM cost is separate from bridge costs.
5. `tests/routing.test.ts` contains both heavy-vehicle regression cases.
6. `tests/pricing.test.ts` verifies the separated breakdown.
7. Total tests ≥ 46 and all tests pass.
8. `npm run build` passes.
