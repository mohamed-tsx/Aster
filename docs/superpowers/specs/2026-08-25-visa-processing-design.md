# Visa Processing & Fee Payment Design

## Overview

The Cases module (merged) gets a case from intake through `HOSPITAL_ACCEPTED`. The
domain schema already models what comes next — `VisaApplication` (one per traveler:
patient, plus attendant if present) and `Document` (file attachments) — but no API,
service, or frontend exists for either yet, and no code ever creates a `VisaApplication`
row. This spec designs that: the visa-registration fee payment flow (which needs the
`Account`/`AccountTransaction` ledger from the prior schema amendment) through to a
visa outcome, plus document upload/download/delete.

This is a **behavior-only spec — no schema changes.** Every model/field this spec
needs (`VisaApplication`, `Document`, `Payment.visaApplicationId`,
`Case.status`'s `VISA_PROCESSING`/`COMPLETED` values) already exists from the domain
schema foundation plan. This is the same shape as the original Cases module spec:
designing routes/services/frontend over an already-migrated schema.

One exception: `recordFeePayment` needs an `Account` to pick from, and nothing
anywhere lets you create or list one yet (the accounts ledger schema landed with no
API/UI at all). This spec therefore also includes a **minimal** Account
create-and-list slice — just enough to bootstrap and pick accounts, not the full
catalog CRUD (edit, deactivate) a later Finance module spec will still need to add.

Embassy-commission `Expense`, general company expenses, `Refund` issuance, and full
`Account` catalog management (edit, deactivate) are explicitly out of scope — a later
Finance module spec, per the roadmap both the domain schema spec and the accounts
ledger spec already lay out.

## Business rules captured

- **One `VisaApplication` per traveler, auto-created on hospital acceptance.** The
  instant `respondToInquiry`'s `ACCEPTED` branch sets `Case.status → HOSPITAL_ACCEPTED`,
  the same transaction creates a `VisaApplication` (status `PENDING`) for the patient,
  plus one more for the attendant if the case has one. No separate "start visa
  process" action — matches the existing auto-status-transition pattern (`sendInquiry`/
  `respondToInquiry`/`cancelCase` already never let a client set `status` directly).
- **Closing a real gap the Cases module deferred:** `sendInquiry` currently only blocks
  sending a new inquiry when `Case.status === "CANCELLED"`. Once a case reaches
  `HOSPITAL_ACCEPTED` (and its `VisaApplication`s exist), a second accepted inquiry
  would attempt to create duplicate `VisaApplication` rows and crash on the
  `@@unique([caseId, travelerType])` constraint — a 500, not a clean rejection. This
  spec closes that gap: `sendInquiry` only allows sending when `Case.status` is `NEW`,
  `HOSPITAL_MATCHING`, or `HOSPITAL_DECLINED`.
- **Visa-registration fee is $400 (`DIRECT`) / $100 (`AGENCY`), always `USD`, per
  traveler** — a fixed business rule from the original domain schema spec. The fee
  form defaults to the calculated amount but is editable (for discounts/partial
  payments); currency is never a form field — the server always writes `USD` for a fee
  payment, regardless of client input, since the business rule fixes it.
- **`VisaApplication.status` flow is strictly sequential and each step rejects out of
  order:** `PENDING` → (fee paid) → `FEE_PAID` → (embassy visited) →
  `EMBASSY_VISITED` → (outcome recorded) → `APPROVED`/`REJECTED`. You can't mark an
  embassy visit before the fee is paid, and you can't record an outcome before the
  embassy visit.
- **Recording the fee payment is what drives `Case.status → VISA_PROCESSING`** — not
  `VisaApplication` creation itself. A case sits at `HOSPITAL_ACCEPTED` with pending
  visa applications until the *first* fee payment (for either traveler) is recorded,
  at which point the case moves to `VISA_PROCESSING`. Only the transition into
  `VISA_PROCESSING` needs this "first payment" check — the case never moves back out
  of it via this mechanism.
- **`Case.status → COMPLETED` once every traveler reaches a terminal outcome.** After
  each `recordVisaOutcome` call, if every one of the case's `VisaApplication`s is now
  `APPROVED` or `REJECTED` (none left in `PENDING`/`FEE_PAID`/`EMBASSY_VISITED`), the
  case moves to `COMPLETED` in the same transaction. "Completed" means the process
  concluded, not that every traveler succeeded — a case with one rejected traveler and
  one approved traveler still reaches `COMPLETED` once both are terminal.
- **Every fee payment writes a paired ledger entry.** `recordFeePayment` creates the
  `Payment` and its `AccountTransaction` (`PAYMENT_RECEIVED`) in one
  `Prisma.$transaction`, following the exact pattern the accounts ledger spec
  described and the Cases module already uses for `sendInquiry`/`respondToInquiry`
  (multiple writes, one atomic unit).
- **Documents are immutable once uploaded** (matches the schema — no `updatedAt` on
  `Document`). There's no replace/update endpoint; replacing a document means
  deleting the old one and uploading a new one.
- **Documents accept images and common office-document formats.** JPG/PNG/WEBP, PDF,
  and Word (`.doc`/`.docx`), 50MB per file — wider than the existing avatar uploader
  (JPG/PNG/WEBP, 5MB), since invitation letters and visa copies are typically PDFs or
  Word documents, not photos.

## API surface

All new endpoints are gated by `Verify` (login required), matching every existing
route in this codebase.

### VisaApplication actions (extend the existing Cases aggregate)

- `POST /api/v1/cases/:id/visa-applications/:visaApplicationId/fee-payment` —
  `RequirePermission("MANAGE_FINANCE")`. Body: `{ accountId, amount, notes? }`.
  Rejects (400) unless the `VisaApplication` is `PENDING`. Creates `Payment` +
  `AccountTransaction` + updates `VisaApplication.status` to `FEE_PAID` +
  conditionally updates `Case.status` to `VISA_PROCESSING`, all in one transaction.
- `PATCH /api/v1/cases/:id/visa-applications/:visaApplicationId/embassy-visit` —
  `RequirePermission("UPDATE_CASES")`. Body: `{ embassyVisitDate, notes? }`. Rejects
  (400) unless `FEE_PAID`.
- `PATCH /api/v1/cases/:id/visa-applications/:visaApplicationId/outcome` —
  `RequirePermission("UPDATE_CASES")`. Body:
  `{ status: "APPROVED" | "REJECTED", visaNumber?, notes? }`. Rejects (400) unless
  `EMBASSY_VISITED`; `visaNumber` required when `status` is `APPROVED`. Conditionally
  updates `Case.status` to `COMPLETED` in the same transaction.

### `sendInquiry` guard fix (modify existing Cases behavior)

- `sendInquiry`'s existing "case not `CANCELLED`" guard is replaced with an allow-list:
  only `NEW`, `HOSPITAL_MATCHING`, `HOSPITAL_DECLINED` may send a new inquiry.

### Case detail response (extend existing `getCaseById`)

- `CASE_DETAIL_INCLUDE` gains `visaApplications: { include: { payment: true } }` and
  `documents: true`, so the case detail page can render both without new endpoints.

### Documents (new aggregate)

- `POST /api/v1/cases/:caseId/documents` — `RequirePermission("UPDATE_CASES")`,
  `multipart/form-data` (one file field + a `type` field from `DocumentType`).
  Validates mimetype (JPG/PNG/WEBP/PDF/DOC/DOCX) and size (50MB) via Multer, writes
  the file to local disk, creates the `Document` row.
- `DELETE /api/v1/cases/:caseId/documents/:id` — `RequirePermission("DELETE_CASES")`
  (this permission's first real use — previously seeded but unused). Deletes the DB
  row and best-effort deletes the underlying file (ignore cleanup errors, matching
  `saveAvatarLocal`'s existing pattern).

No separate list/get endpoint for documents — they ride along on case detail.

### Accounts (new, minimal — create and list only)

- `GET /api/v1/accounts` — `RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE"])`,
  matching the existing `RequireAnyPermission` pattern already used for the Cases
  module's patient search. Anyone who can record a fee payment needs to be able to
  list accounts to pick from, even without `MANAGE_ACCOUNTS` itself. Returns active
  accounts by default (`isActive: true`); no pagination needed at this scale (a
  company has a handful of bank/cash accounts, not thousands).
- `POST /api/v1/accounts` — `RequirePermission("MANAGE_ACCOUNTS")`. Body:
  `{ name, type, notes?, openingBalances?: [{ currency, amount }] }`. Creates the
  `Account`, then — for each entry in `openingBalances` (if any) — an
  `OPENING_BALANCE` `AccountTransaction` in the same transaction (`createdById` from
  the logged-in user, `occurredAt` defaulting to now).
- No `PATCH`/deactivate/delete endpoint yet — editing an account's name/type, or
  toggling `isActive`, is deferred to the Finance module spec alongside the rest of
  full catalog management.
- Minimal frontend: an `/dashboard/accounts` list page (name, type, per-currency
  balance derived from `AccountTransaction`) and a "new account" form, following the
  same list/create shape as the existing Hospitals/Agencies catalogs — no edit page
  yet, matching the backend's create-and-list-only scope.

## Design notes / rationale

- **No new permissions.** `MANAGE_FINANCE`, `UPDATE_CASES`, `DELETE_CASES` all already
  exist (the latter seeded-but-unused until now). `recordFeePayment` is gated by
  `MANAGE_FINANCE` rather than `UPDATE_CASES` because it's fundamentally a financial
  action — matches the original domain schema spec's intent for that permission
  ("record payments/expenses").
- **`VisaApplication` status actions extend the existing Cases files
  (`Server/Src/{Routes,Controllers,Services}/Cases/cases*.js`)** rather than a new
  aggregate — they're pure case-status mutations with the identical shape as the
  already-implemented `sendInquiry`/`respondToInquiry`/`cancelCase`. Matches how the
  Cases module plan itself folded `HospitalInquiry` actions into these same three
  files rather than creating a separate aggregate for them.
- **Documents get their own new aggregate**
  (`Server/Src/{Routes,Controllers,Services}/Documents/documents*.js` +
  `Server/Src/Middlewares/Multer/uploadDocument.js` +
  `Server/Src/Utils/Documents/saveDocumentLocal.js`) because file I/O is a genuinely
  distinct responsibility from case-status mutations, unlike the VisaApplication
  actions above. Keeps `casesService.js` from growing to cover an unrelated concern.
- **`saveDocumentLocal` generalizes `saveAvatarLocal`'s local-disk pattern** but drops
  the avatar-specific behavior (image resizing via `sharp`, overwrite-in-place) —
  documents are stored as-is (any of the 5 allowed formats) at
  `uploads/documents/<caseId>/<documentId>.<ext>`, one file per upload, never
  overwritten. Served by the existing `/uploads` static route (already gated by
  `Verify`, no route changes needed).
- **Fee currency is hardcoded server-side, not a client-supplied field.** Even though
  `Account`s can hold multiple currencies, the visa-registration fee is definitionally
  USD (a fixed business rule) — accepting a currency field from the client would let a
  buggy or malicious request record a fee in the wrong currency with no schema-level
  guard against it (this exact risk was flagged as a deferred concern in the accounts
  ledger spec's final review). Hardcoding it server-side closes that specific gap for
  this one call site, rather than waiting on the more general validation-helper the
  accounts spec deferred to "whenever Finance is built" — which is now.
- **`recordFeePayment`'s `Case.status → VISA_PROCESSING` transition is conditional on
  "is this the case's first fee payment"** (checked by querying whether any sibling
  `VisaApplication` for the same case already has a `Payment`), not unconditional on
  every fee payment — the case should only make this transition once, when the visa
  process genuinely starts moving, not re-trigger (harmlessly, but pointlessly) on the
  second traveler's fee payment.
- **`recordVisaOutcome`'s `Case.status → COMPLETED` transition checks all sibling
  `VisaApplication`s**, not just the one being updated — a case with two travelers
  only completes once both are terminal, so the check re-queries the case's full
  `VisaApplication` list inside the same transaction after applying the current
  update.
- **One `getAccountBalances(accountId)` function is the only place balance is
  computed**, built on one exported `CREDIT_TYPES`/`DEBIT_TYPES` constant pair (per
  the accounts ledger spec's final-review recommendation that a single such constant
  should exist rather than the credit/debit mapping living only as prose). Two
  `Prisma.accountTransaction.groupBy({ by: ["currency"], where: { accountId, type: {
  in: CREDIT_TYPES | DEBIT_TYPES } }, _sum: { amount: true } })` calls (one per type
  set — a single `groupBy` can't net two directions of the same summed column) are
  merged per-currency into `credits - debits`. The account list page and (later) the
  Finance module's account detail view both call this one function — exactly the
  single-balance-computation-site the accounts ledger spec's final review recommended
  as a requirement for "whoever builds the Finance module next." This is that.

## Out of scope (for this spec)

- Embassy-commission `Expense` recording, general company expenses, and `Refund`
  issuance — a later Finance module spec, per the existing roadmap.
- Full `Account` catalog management: editing an account's name/type, and
  deactivating one (`isActive`) — this spec only adds create-and-list. The Finance
  module spec should add the rest.
- A "start visa process" manual action — auto-creation on hospital acceptance covers
  this per the brainstorming decision above.
- Any case-level reporting/dashboard over `VisaApplication`/`Payment` data — this spec
  only adds the write paths and the case-detail read path, not aggregate views.
- Re-sending a hospital inquiry after a case reaches `HOSPITAL_ACCEPTED` or beyond —
  closed off by the `sendInquiry` guard fix above, intentionally, not a gap to
  reopen later without a deliberate decision.
