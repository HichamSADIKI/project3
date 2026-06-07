# RealEstate foundations — party-role + physical hierarchy

> Extracted from the root `CLAUDE.md`. Cross-cutting reference for the `owners` · `tenants` · `vendors` · `technicians` · `buildings` · `units` modules.

## RealEstate party-role pattern (migration 0002)

`clients` is the umbrella **party** table (any individual or company the agency interacts with). Each business role is a **profile table** with PK = FK to the party, so a single client can hold multiple roles without duplication:

| Table | Extends | Purpose |
|---|---|---|
| `owners` | `clients.id` | Property owner. Carries mandate, IBAN, payout preferences. |
| `tenant_profiles` | `clients.id` | Tenant / candidate. Lifecycle: `candidate → active → former / blacklisted`. Loyalty score 0-100. |
| `vendors` | `clients.id` | External provider (maintenance, cleaning, security…). Trade licence, rating cumulé, marketplace eligibility. |
| `technicians` | `users.id` | **Internal salaried staff**, not a client. Skills + mobile app KPIs. |

Routes: `/api/v1/{owners,tenants,vendors,technicians}` — CRUD + specific endpoints (`POST /tenants/{id}/status` for lifecycle transitions, `POST /vendors/{id}/ratings`, `POST /technicians/{id}/ratings`).

Pure business helpers (testable without DB) live in `service.py`:
- `owners.service`: `mandate_is_active`, `days_until_mandate_expiry`, `needs_renewal_alert`
- `tenants.service`: `is_valid_transition`, `compute_loyalty_score`, `visa_alert_level`
- `vendors.service`: `merge_rating` (numerically stable cumulative avg, reused by technicians), `cancellation_rate`, `is_eligible_for_marketplace`

Shared FastAPI deps: `app/core/route_deps.py` (`get_company_id`, `require_roles`). New routers use this; legacy routers keep their inline copy for now.

## RealEstate physical hierarchy (migration 0003)

| Table | Parent | Purpose |
|---|---|---|
| `buildings` | — | Physical asset (tower, compound, mixed-use). PostGIS `location` + optional `footprint` polygon. DLD reference. Links to `owners`. |
| `floors` | `buildings.id` (CASCADE) | Optional intermediate level — present for towers, absent for villa compounds. Unique `(building_id, floor_number)`. |
| `units` | `buildings.id` (RESTRICT) + optional `floors.id` | Rentable / sellable atom. Holds Ejari/DEWA/ADDC account numbers, inventory JSONB, list rent/sale prices. Optional `legacy_property_id` FK bridges to the legacy `properties` table for progressive migration. |

The legacy `properties` table is untouched. New modules (maintenance, inspections, meters, parking — to come) target `units`. Routes: `/api/v1/buildings`, `/api/v1/buildings/{id}/floors`, `/api/v1/buildings/{id}/occupancy`, `/api/v1/units`, `/api/v1/units/{id}/status`.

Pure helpers: `buildings.service.compute_occupancy` (occupied+reserved vs vacant; excludes maintenance/renovation/off_market from denominator), `units.service.is_valid_status_transition` (state machine `vacant → reserved → occupied → vacant | maintenance → renovation → vacant`, `off_market → vacant`).
