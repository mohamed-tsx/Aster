# Case Intake & Documents Design (Subsystem A)

## Overview

This is the first of four sub-projects decomposed from a larger feature request
(multi-hospital referrals, hospital return documents, embassy commission, agency
handling, a finance expansion, and a dashboard redesign). The full roadmap:

- **A — Case intake & documents** (this spec)
- B — Multi-hospital referral (hospital `country`, per-inquiry evaluation +
  invitation documents)
- C — Finance expansion (revenue register, debts owed to lenders, payables,
  embassy-visit commission)
- D — Dashboard redesign (KPIs, charts, visual system)

Subsystem A adds document capture to case registration and reshapes how
agency-sourced cases move through the visa stage. Concretely:

1. Patient passport and a "case document" become **required file uploads** at case
   registration; attendant passport is optional at intake and enforced later.
2. Patient/attendant typed passport number + expiry become **optional** (the
   uploaded file is the source of truth).
3. **Agency cases** keep our hospital-matching workflow but relax visa-stage
   paperwork gates and skip auto-creation of visa applications.
4. A new **app-settings key/value store** holds the configurable default visa
   registration fee (replacing today's hard-coded `100`/`400`).

This spec changes the Prisma schema (nullable columns, one enum value, two new
models) and touches `casesService`, `documentsService`, the Cases routes, and the
case-creation / fee-payment frontend.

## Business rules captured

### Documents at registration

- **`POST /cases` becomes `multipart/form-data`.** It accepts up to three named
  file fields alongside all the existing text fields:
  - `patientPassport` — **required** (see reuse exception below)
  - `caseDocument` — **required**; an uploaded doc/PDF/image describing the
    patient's medical situation
  - `attendantPassport` — **optional**, even when the case has an attendant
- **Reused-patient passport exception.** When the request supplies an existing
  `patientId` and *any prior case for that patient* already has a
  `PATIENT_PASSPORT` document, the `patientPassport` file is **not required** for
  the new case. A fresh upload is still accepted and, if provided, attached to the
  new case. When it is omitted, nothing is copied — the older document stays on
  its original case and the UI resolves "this patient's passport" by looking
  across the patient's cases (see Frontend).
- **Case document is versionable.** "Replace the case document later" = upload a
  new `CASE_DOCUMENT` row via the existing `POST /cases/:caseId/documents`
  endpoint. Older `CASE_DOCUMENT` rows are retained; the UI shows the newest and
  keeps the rest in history. No update/replace endpoint — matches the existing
  "documents are immutable once uploaded" rule from the visa-processing spec.
- **Allowed formats / size** are unchanged from the existing document uploader:
  JPG/PNG/WEBP, PDF, DOC, DOCX, 50 MB per file (`uploadDocument.js`).

### Passport typed fields become optional

- `Patient.passportNumber`, `Patient.passportExpiry`, `Attendant.passportNumber`,
  `Attendant.passportExpiry` change from required to **nullable**.
- The case create/edit forms drop the `required` constraint on these inputs; they
  remain editable and are still shown.
- **Expiring-passport alerts are unaffected in shape** — the existing query
  already filters on `passportExpiry`; rows with a null expiry simply never match.
  No code change needed in `expiring-passports` beyond tolerating nulls (Prisma
  `lte` on a nullable column already excludes nulls).
- Existing rows keep their current values — making the columns nullable is a
  non-destructive migration.

### Direct vs. agency divergence

A single helper, `isAgencyCase(kase)` ≙ `kase.reachOutType === "AGENCY"`, drives
every branch below. Nothing else about agency cases changes — they still create
hospital inquiries and receive inquiry responses exactly as today.

| Behaviour | DIRECT | AGENCY |
| --- | --- | --- |
| Hospital inquiry send / respond | unchanged | unchanged |
| On inquiry `ACCEPTED` | auto-create `VisaApplication` (PATIENT, + ATTENDANT if present) | **no** auto-creation |
| First `recordFeePayment` for a traveler | visa app already exists | **lazily create** the `VisaApplication` for that `travelerType` if missing |
| Attendant-passport gate on first fee payment | **enforced** (see below) | **not** enforced |
| Visa step ordering (`PENDING → FEE_PAID → EMBASSY_VISITED → APPROVED/REJECTED`) | enforced | **enforced** (kept) |
| `Case.status → VISA_PROCESSING` on first payment | unchanged | unchanged |
| `Case.status → COMPLETED` when all visa apps terminal | unchanged | unchanged (evaluated over whatever visa apps exist) |

- **Agency completion caveat.** Because agency visa apps are created lazily, a
  `recordVisaOutcome` call evaluates "all travelers terminal" over the visa apps
  that *exist*. If staff only ever record the patient's outcome, the case
  completes with one visa app. This is intended — the agency owns the attendant's
  process and we only track what staff enter.

### Attendant-passport gate (direct cases only)

- In `recordFeePayment`, for a **direct** case only: if `kase.attendant` exists
  **and** the case has no `Document` with `type === "ATTENDANT_PASSPORT"`, reject
  with `400 VALIDATION_ERROR`: `"Attendant passport must be uploaded before visa
  processing."`
- The check runs before any write, alongside the existing cancelled-case and
  `status === "PENDING"` guards.
- The reused-patient exception does **not** apply to the attendant — attendants
  are per-case (`Attendant.caseId @unique`), so there is no prior case to inherit
  from.

### App-settings store & visa fee default

- New `AppSetting` model — a flat key/value table, values stored as strings and
  parsed by the caller.
- Seeded keys:
  - `VISA_FEE_DEFAULT_DIRECT` = `"400"`
  - `VISA_FEE_DEFAULT_AGENCY` = `"100"`
- These replace the hard-coded `defaultAmount` in `fee-payment-dialog.tsx`. The
  amount field stays editable; the server still accepts **any** positive amount
  and still hard-codes `currency: "USD"` for a fee payment (unchanged from the
  visa-processing spec — the setting is a UI default only, never trusted for the
  actual write).
- New permission `MANAGE_SETTINGS`, seeded onto the ADMIN role. Reads of settings
  require only `Verify` (any logged-in user, so the fee dialog can prefill);
  writes require `MANAGE_SETTINGS`.

## Schema changes

```prisma
model Patient {
  // ...
  passportNumber String?   // was: String
  passportExpiry DateTime? // was: DateTime
}

model Attendant {
  // ...
  passportNumber String?   // was: String
  passportExpiry DateTime? // was: DateTime
}

enum DocumentType {
  PATIENT_PASSPORT
  ATTENDANT_PASSPORT
  CASE_DOCUMENT      // new
  INVITATION_LETTER
  VISA_COPY
  OTHER
}

model AppSetting {
  key         String   @id
  value       String
  updatedById String?
  updatedBy   User?    @relation(fields: [updatedById], references: [id])
  updatedAt   DateTime @updatedAt
}

model User {
  // ...
  appSettingsUpdated AppSetting[]
}
```

One migration: `20260829_case_intake_documents` — three `ALTER COLUMN ... DROP NOT
NULL`, one enum value add, one `CREATE TABLE "AppSetting"`.

## API surface

### `POST /api/v1/cases` — now multipart

- Route gains
  `uploadDocument.fields([{ name: "patientPassport", maxCount: 1 }, { name:
  "caseDocument", maxCount: 1 }, { name: "attendantPassport", maxCount: 1 }])`
  before `createCaseCtrl`. Permission unchanged (`CREATE_CASES`).
- Controller passes `req.files` into `createCase(data, files, userId)`.
- `createCase` service, after the existing patient/agency/assignee validation:
  1. Resolve whether `patientPassport` is required: required unless `patientId`
     is set and
     `Prisma.document.findFirst({ where: { case: { patientId }, type:
     "PATIENT_PASSPORT" } })` returns a row.
  2. Require `caseDocument` unconditionally. Require `patientPassport` per step 1.
  3. One **interactive** `Prisma.$transaction(async (tx) => { ... })`:
     - create the `Case` (+ `patient` connect/create, `attendant`, `agency`,
       `assignedTo`, `CASE_CREATED` event) exactly as today, capturing `case.id`;
     - for each present file: `documentId = crypto.randomUUID()`,
       `fileUrl = await saveDocumentLocal(file.buffer, case.id, documentId,
       file.mimetype)`, `tx.document.create({ data: { id: documentId, caseId:
       case.id, type, fileName: file.originalname, fileUrl, uploadedById: userId
       } })`;
     - re-read and return the case with `CASE_DETAIL_INCLUDE`.
  - On any throw the transaction rolls back; files already written to disk are
    harmless orphans (same convention `documentsService.uploadDocumentForCase`
    already relies on). `saveDocumentLocal` is called inside the transaction
    callback but is not itself transactional — acceptable, matches existing code.
- `updateCase` is unchanged — it stays JSON, does not touch documents.

### `recordFeePayment` — two behaviour changes

- **Attendant-passport gate** (direct only), as above.
- **Lazy visa-app creation** (agency only): the current implementation looks up
  the `VisaApplication` by `visaApplicationId` from the URL. For agency cases the
  frontend will not have one yet. New endpoint shape:
  `POST /api/v1/cases/:id/visa-applications/fee-payment` (no
  `visaApplicationId` segment) with body `{ travelerType, accountId, amount,
  notes? }` — creates the visa app for `travelerType` if absent, then proceeds.
  The existing
  `POST /api/v1/cases/:id/visa-applications/:visaApplicationId/fee-payment`
  stays for direct cases. Both call one shared internal
  `recordFeePayment({ caseId, visaApplicationId?, travelerType?, ... })`.
  - Guard: `travelerType` must be `PATIENT`, or `ATTENDANT` only when
    `kase.attendant` exists.
  - The `@@unique([caseId, travelerType])` constraint on `VisaApplication` makes
    the lazy create idempotent-safe — a duplicate attempt fails cleanly inside
    the transaction.

### Settings (new aggregate)

`Server/Src/{Routes,Controllers,Services}/Settings/settings*.js`

- `GET /api/v1/settings` — `Verify` only. Returns all `AppSetting` rows as a
  `{ key: value }` object.
- `PUT /api/v1/settings` — `RequirePermission("MANAGE_SETTINGS")`. Body:
  `{ [key]: value }` for a whitelisted key set
  (`VISA_FEE_DEFAULT_DIRECT`, `VISA_FEE_DEFAULT_AGENCY` for now). Upserts each;
  rejects unknown keys with `400`. Validates fee values parse as a positive
  number.

### Case detail response

`CASE_DETAIL_INCLUDE.documents` already returns all documents. No include change
needed; the frontend groups by `type` client-side.

## Frontend changes

- **`lib/validations/case.ts`** — passport number/expiry become `.optional()`;
  `buildCaseCreatePayload` no longer used for the network call directly (see
  below).
- **`components/cases/case-form.tsx`** — on create, build a `FormData`: append
  every scalar field, then `patientPassport` / `caseDocument` /
  `attendantPassport` file blobs. New "Documents" card:
  - Patient passport — file input, marked required, hidden/again-optional when a
    searched existing patient already has one on file (call a small
    `GET /api/v1/cases?patientId=…` or reuse patient detail — resolved via the
    patient-search result which will carry a `hasPassportOnFile` boolean added to
    `searchPatients`' select).
  - Case document — file input, marked required.
  - Attendant passport — file input, optional, shown only when "has attendant".
- **New `components/ui/file-field.tsx`** — styled `input[type=file]` wrapper:
  shows filename + human size, a clear button, accept filter matching the server
  whitelist. Reused by Subsystem B later.
- **`services/cases.ts`** — `createCase` sends `FormData` (no explicit
  `Content-Type`; let the browser set the multipart boundary).
- **`services/settings.ts`** (new) — `getSettings()`, `updateSettings(patch)`.
- **`components/cases/fee-payment-dialog.tsx`** — default `amount` from
  `getSettings()` (`VISA_FEE_DEFAULT_AGENCY` / `_DIRECT` by `reachOutType`),
  falling back to `100`/`400` if the fetch fails. When the visa panel signals the
  attendant-passport block, disable submit and show the reason.
- **`components/cases/visa-application-panel.tsx`** — for direct cases with an
  attendant and no attendant-passport document, render a blocking checklist row
  with an "Upload attendant passport" action (opens the existing
  `upload-document-dialog` prefilled to `ATTENDANT_PASSPORT`). For agency cases,
  show "Agency-managed — recording only" helper text and, when no visa app
  exists yet, a "Record fee" action that hits the new no-id endpoint with a
  `travelerType` picker.
- **`components/cases/documents-panel.tsx`** — group by type; "Case document"
  section with a "Replace" action (upload new `CASE_DOCUMENT`); show older
  versions collapsed.
- **`app/dashboard/settings/page.tsx`** — add a "Finance defaults" section with
  the two fee inputs, gated on `MANAGE_SETTINGS` (hide if the user lacks it).

## Backend file map

| File | Change |
| --- | --- |
| `Server/prisma/schema.prisma` | nullable passport cols, `CASE_DOCUMENT`, `AppSetting`, `User.appSettingsUpdated` |
| `Server/prisma/migrations/20260829_case_intake_documents/migration.sql` | new |
| `Server/cmd/Seed/adminSeed.js` | add `MANAGE_SETTINGS` permission; seed `AppSetting` defaults |
| `Server/Src/Routes/Cases/casesRoute.js` | multipart fields on `POST /`; new no-id fee-payment route |
| `Server/Src/Controllers/Cases/casesController.js` | pass `req.files`; new ctrl for no-id fee payment |
| `Server/Src/Services/Cases/casesService.js` | `createCase` doc handling + reuse exception; `isAgencyCase`; agency branches in `respondToInquiry` (skip auto visa apps) and `recordFeePayment` (lazy create, skip attendant gate); attendant-passport gate for direct |
| `Server/Src/Services/Documents/documentsService.js` | add `CASE_DOCUMENT` to `DOCUMENT_TYPES` |
| `Server/Src/{Routes,Controllers,Services}/Settings/*` | new aggregate |
| `Server/Src/Routes/index` (route registration) | mount `/settings` |

## Testing (real-DB Vitest)

New / extended suites, matching the existing `tests/services/*.test.js` style and
`tests/helpers/factories.js`:

- **`tests/services/case-intake-documents.test.js`** (new)
  - create case rejects (400) with no `patientPassport`
  - create case rejects (400) with no `caseDocument`
  - create case succeeds with both; `Document` rows exist with correct types and
    `fileUrl`s
  - reused `patientId` whose prior case has a `PATIENT_PASSPORT` → create
    succeeds without a passport file
  - reused `patientId` with **no** prior passport → still rejected
  - attendant passport omitted at intake → create still succeeds
  - transaction rollback: a forced failure after case create leaves **no** `Case`
    row (documents too)
- **`tests/services/agency-visa-workflow.test.js`** (new)
  - agency case: inquiry `ACCEPTED` creates **zero** `VisaApplication` rows
  - agency case: no-id fee payment with `travelerType: PATIENT` creates the visa
    app and the `Payment` + `AccountTransaction`
  - agency case with attendant + no attendant passport: fee payment **succeeds**
    (no gate)
  - agency case: embassy visit before fee payment still rejected (ordering kept)
  - direct case: inquiry `ACCEPTED` still auto-creates visa apps (regression)
- **`tests/services/attendant-passport-gate.test.js`** (new)
  - direct case with attendant, no attendant passport → `recordFeePayment` 400
  - upload `ATTENDANT_PASSPORT`, retry → succeeds
  - direct case with **no** attendant → unaffected
- **`tests/services/app-settings.test.js`** (new)
  - `GET` returns seeded `VISA_FEE_DEFAULT_DIRECT`/`_AGENCY`
  - `PUT` with `MANAGE_SETTINGS` updates; reflected on next `GET`
  - `PUT` without the permission → 403
  - `PUT` unknown key → 400; non-numeric fee → 400
- **`tests/helpers/factories.js`** — `createCase` factory makes passport fields
  optional and can attach documents; add `attachDocument(caseId, type)` helper.

## Out of scope (this spec)

- Hospital `country`, multi-hospital "sent to N hospitals" framing, and
  per-inquiry evaluation/invitation documents — **Subsystem B**.
- Embassy-visit commission, revenue register, debts owed to lenders, customer
  payables — **Subsystem C**.
- Dashboard KPI/chart redesign — **Subsystem D**.
- A general settings UI beyond the two fee fields — only what the fee default
  needs now.
- Migrating existing `100`/`400` literals anywhere other than the fee dialog.
- OCR / auto-extracting passport number + expiry from the uploaded image — the
  typed fields stay manual.
- Per-document access control changes — existing `/uploads` + `Verify` gating is
  unchanged.
