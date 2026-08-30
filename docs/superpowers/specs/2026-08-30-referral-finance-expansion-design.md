# Referral & Finance Expansion — Design Spec

**Date:** 2026-08-30
**Subsystem:** B + C combined (of the A/B/C/D decomposition)
**Depends on:** Subsystem A (Case Intake & Documents), merged to `main` at `f5e849a`.
**Status:** approved design — pending implementation plan.

---

## 1. Context & Scope

Aster is a hospital group operating in 5+ countries; this system runs its
East-Africa referral center, which routes local patients to Aster (and
occasionally external) hospitals abroad, then shepherds them through visa
processing.

This spec covers two halves, built in one spec/plan/review cycle:

- **Part B — Multi-hospital referral.** A case is shopped to several hospitals
  (possibly in different countries). Aster collects the replies off-system,
  picks the best one, and *records that single chosen response* — which is
  what advances the case. The list of every hospital contacted is retained.
- **Part C — Finance expansion.** Beyond the existing visa-fee `Payment` /
  `Expense` / `Refund` / ledger machinery, add: a **revenue register** (non-fee
  income), **loans** from lenders (with terms, repayments, computed balances),
  a **payables register** (money owed out, settled from an account), and
  **embassy-partnership commission** captured as an expense per embassy visit.

Both halves post through the existing `Account` / `AccountTransaction` ledger
so account balances and the current dashboard finance tile keep working.

**Not in this spec:** the dashboard redesign (Subsystem D). One small
extension to `getFinanceStats` (outstanding loans + payables totals) is
included so the numbers exist; the visual redesign is D's job.

---

## 2. Part B — Multi-hospital referral

### 2.1 Schema changes

**`Hospital`**
- `+ country String` — required. Migration backfills existing rows to
  `"Unknown"`; staff corrects via the existing hospital edit UI.
- `listHospitals`, `createHospital`, `updateHospital` carry `country` through;
  create requires it, update allows changing it.

**`HospitalInquiry`**
- `+ isChosen Boolean @default(false)` — at most one `true` per case; enforced
  in the service (no DB partial-unique constraint, to keep the migration
  portable).
- `treatmentCostEstimate` / `currency` already exist — now populated by the
  record-response action rather than the old respond action.

**`Document`**
- `+ hospitalInquiryId String?` (+ relation `HospitalInquiry.documents
  Document[]`). A document is now either case-scoped (`hospitalInquiryId`
  null, as today) or inquiry-scoped.
- `saveDocumentLocal` path is unchanged (still `uploads/documents/<caseId>/…`;
  inquiry docs live under their case).

**Enums**
- `DocumentType + EVALUATION_DOC` (after `CASE_DOCUMENT`). `INVITATION_LETTER`
  already exists and is reused for the invitation.
- `HospitalInquiryStatus + NOT_SELECTED` — Aster did not pick this hospital,
  distinct from `DECLINED` (the hospital refused).
- `CaseEventType + HOSPITAL_CHOSEN`, `+ HOSPITAL_CHANGED`.

### 2.2 Flow & services (`casesService.js`)

1. **`sendInquiry(caseId, { hospitalId, notes }, userId)`** — unchanged.
   Creates a `PENDING` inquiry. Multiple allowed. First one moves the case
   `NEW → HOSPITAL_MATCHING` (already the behaviour). `SENDABLE_CASE_STATUSES`
   unchanged (`NEW`, `HOSPITAL_MATCHING`, `HOSPITAL_DECLINED`).

2. **`recordChosenResponse(caseId, inquiryId, data, files, userId)`** — NEW.
   The case-advancing trigger. Multipart.
   - `data`: `{ treatmentCostEstimate, currency, notes? }` —
     `treatmentCostEstimate` and `currency` required; `currency` must be a
     valid `Currency`.
   - `files`: `{ evaluationDoc, invitationLetter }` — **both required**
     (Multer `.fields()`; reuses Subsystem A's `uploadDocument` middleware +
     `saveDocumentLocal`).
   - Pre-write validation (all before any write):
     - case exists and is not `CANCELLED`
     - the inquiry belongs to the case and is `PENDING`
     - no inquiry on the case is already `isChosen` (use
       `changeChosenHospital` for that)
   - In one `$transaction` (`{ timeout: 30000 }`, per Subsystem A's precedent
     for doc-writing transactions):
     - set the chosen inquiry: `status = ACCEPTED`, `isChosen = true`,
       `treatmentCostEstimate`, `currency`, `respondedAt = now`
     - set every other `PENDING` inquiry on the case to `NOT_SELECTED`
     - write the two `Document` rows (`EVALUATION_DOC`, `INVITATION_LETTER`),
       `hospitalInquiryId` set, `caseId` set, `uploadedById = userId`
     - move the case `→ HOSPITAL_ACCEPTED`
     - auto-create the visa applications — **identical logic to today's
       `respondToInquiry` ACCEPTED branch**, including the
       `!isAgencyCase(kase)` skip from Subsystem A (agency cases get zero
       auto-created visa apps; direct get PATIENT + ATTENDANT-if-present)
     - `CaseEvent`: `CASE_STATUS_CHANGED → HOSPITAL_ACCEPTED` and
       `HOSPITAL_CHOSEN` (with `inquiryId`)
   - Returns the case with the standard detail include.

3. **`respondToInquiry(caseId, inquiryId, data, userId)`** — NARROWED.
   Now only records a **`DECLINED`** outcome (hospital refused) with an
   optional note. It no longer accepts `status: "ACCEPTED"` (returns 400) and
   no longer changes case status or creates visa apps.
   - **Migration cost the plan must budget for:** Subsystem A's suites drive
     the current ACCEPTED path via `respondToInquiry(..., { status:
     "ACCEPTED" }, ...)` and via `sendInquiry` + accept
     (`agency-visa-workflow.test.js`, `attendant-passport-gate.test.js`,
     `case-intake-documents.test.js`, `case-events.test.js`,
     `case-timeline.test.js`). Every one of those call sites moves to a
     `recordChosenResponse` helper (a factory that sends an inquiry, then
     records the response with `caseIntakeFiles()`-style stub docs). Add a
     `recordChosenResponse` test factory alongside the existing helpers.

4. **`changeChosenHospital(caseId, newInquiryId, data, files, userId)`** — NEW.
   - Allowed only while **no `Payment` exists** on any of the case's visa
     applications (`Prisma.payment.findFirst({ where: { visaApplication: {
     caseId } } })` is null). Otherwise 400
     `"The hospital cannot be changed after a visa fee has been paid"`.
   - `newInquiryId` must be a `PENDING` or `NOT_SELECTED` inquiry on the case
     (not the current chosen one, not `DECLINED`).
   - In one `$transaction`:
     - current chosen inquiry → `status = NOT_SELECTED`, `isChosen = false`
       (its documents are kept for the record)
     - new inquiry → `ACCEPTED`, `isChosen = true`, cost/currency, its two
       documents written
     - visa applications are **left as-is** (already created; travelers
       unchanged)
     - case status stays `HOSPITAL_ACCEPTED` (or whatever it has progressed
       to)
     - `CaseEvent`: `HOSPITAL_CHANGED` (with the new `inquiryId`)

5. **`getCaseById` / detail include** — inquiries now include `hospital`
   (with `country`), `isChosen`, `status`, `treatmentCostEstimate`,
   `currency`, and inquiry-scoped `documents`.

### 2.3 HTTP

- `POST   /cases/:id/inquiries` — unchanged (`sendInquiry`).
- `POST   /cases/:id/inquiries/:inquiryId/response` — NEW,
  `RECORD_HOSPITAL_RESPONSE`, multipart (`recordChosenResponse`).
- `PATCH  /cases/:id/inquiries/:inquiryId/decline` — `respondToInquiry` in its
  narrowed decline-only form (`UPDATE_CASES`). (Or keep the existing route
  shape and reject `ACCEPTED` in the body — implementer's call, note it in
  the plan.)
- `POST   /cases/:id/chosen-hospital` — NEW, `RECORD_HOSPITAL_RESPONSE`,
  multipart (`changeChosenHospital`).

---

## 3. Part C — Finance expansion

All amounts `Decimal(12,2)`; all money models carry `currency Currency`.
All "record" actions that move money post exactly one `AccountTransaction`
in the same `$transaction` as the domain row, mirroring the existing
`Payment` / `Expense` / `Refund` pattern.

### 3.1 Ledger / enum changes (shared)

**`AccountTransactionType`** gains:
- `REVENUE_RECEIVED` (credit)
- `LOAN_RECEIVED` (credit)
- `LOAN_REPAYMENT` (debit)
- `PAYABLE_SETTLED` (debit)

**`accountsService.js`**
- `CREDIT_TYPES += ["REVENUE_RECEIVED", "LOAN_RECEIVED"]`
- `DEBIT_TYPES  += ["LOAN_REPAYMENT", "PAYABLE_SETTLED"]`
- `getAccountBalances`, `listAccountTransactions`, `listAllAccountTransactions`
  need no other change — they already fold every transaction type by
  credit/debit.

**`AccountTransaction`** gains nullable unique FKs so each ledger row can
point back at its source (same shape as the existing `paymentId` /
`expenseId` / `refundId`):
- `revenueId String? @unique`
- `loanId String? @unique`
- `loanRepaymentId String? @unique`
- `payableId String? @unique`

### 3.2 C1 · Revenue register

**Model `Revenue`**
```
id            String   @id @default(cuid())
category      RevenueCategory
amount        Decimal  @db.Decimal(12,2)
currency      Currency
description   String?
receivedOn    DateTime
caseId        String?          // referral commission is usually case-linked
case          Case?   @relation(...)
accountId     String           // where it landed
account       Account @relation(...)
recordedById  String
recordedBy    User    @relation(...)
accountTransaction AccountTransaction?
createdAt     DateTime @default(now())
```
**Enum `RevenueCategory`**: `HOSPITAL_REFERRAL_COMMISSION`, `OTHER_INCOME`.

**Service `revenueService.js`**
- `createRevenue(data, userId)` — validates category, positive amount, valid
  currency, account exists & active, `caseId` (if given) exists. In one
  `$transaction`: create `Revenue` + a credit `AccountTransaction`
  (`REVENUE_RECEIVED`, `revenueId` set).
- `listRevenue({ page, limit, caseId, category })` — paginated, newest first,
  includes `case` summary + `account` name + `recordedBy`.

**HTTP** (`/revenue`, `MANAGE_REVENUE`): `POST /`, `GET /`.

The UI create form, when `category = HOSPITAL_REFERRAL_COMMISSION` and a case
is selected, shows a read-only helper "chosen hospital estimate:
`<treatmentCostEstimate> <currency>`" and a "% of estimate" convenience input
that fills `amount` — but the stored value is whatever staff submits.

### 3.3 C2 · Loans & repayments

**Model `Loan`**
```
id             String   @id @default(cuid())
lenderName     String
principal      Decimal  @db.Decimal(12,2)
currency       Currency
interestRatePct Decimal @db.Decimal(6,3)   // annual %, e.g. 12.5
interestMethod LoanInterestMethod
disbursedOn    DateTime
termMonths     Int
dueOn          DateTime                    // derived = disbursedOn + termMonths, stored
status         LoanStatus @default(ACTIVE)
notes          String?
accountId      String                      // where the principal landed
account        Account  @relation(...)
recordedById   String
recordedBy     User     @relation(...)
repayments     LoanRepayment[]
accountTransaction AccountTransaction?      // the LOAN_RECEIVED credit
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
```
**Enum `LoanInterestMethod`**: `SIMPLE`, `COMPOUND_MONTHLY`.
**Enum `LoanStatus`**: `ACTIVE`, `SETTLED`.

**Model `LoanRepayment`**
```
id           String   @id @default(cuid())
loanId       String
loan         Loan     @relation(...)
amount       Decimal  @db.Decimal(12,2)
paidOn       DateTime
accountId    String                        // paid from
account      Account  @relation(...)
recordedById String
recordedBy   User     @relation(...)
accountTransaction AccountTransaction?      // the LOAN_REPAYMENT debit
createdAt    DateTime @default(now())
```

**Service `loansService.js`**
- `createLoan(data, userId)` — validates fields, computes+stores `dueOn`. In
  one `$transaction`: `Loan` + credit `AccountTransaction` (`LOAN_RECEIVED`).
- `recordLoanRepayment(loanId, data, userId)` — validates the loan is
  `ACTIVE`, positive amount, account exists. In one `$transaction`:
  `LoanRepayment` + debit `AccountTransaction` (`LOAN_REPAYMENT`). After
  commit, recompute the outstanding balance as of `paidOn`; if `<= 0`, set
  `Loan.status = SETTLED`.
- `listLoans({ page, limit, status })` and `getLoanById(id)` — the detail
  view returns the loan, its repayments, and the **computed projection**.

**Computed projection — `loanProjection(loan, repayments, asOf = now)`**
(pure function, unit-tested, no DB):
- `elapsedYears = (asOf - disbursedOn) / year`, clamped to `[0, termMonths/12]`
  (interest stops accruing after the term).
- `SIMPLE`: `accruedInterest = principal × rate × elapsedYears`
- `COMPOUND_MONTHLY`: `months = floor(elapsedMonths)`, clamped to `termMonths`;
  `balanceWithInterest = principal × (1 + rate/12)^months`;
  `accruedInterest = balanceWithInterest − principal`
- `totalRepaid = Σ repayments.amount`
- `outstanding = max(0, principal + accruedInterest − totalRepaid)`
- returns `{ accruedInterest, totalRepaid, outstanding, isOverdue: asOf >
  dueOn && outstanding > 0 }`
- Money math uses a decimal-safe representation (the repo already uses
  `Decimal` columns and `Number()` coercion in services — follow the
  existing convention; round to 2dp on output).

**HTTP** (`/loans`, `MANAGE_LOANS`): `POST /`, `GET /`, `GET /:id`,
`POST /:id/repayments`.

### 3.4 C3 · Payables register

**Model `Payable`**
```
id           String   @id @default(cuid())
payeeName    String                        // free text
caseId       String?                       // optional link
case         Case?    @relation(...)
amount       Decimal  @db.Decimal(12,2)
currency     Currency
reason       String
raisedOn     DateTime
status       PayableStatus @default(OUTSTANDING)
settledOn    DateTime?
recordedById String
recordedBy   User     @relation(...)
accountTransaction AccountTransaction?      // the PAYABLE_SETTLED debit
createdAt    DateTime @default(now())
updatedAt    DateTime @updatedAt
```
**Enum `PayableStatus`**: `OUTSTANDING`, `SETTLED`.

**Service `payablesService.js`**
- `createPayable(data, userId)` — validates payeeName, positive amount,
  currency, reason, `caseId` (if given) exists. Creates the row only (no
  ledger movement yet — nothing has been paid).
- `settlePayable(id, { accountId, paidOn }, userId)` — validates the payable
  is `OUTSTANDING`, account exists. In one `$transaction`: debit
  `AccountTransaction` (`PAYABLE_SETTLED`, `payableId` set) + set
  `status = SETTLED`, `settledOn`. Full settlement only (no partials).
- `listPayables({ page, limit, status, caseId })`.

**HTTP** (`/payables`, `MANAGE_PAYABLES`): `POST /`, `GET /`,
`POST /:id/settle`.

### 3.5 C4 · Embassy-partnership commission

No new model. Reuses `Expense` (which already has `visaApplicationId` and
`accountTransaction`).

- Well-known category constant `EMBASSY_PARTNERSHIP_COMMISSION` (exported from
  `expensesService.js` alongside any existing category constants).
- Settings key `EMBASSY_COMMISSION_DEFAULT` (added to `SETTING_DEFAULTS`,
  string, e.g. `"0"`), surfaced in the finance-defaults settings form.
- `markEmbassyVisited(caseId, visaApplicationId, data, userId)` gains optional
  `data.partnerCommission` `{ amount, accountId }`. When present, the same
  `$transaction` that flips the visa app to `EMBASSY_VISITED` also creates an
  `Expense` (category `EMBASSY_PARTNERSHIP_COMMISSION`, `visaApplicationId`
  set, `caseId` set) + its debit `AccountTransaction` (`EXPENSE_PAID`). When
  absent, behaviour is exactly as today.
- Validation: if `partnerCommission` present, `amount` positive and `accountId`
  valid, else 400 — checked before the transaction.

### 3.6 Dashboard stat extension

`getFinanceStats` gains (additive, no shape break):
- `outstandingLoans` — Σ `loanProjection(...).outstanding` over `ACTIVE`
  loans, grouped by currency.
- `outstandingPayables` — Σ `amount` over `OUTSTANDING` payables, grouped by
  currency.

---

## 4. Permissions

Four new permissions, added to `caseManagementPermissions` in `adminSeed.js`
(so the ADMIN role gets them) and to the RBAC checks:

| Permission | Gates |
|---|---|
| `RECORD_HOSPITAL_RESPONSE` | `recordChosenResponse`, `changeChosenHospital` |
| `MANAGE_REVENUE` | `/revenue` create + list |
| `MANAGE_LOANS` | `/loans` create, list, detail, repayments |
| `MANAGE_PAYABLES` | `/payables` create, list, settle |

`VIEW_FINANCE` (existing) also grants read on the three new list endpoints
(revenue / loans / payables) — use `RequireAnyPermission(["VIEW_FINANCE",
"MANAGE_X"])` on the `GET` routes, mirroring how existing finance reads work.
Embassy commission needs no new permission (it rides `markEmbassyVisited`,
already `UPDATE_CASES`).

---

## 5. Frontend

Follows existing patterns: list page (table + filters + pagination) + a
create dialog + row actions, exactly like the current expenses / accounts
pages. shadcn/ui, react-hook-form + zod, axios via `utils/api.ts`,
`useRBAC()`, `useToast()`.

**Part B — case detail**
- The hospital-inquiry panel becomes a full list: every hospital contacted,
  its country, status badge (`PENDING` / `ACCEPTED` / `DECLINED` /
  `NOT_SELECTED`), cost estimate. The chosen inquiry is highlighted and its
  evaluation doc + invitation letter are shown (download links, reusing the
  documents-panel row style).
- "Record chosen response" action on a `PENDING` inquiry → multipart dialog
  (cost, currency, two `FileField` uploads — the component from Subsystem A).
- "Mark declined" action on a `PENDING` inquiry (note field).
- "Change chosen hospital" action (shown only while no fee paid) → same
  multipart dialog against a different inquiry.
- Hospital create/edit forms gain a required `country` field.

**Part C — new pages** under the existing finance area:
- **Revenue** — list + create dialog (category, amount, currency, account,
  date, optional case, description; the % helper for referral commission).
- **Loans** — list (lender, principal, outstanding, status, due date) →
  detail page (terms, computed accrued interest / outstanding / overdue
  flag, repayment log, "record repayment" dialog). "New loan" dialog.
- **Payables** — list (payee, amount, reason, status, raised date) + "New
  payable" dialog + "Settle" row action (account + paid date).

**Part C — visa panel**
- The "Mark embassy visited" dialog gains an optional "partner commission"
  section (amount prefilled from `EMBASSY_COMMISSION_DEFAULT`, account
  select). Leaving amount blank/zero records no commission.

**Services** (`aster/services/`): `revenue.ts`, `loans.ts`, `payables.ts`,
plus additions to `cases.ts` (`recordChosenResponse`, `changeChosenHospital`,
`declineInquiry`) and `hospitals.ts` (`country`).

**Types**: `HospitalInquiry` gains `isChosen`, `hospital.country`,
`documents`; new `Revenue`, `Loan`, `LoanRepayment`, `Payable` types +
their enums; `DocumentType` gains `EVALUATION_DOC`.

---

## 6. Testing

Real-Postgres integration tests, existing convention (`Server/tests/`,
`_test` DB, factory helpers, no mocked Prisma). New/changed suites:

- **Part B**
  - `recordChosenResponse`: chosen inquiry set + others `NOT_SELECTED`; two
    documents written inquiry-scoped; case → `HOSPITAL_ACCEPTED`; visa apps
    created (direct) / not created (agency); rejects a second call when one
    inquiry is already chosen; rejects on `CANCELLED` case; rejects missing
    files.
  - `respondToInquiry` narrowed: rejects `ACCEPTED`; still records `DECLINED`.
  - `changeChosenHospital`: re-points chosen, keeps visa apps, `NOT_SELECTED`
    the old one; rejects after a `Payment` exists.
  - `Hospital.country` required on create; backfill migration leaves existing
    rows valid.
- **Part C**
  - `createRevenue` — row + credit `AccountTransaction`; balance moves; bad
    account / bad currency / negative rejected.
  - `loanProjection` — **pure-function unit tests**: `SIMPLE` and
    `COMPOUND_MONTHLY` at 0 / mid-term / past-term; repayments reduce
    outstanding; `isOverdue`.
  - `createLoan` / `recordLoanRepayment` — rows + ledger; auto-`SETTLED` when
    outstanding hits 0; repayment on a `SETTLED` loan rejected.
  - `createPayable` (no ledger movement) / `settlePayable` (debit + status);
    double-settle rejected.
  - `markEmbassyVisited` with `partnerCommission` — `Expense` +
    `AccountTransaction` created in the same tx; without it — unchanged.
  - `getAccountBalances` folds the four new transaction types with the right
    sign.

---

## 7. Migration

Single additive migration:
- `ALTER TABLE "Hospital" ADD COLUMN "country" TEXT NOT NULL DEFAULT
  'Unknown'` then `ALTER COLUMN … DROP DEFAULT` (so new rows must supply it
  but existing rows are valid).
- `ADD COLUMN "isChosen" BOOLEAN NOT NULL DEFAULT false` on `HospitalInquiry`.
- `ADD COLUMN "hospitalInquiryId" TEXT` on `Document` + FK
  (`ON DELETE SET NULL`).
- New enum values (`ADD VALUE`): `DocumentType.EVALUATION_DOC`,
  `HospitalInquiryStatus.NOT_SELECTED`, `CaseEventType.HOSPITAL_CHOSEN`,
  `CaseEventType.HOSPITAL_CHANGED`, and the four `AccountTransactionType`
  values.
- New tables: `Revenue`, `Loan`, `LoanRepayment`, `Payable`.
- New enums: `RevenueCategory`, `LoanInterestMethod`, `LoanStatus`,
  `PayableStatus`.
- New nullable unique FK columns on `AccountTransaction` (`revenueId`,
  `loanId`, `loanRepaymentId`, `payableId`) + FKs (`ON DELETE RESTRICT`,
  matching the existing `paymentId`/`expenseId`/`refundId`).
- `AppSetting`: seed `EMBASSY_COMMISSION_DEFAULT = "0"` (idempotent upsert in
  the seed; not a migration row — same approach as Subsystem A's
  `SETTING_DEFAULTS`).

Enum `ADD VALUE` + other DDL in one migration file is fine on the team's
PG14+ (Subsystem A set this precedent).

Non-destructive; safe to run forward on a populated DB. Reverting past it
would drop the new tables and columns — note in the deploy runbook.

---

## 8. Out of Scope / Deferred

- Dashboard visual redesign (Subsystem D). Only the `getFinanceStats`
  number extension is here.
- Partial loan repayments split into principal vs interest — repayments are
  plain amounts; the projection derives the split implicitly.
- Partial payable settlement — settle in full only.
- Loan amortization schedules / per-installment due tracking — only a single
  `dueOn` and on-read accrual.
- Multi-currency conversion — each entity keeps its own currency; no FX.
- Automatic referral-commission calculation — staff enters the amount.
- Per-hospital parallel treatment — exactly one chosen hospital per case.
- External hospital vs Aster-network distinction on `Hospital` — not modeled
  unless it later drives behaviour.

---

## 9. Assumptions (correct before plan if wrong)

1. **Re-choosing a hospital** is allowed until the first visa `Payment` on
   the case; final afterward (fall-through then = cancel + new case).
2. **Loan interest** accrues on read only (no cron); stops at term end;
   `SIMPLE` and `COMPOUND_MONTHLY` are the only two methods needed.
3. **Referral-commission amount** is staff-entered (with a % helper), not
   derived.
4. `recordChosenResponse` requires **both** the evaluation doc and the
   invitation letter — a chosen response with only one is rejected.
5. The four new finance registers are gated by four new **distinct**
   permissions; `VIEW_FINANCE` grants read.
