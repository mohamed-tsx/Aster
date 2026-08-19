# Cases, Hospitals & Agencies Module Design

## Overview

The domain schema foundation (`2026-08-20-domain-schema-design.md`) landed the data
layer for Aster's case-management/finance domain but built no application logic on top
of it. This spec designs the first slice of real functionality: case intake, the
hospital-matching workflow, and the two supporting catalogs (`Hospital`, `Agency`) that
case intake depends on. Visa/document handling and finance (Payment/Expense/Refund)
remain separate follow-up specs, per that spec's roadmap.

Everything here follows the conventions already established by the Users and
Roles/Permissions features in this repo: Express routes → controllers (thin,
`asyncHandler` + `sendSuccess`/`sendCreated`) → services (Prisma + `AppError`),
`RequirePermission`/`RequireAnyPermission` middleware, zod validation on the frontend,
`unwrap`/`ApiSuccess` service wrappers, and Tailwind/shadcn table+dialog UI patterns
matching `roles-tab.tsx`/`users-table.tsx`.

## Decisions captured

- **Patient reuse:** case intake starts with a passport-number lookup
  (`GET /api/v1/cases/patients/search?passportNumber=`); staff pick an existing
  `Patient` or fall through to a new-patient form. Matches the domain spec's "patients
  are reusable" rule and uses the `Patient.passportNumber` index added in the schema
  foundation's fix wave.
- **Attendant:** collected inline as part of the case form (toggle: traveling with an
  attendant Y/N) — never a standalone flow, since it's 1:1 with `Case` and not reusable.
- **Hospital/Agency catalogs:** both get full CRUD admin pages (mirroring Roles &
  Permissions), not just inline pickers — hospitals and agencies must exist before any
  case can reference them, and the seeded `MANAGE_HOSPITALS`/`MANAGE_AGENCIES`
  permissions are for exactly this.
- **Hospital inquiries:** one `PENDING` inquiry per case at a time (enforced at the
  service layer, not the DB — no partial unique index). Declining frees the case up to
  try another hospital.
- **Case status is auto-driven by hospital-inquiry responses**, not a manual dropdown:
  sending an inquiry → `HOSPITAL_MATCHING`; accept/decline response →
  `HOSPITAL_ACCEPTED`/`HOSPITAL_DECLINED`. `VISA_PROCESSING`/`COMPLETED` are not
  reachable yet in this slice (no visa module exists) — that's fine, they just sit
  unused in the enum until the Visa & Documents module adds the transition into them.
- **Manual cancellation** is available at any status except already-`CANCELLED`, via a
  dedicated endpoint — independent of the auto-transitions above. No refund logic yet
  (Finance module's job); this only flips status.
- **Case-immutable fields after creation:** `patientId`, `reachOutType`, `caseNumber`.
  Changing `reachOutType` after creation would silently invalidate the fee logic a
  future Finance module depends on.
- **Catalog deletes** (`Hospital`, `Agency`) get a friendly `_count`-based pre-check
  (mirroring `deleteRole`'s "N users still assigned" guard) even though the DB already
  enforces this via `RESTRICT` foreign keys (`Case.agency`, `HospitalInquiry.hospital`)
  — avoids surfacing a raw Postgres FK-violation message to the user.

## API surface

### Hospitals (`/api/v1/hospitals`)
- `GET /` — `RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_HOSPITALS"])`
- `POST /`, `PUT /:id`, `DELETE /:id` — `RequirePermission("MANAGE_HOSPITALS")`

### Agencies (`/api/v1/agencies`)
- Same shape as Hospitals, with `MANAGE_AGENCIES`.

### Cases (`/api/v1/cases`)
- `GET /` — `RequirePermission("VIEW_CASES")`. Paginated; query params `page`, `limit`,
  `status`, `reachOutType`, `assignedToId`, `q` (searches patient name/passport).
- `GET /:id` — `RequirePermission("VIEW_CASES")`. Includes `patient`, `attendant`,
  `agency`, `assignedTo`, `inquiries` (ordered `sentAt desc`).
- `GET /patients/search?passportNumber=` —
  `RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES"])`.
- `POST /` — `RequirePermission("CREATE_CASES")`. Body: `patientId` OR new-patient
  fields, optional attendant fields, `reachOutType`, `agencyId` (required iff
  `AGENCY`), `assignedToId`.
- `PUT /:id` — `RequirePermission("UPDATE_CASES")`. Patient/attendant field updates,
  reassignment, `agencyId`. Rejects attempts to change `patientId`/`reachOutType`.
- `PATCH /:id/cancel` — `RequirePermission("UPDATE_CASES")`. 400 if already
  `CANCELLED`.
- `POST /:id/inquiries` — `RequirePermission("UPDATE_CASES")`. Body: `hospitalId`,
  `notes?`. 409 if a `PENDING` inquiry already exists on the case. 400 if case is
  `CANCELLED`. Transactionally sets `case.status = HOSPITAL_MATCHING`.
- `PATCH /:id/inquiries/:inquiryId` — `RequirePermission("UPDATE_CASES")`. Body:
  `status` (`ACCEPTED`/`DECLINED`), `treatmentCostEstimate?`, `currency?`, `notes?`.
  400 if the inquiry isn't `PENDING`. Transactionally sets `case.status` to
  `HOSPITAL_ACCEPTED`/`HOSPITAL_DECLINED`.

## File structure

**Backend (new):**
- `Server/Src/Routes/Hospitals/hospitalsRoute.js`,
  `Controllers/Hospitals/hospitalsController.js`,
  `Services/Hospitals/hospitalsService.js`
- `Server/Src/Routes/Agencies/agenciesRoute.js`,
  `Controllers/Agencies/agenciesController.js`,
  `Services/Agencies/agenciesService.js`
- `Server/Src/Routes/Cases/casesRoute.js`, `Controllers/Cases/casesController.js`,
  `Services/Cases/casesService.js` (Case + Patient + Attendant + inquiry logic
  together — one aggregate, not worth splitting further)
- `Server/Src/Config/Generators/ID/customCaseIdGenerator.js` — mirrors
  `customUserIdGenerator.js`, format `ASR-CASE-YY-MM-####`
- `Server/cmd/Server/Server.js` — mount the three new routers
- `Server/Src/Utils/Rbac/` — no new escalation-guard logic needed; existing
  `RequirePermission`/`RequireAnyPermission` cover everything here

**Frontend (new):**
- `aster/app/dashboard/hospitals/page.tsx`, `aster/components/hospitals/*`
- `aster/app/dashboard/agencies/page.tsx`, `aster/components/agencies/*`
- `aster/app/dashboard/cases/page.tsx`,
  `aster/app/dashboard/cases/new/page.tsx`,
  `aster/app/dashboard/cases/[id]/page.tsx`,
  `aster/app/dashboard/cases/[id]/edit/page.tsx`,
  `aster/components/cases/*`
- `aster/types/{hospital,agency,case,patient}.ts`
- `aster/services/{hospitals,agencies,cases}.ts`
- `aster/lib/validations/{hospital,agency,case}.ts`
- `aster/components/Layout/Sidebar.tsx` — two new top-level links ("Hospitals",
  "Agencies", each single-permission gated) and a "Cases" dropdown ("All Cases" /
  "Add New Case"), same shape as the existing "Users" dropdown

## Implementation split

Two plans, in dependency order:

1. **Hospitals & Agencies catalogs** — self-contained, no dependency on anything new.
2. **Cases module** — Patient/Attendant/Case CRUD, hospital-inquiry flow, sidebar
   wiring. Depends on Plan 1 existing so the hospital/agency pickers have data to
   point at.

## Out of scope

- Visa applications, documents, and all finance (Payment/Expense/Refund) — separate
  follow-up specs per the domain schema design's roadmap.
- Editing a patient's info from anywhere other than the case edit form (no standalone
  Patients admin page).
- Allowing multiple concurrent `PENDING` hospital inquiries per case.
- Any automatic transition into `VISA_PROCESSING`/`COMPLETED` — not reachable until
  the Visa & Documents module exists.
- Refunds or any money movement on cancellation — Finance module's job once it exists.
