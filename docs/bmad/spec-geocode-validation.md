# BMAD Spec — Geocode Payload Validation

## Intent

Make `geocodeAddress()` fail closed when Nominatim returns malformed HTTP-200 JSON while preserving current behavior for valid responses.

## Capabilities

1. Valid Nominatim payload returns the same `display + LatLng` structure.
2. Empty result array returns `null`.
3. Non-array/malformed first item returns `null`.
4. Non-finite or out-of-range latitude/longitude returns `null`.
5. Missing/blank `display_name` returns `null`.
6. Tests use mocked `fetch`; no external network access.

## Constraints

- PUBLIC / L2 / non-Production.
- No endpoint, request headers or public function signature change.
- No Issue #2 autocomplete work.
- Minimum safe patch only.
- Verification: tests + strict typecheck + production build.

## Success

Exact PR head passes all three deterministic CI stages with no corrective scope expansion.
