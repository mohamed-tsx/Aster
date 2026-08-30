# Referral & Finance Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-hospital referral (choose-one-response flow, per-inquiry documents, hospital country) and a finance expansion (revenue register, loans with computed balances, payables, embassy-partnership commission) to the Aster referral system.

**Architecture:** One additive Prisma migration for both halves. Part B reworks the hospital-inquiry flow in `casesService.js` so that *recording the chosen hospital's response* (multipart, with an evaluation doc + invitation letter) is the case-advancing trigger; the old `respondToInquiry` narrows to decline-only. Part C adds three focused domain models (`Revenue`, `Loan`+`LoanRepayment`, `Payable`), each posting through the existing `Account`/`AccountTransaction` ledger via new transaction-type values, plus embassy commission captured as an `Expense`. Frontend follows the existing list-page + create-dialog pattern.

**Tech Stack:** Express 5, Prisma 7 (`@prisma/adapter-pg`), Postgres; Next.js 16 App Router, react-hook-form + zod, shadcn/ui, axios; Vitest 4 against a real `_test` Postgres DB.

**Spec:** `docs/superpowers/specs/2026-08-30-referral-finance-expansion-design.md`

## Global Constraints

- **Response envelope:** all HTTP responses use `{ success, message, data }` via `sendSuccess`/`sendCreated` from `Server/Src/Utils/Response/apiResponse.js`; list payloads wrapped under a named key.
- **Errors:** `throw new AppError(msg, statusCode, errorCode)` from `Server/Src/Utils/ErrorHandler/errorHandler.js`. Validation failures are `400` / `"VALIDATION_ERROR"`; not-found `404` / `"NOT_FOUND"`; conflicts `409` / `"CONFLICT"`.
- **Auth:** every route file does `router.use(Verify)` then per-route `RequirePermission("X")` or `RequireAnyPermission([...])`.
- **New permissions** (added to `caseManagementPermissions` in `Server/cmd/Seed/adminSeed.js`, exact names): `RECORD_HOSPITAL_RESPONSE`, `MANAGE_REVENUE`, `MANAGE_LOANS`, `MANAGE_PAYABLES`.
- **Money:** all amounts `Decimal @db.Decimal(12, 2)`; every money model carries `currency Currency`. Valid currencies: `USD`, `INR`. Amount validation: reject `undefined | null | "" | Number(x) <= 0`.
- **Ledger:** every money-moving action creates exactly one `AccountTransaction` in the same `Prisma.$transaction` as its domain row (mirror `createExpense` in `Server/Src/Services/Expenses/expensesService.js`). Nested `accountTransaction: { create: {...} }` forces Prisma's checked-input shape — sibling scalar FKs on the parent must use `connect`.
- **New `AccountTransactionType` values:** `REVENUE_RECEIVED` + `LOAN_RECEIVED` are credits; `LOAN_REPAYMENT` + `PAYABLE_SETTLED` are debits. `Server/Src/Services/Accounts/accountsService.js` `CREDIT_TYPES`/`DEBIT_TYPES` must list them.
- **Multipart:** reuse `uploadDocument` from `Server/Src/Middlewares/Multer/uploadDocument.js` and `saveDocumentLocal(buffer, caseId, documentId, mimeType)` from `Server/Src/Utils/Documents/saveDocumentLocal.js` (returns `/uploads/documents/<caseId>/<id>.<ext>`). Document-writing transactions pass `{ timeout: 30000 }` to `$transaction`.
- **Tests:** real Postgres `_test` DB, `Server/tests/`, factory helpers in `Server/tests/helpers/factories.js`, never mock Prisma. Frontend has NO test framework — verification is `npx tsc --noEmit` (baseline fails only in `components/ui/{calendar,rich-text-editor}.tsx`) + `npm run lint` (baseline 73 problems); introduce zero new of either.
- **Commit trailers** (every commit):
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CzuEoCu7vXpWHV8LATtvfD
  ```
- **SDD ledger dir `.superpowers/` stays untracked** — stage only the files each task names, explicitly (never `git add -A`).

---

## File Structure

**Backend — new**
- `Server/Src/Services/Revenue/revenueService.js` — revenue register (create, list)
- `Server/Src/Controllers/Revenue/revenueController.js`
- `Server/Src/Routes/Revenue/revenueRoute.js`
- `Server/Src/Services/Loans/loanProjection.js` — pure interest/outstanding math
- `Server/Src/Services/Loans/loansService.js` — loans + repayments
- `Server/Src/Controllers/Loans/loansController.js`
- `Server/Src/Routes/Loans/loansRoute.js`
- `Server/Src/Services/Payables/payablesService.js`
- `Server/Src/Controllers/Payables/payablesController.js`
- `Server/Src/Routes/Payables/payablesRoute.js`
- `Server/tests/services/*` — one suite per new service + Part B suites

**Backend — modified**
- `Server/prisma/schema.prisma` — Part B fields/enums + 4 new models + `AccountTransaction` FKs
- `Server/prisma/migrations/<ts>_referral_finance_expansion/migration.sql`
- `Server/cmd/Seed/adminSeed.js` — 4 permissions + `EMBASSY_COMMISSION_DEFAULT` (via `SETTING_DEFAULTS`)
- `Server/Src/Services/Settings/settingsService.js` — add `EMBASSY_COMMISSION_DEFAULT` to `SETTING_DEFAULTS`
- `Server/Src/Services/Accounts/accountsService.js` — `CREDIT_TYPES`/`DEBIT_TYPES`, transaction-list includes
- `Server/Src/Services/Cases/casesService.js` — `sendInquiry` (allow multiple pending), `respondToInquiry` (decline-only), new `recordChosenResponse` + `changeChosenHospital`, `markEmbassyVisited` (+ optional commission), `CASE_DETAIL_INCLUDE`
- `Server/Src/Controllers/Cases/casesController.js`, `Server/Src/Routes/Cases/casesRoute.js`
- `Server/Src/Services/Hospitals/hospitalsService.js`, its controller/route — `country`
- `Server/Src/Services/Dashboard/dashboardService.js` — `getFinanceStats` extension
- `Server/cmd/Server/Server.js` — mount `/revenue`, `/loans`, `/payables`
- `Server/tests/helpers/factories.js` — `createHospital` country, `recordChosenResponse` helper, loan/revenue/payable factories
- `Server/tests/services/{agency-visa-workflow,attendant-passport-gate,case-intake-documents,case-events,case-timeline}.test.js` — move ACCEPTED-path call sites to the new helper

**Frontend — new**
- `aster/services/revenue.ts`, `aster/services/loans.ts`, `aster/services/payables.ts`
- `aster/types/revenue.ts`, `aster/types/loan.ts`, `aster/types/payable.ts`
- `aster/app/dashboard/revenue/page.tsx`, `aster/components/revenue/*`
- `aster/app/dashboard/loans/page.tsx`, `aster/app/dashboard/loans/[id]/page.tsx`, `aster/components/loans/*`
- `aster/app/dashboard/payables/page.tsx`, `aster/components/payables/*`
- `aster/components/cases/record-response-dialog.tsx`, `aster/components/cases/change-hospital-dialog.tsx`

**Frontend — modified**
- `aster/services/cases.ts` (`recordChosenResponse`, `changeChosenHospital`, `declineInquiry`), `aster/services/hospitals.ts` (`country`)
- `aster/types/case.ts` (`HospitalInquiry` gains `isChosen`, `country`, `documents`; `HospitalInquiryStatus += "NOT_SELECTED"`), `aster/types/hospital.ts` (`country`), `aster/types/document.ts` (`DocumentType += "EVALUATION_DOC"`)
- `aster/components/cases/hospital-inquiry-panel.tsx` — full rework
- `aster/components/hospitals/hospital-form-dialog.tsx` — country field
- `aster/components/cases/embassy-visit-dialog.tsx` — optional commission section

---

## Phases

- **Phase 0 (Task 1):** schema, migration, seed, ledger constants, test infra.
- **Phase 1 (Tasks 2–5):** Part B — multi-hospital referral. Checkpoint after Task 5.
- **Phase 2 (Tasks 6–11):** Part C — finance backend.
- **Phase 3 (Tasks 12–17):** frontend for both halves.

---

## Task 1: Schema, migration, seed, ledger constants, test infra

**Files:**
- Modify: `Server/prisma/schema.prisma`
- Create: `Server/prisma/migrations/<timestamp>_referral_finance_expansion/migration.sql` (generated)
- Modify: `Server/Src/Services/Settings/settingsService.js`
- Modify: `Server/cmd/Seed/adminSeed.js`
- Modify: `Server/Src/Services/Accounts/accountsService.js`
- Modify: `Server/tests/helpers/factories.js`
- Test: `Server/tests/services/schema-referral-finance.test.js` (temporary sanity — deleted in the last step)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Schema: `Hospital.country String`; `HospitalInquiry.isChosen Boolean`; `Document.hospitalInquiryId String?`; enum values `DocumentType.EVALUATION_DOC`, `HospitalInquiryStatus.NOT_SELECTED`, `CaseEventType.HOSPITAL_CHOSEN|HOSPITAL_CHANGED`, `AccountTransactionType.REVENUE_RECEIVED|LOAN_RECEIVED|LOAN_REPAYMENT|PAYABLE_SETTLED`; models `Revenue`, `Loan`, `LoanRepayment`, `Payable`; enums `RevenueCategory`, `LoanInterestMethod`, `LoanStatus`, `PayableStatus`; `AccountTransaction.{revenueId,loanId,loanRepaymentId,payableId}` nullable-unique FKs.
  - `accountsService.CREDIT_TYPES` = `["OPENING_BALANCE","PAYMENT_RECEIVED","REVENUE_RECEIVED","LOAN_RECEIVED"]`; `DEBIT_TYPES` = `["EXPENSE_PAID","REFUND_ISSUED","LOAN_REPAYMENT","PAYABLE_SETTLED"]`.
  - `settingsService.SETTING_DEFAULTS.EMBASSY_COMMISSION_DEFAULT = "0"`.
  - Seed grants `RECORD_HOSPITAL_RESPONSE`, `MANAGE_REVENUE`, `MANAGE_LOANS`, `MANAGE_PAYABLES` to ADMIN.
  - `factories.js`: `createHospital` sets `country: "Testland"` by default; new `createLoan`, `createRevenue`, `createPayable` Prisma-direct factories.

- [ ] **Step 1: Edit `schema.prisma` — Part B changes**

`Hospital`: add `country String`.
`HospitalInquiry`: add `isChosen Boolean @default(false)` and `documents Document[]`.
`Document`: add
```prisma
  hospitalInquiryId String?
  hospitalInquiry   HospitalInquiry? @relation(fields: [hospitalInquiryId], references: [id], onDelete: SetNull)
```
Enums:
```prisma
enum DocumentType { PATIENT_PASSPORT ATTENDANT_PASSPORT CASE_DOCUMENT EVALUATION_DOC INVITATION_LETTER VISA_COPY OTHER }
enum HospitalInquiryStatus { PENDING ACCEPTED DECLINED NOT_SELECTED }
enum CaseEventType { CASE_CREATED CASE_STATUS_CHANGED VISA_STATUS_CHANGED INQUIRY_STATUS_CHANGED HOSPITAL_CHOSEN HOSPITAL_CHANGED }
```

- [ ] **Step 2: Edit `schema.prisma` — Part C models + enums**

```prisma
enum RevenueCategory { HOSPITAL_REFERRAL_COMMISSION OTHER_INCOME }
enum LoanInterestMethod { SIMPLE COMPOUND_MONTHLY }
enum LoanStatus { ACTIVE SETTLED }
enum PayableStatus { OUTSTANDING SETTLED }

enum AccountTransactionType {
  OPENING_BALANCE
  PAYMENT_RECEIVED
  EXPENSE_PAID
  REFUND_ISSUED
  REVENUE_RECEIVED
  LOAN_RECEIVED
  LOAN_REPAYMENT
  PAYABLE_SETTLED
}

model Revenue {
  id           String          @id @default(cuid())
  category     RevenueCategory
  amount       Decimal         @db.Decimal(12, 2)
  currency     Currency
  description  String?
  receivedOn   DateTime
  caseId       String?
  case         Case?           @relation(fields: [caseId], references: [id], onDelete: Restrict)
  accountId    String
  account      Account         @relation(fields: [accountId], references: [id], onDelete: Restrict)
  recordedById String
  recordedBy   User            @relation(fields: [recordedById], references: [id])
  accountTransaction AccountTransaction?
  createdAt    DateTime        @default(now())
}

model Loan {
  id              String             @id @default(cuid())
  lenderName      String
  principal       Decimal            @db.Decimal(12, 2)
  currency        Currency
  interestRatePct Decimal            @db.Decimal(6, 3)
  interestMethod  LoanInterestMethod
  disbursedOn     DateTime
  termMonths      Int
  dueOn           DateTime
  status          LoanStatus         @default(ACTIVE)
  notes           String?
  accountId       String
  account         Account            @relation(fields: [accountId], references: [id], onDelete: Restrict)
  recordedById    String
  recordedBy      User               @relation("LoansRecorded", fields: [recordedById], references: [id])
  repayments      LoanRepayment[]
  accountTransaction AccountTransaction?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
}

model LoanRepayment {
  id           String   @id @default(cuid())
  loanId       String
  loan         Loan     @relation(fields: [loanId], references: [id], onDelete: Restrict)
  amount       Decimal  @db.Decimal(12, 2)
  paidOn       DateTime
  accountId    String
  account      Account  @relation(fields: [accountId], references: [id], onDelete: Restrict)
  recordedById String
  recordedBy   User     @relation("LoanRepaymentsRecorded", fields: [recordedById], references: [id])
  accountTransaction AccountTransaction?
  createdAt    DateTime @default(now())
}

model Payable {
  id           String        @id @default(cuid())
  payeeName    String
  caseId       String?
  case         Case?         @relation(fields: [caseId], references: [id], onDelete: Restrict)
  amount       Decimal       @db.Decimal(12, 2)
  currency     Currency
  reason       String
  raisedOn     DateTime
  status       PayableStatus @default(OUTSTANDING)
  settledOn    DateTime?
  recordedById String
  recordedBy   User          @relation("PayablesRecorded", fields: [recordedById], references: [id])
  accountTransaction AccountTransaction?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```
`AccountTransaction`: add
```prisma
  revenueId       String?        @unique
  revenue         Revenue?       @relation(fields: [revenueId], references: [id], onDelete: Restrict)
  loanId          String?        @unique
  loan            Loan?          @relation(fields: [loanId], references: [id], onDelete: Restrict)
  loanRepaymentId String?        @unique
  loanRepayment   LoanRepayment? @relation(fields: [loanRepaymentId], references: [id], onDelete: Restrict)
  payableId       String?        @unique
  payable         Payable?       @relation(fields: [payableId], references: [id], onDelete: Restrict)
```
Back-relations: `Account` += `revenues Revenue[]`, `loans Loan[]`, `loanRepayments LoanRepayment[]`, `payables Payable[]`. `User` += `revenuesRecorded Revenue[]`, `loansRecorded Loan[] @relation("LoansRecorded")`, `loanRepaymentsRecorded LoanRepayment[] @relation("LoanRepaymentsRecorded")`, `payablesRecorded Payable[] @relation("PayablesRecorded")`. `Case` += `revenues Revenue[]`, `payables Payable[]`.

- [ ] **Step 3: Generate the migration**

Run: `cd Server && npx prisma migrate dev --name referral_finance_expansion`
Then open the generated `migration.sql` and **verify**:
- `ALTER TABLE "Hospital" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Unknown';` — if Prisma emitted it without a default (it will, because the column is non-nullable with no `@default`), **hand-edit** so existing rows survive:
  ```sql
  ALTER TABLE "Hospital" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Unknown';
  ALTER TABLE "Hospital" ALTER COLUMN "country" DROP DEFAULT;
  ```
- all four `ALTER TYPE "AccountTransactionType" ADD VALUE …` and the Part B enum `ADD VALUE`s are present, and no statement in this migration *uses* a new enum value (safe on PG12+).
- the four new tables and the four `AccountTransaction` columns + unique indexes + FKs (`ON DELETE RESTRICT`) are present.
If you hand-edit the SQL after `migrate dev` already applied it, run `cd Server && npx prisma migrate reset --force` to drop and re-apply every migration cleanly against the dev DB (this DB holds only dev data). Then confirm `npx prisma migrate status` says "up to date" and run `npx prisma generate`.

- [ ] **Step 4: `settingsService.js` — add the setting default**

In `SETTING_DEFAULTS`, add `EMBASSY_COMMISSION_DEFAULT: "0"`. (`SETTING_KEYS` derives from it automatically.)

- [ ] **Step 5: `adminSeed.js` — permissions**

Append to `caseManagementPermissions`: `"RECORD_HOSPITAL_RESPONSE"`, `"MANAGE_REVENUE"`, `"MANAGE_LOANS"`, `"MANAGE_PAYABLES"`. (The `SETTING_DEFAULTS` upsert loop already picks up the new key.)

- [ ] **Step 6: `accountsService.js` — ledger constants**

```js
export const CREDIT_TYPES = ["OPENING_BALANCE", "PAYMENT_RECEIVED", "REVENUE_RECEIVED", "LOAN_RECEIVED"];
export const DEBIT_TYPES = ["EXPENSE_PAID", "REFUND_ISSUED", "LOAN_REPAYMENT", "PAYABLE_SETTLED"];
```
In `TRANSACTION_LIST_INCLUDE`, add lightweight includes so the ledger view can label the new rows:
```js
  revenue: { select: { id: true, category: true, case: { select: { id: true, caseNumber: true } } } },
  loan: { select: { id: true, lenderName: true } },
  loanRepayment: { select: { id: true, loan: { select: { id: true, lenderName: true } } } },
  payable: { select: { id: true, payeeName: true, reason: true } },
```

- [ ] **Step 7: `factories.js` — helpers**

Change `createHospital` default data to include `country: "Testland"`. Add:
```js
export const createLoan = async ({ accountId, recordedById, ...overrides } = {}) =>
  Prisma.loan.create({
    data: {
      lenderName: `Lender ${unique()}`,
      principal: 1000,
      currency: "USD",
      interestRatePct: 12,
      interestMethod: "SIMPLE",
      disbursedOn: new Date("2026-01-01"),
      termMonths: 12,
      dueOn: new Date("2027-01-01"),
      accountId,
      recordedById,
      ...overrides,
    },
  });

export const createRevenue = async ({ accountId, recordedById, ...overrides } = {}) =>
  Prisma.revenue.create({
    data: {
      category: "OTHER_INCOME",
      amount: 500,
      currency: "USD",
      receivedOn: new Date("2026-02-01"),
      accountId,
      recordedById,
      ...overrides,
    },
  });

export const createPayable = async ({ recordedById, ...overrides } = {}) =>
  Prisma.payable.create({
    data: {
      payeeName: `Payee ${unique()}`,
      amount: 300,
      currency: "USD",
      reason: "Test payable",
      raisedOn: new Date("2026-02-01"),
      recordedById,
      ...overrides,
    },
  });
```

- [ ] **Step 8: Temporary sanity test**

Create `Server/tests/services/schema-referral-finance.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createHospital } from "../helpers/factories.js";

describe("referral-finance schema", () => {
  it("stores a hospital country and an inquiry isChosen flag", async () => {
    const hospital = await createHospital({ country: "India" });
    expect(hospital.country).toBe("India");
  });

  it("folds REVENUE_RECEIVED as a credit and PAYABLE_SETTLED as a debit", async () => {
    const user = await createUser();
    const account = await createAccount();
    await Prisma.accountTransaction.create({
      data: { accountId: account.id, type: "REVENUE_RECEIVED", amount: 200, currency: "USD", createdById: user.id },
    });
    await Prisma.accountTransaction.create({
      data: { accountId: account.id, type: "PAYABLE_SETTLED", amount: 50, currency: "USD", createdById: user.id },
    });
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(150);
  });

  it("creates a Loan row with terms", async () => {
    const user = await createUser();
    const account = await createAccount();
    const loan = await Prisma.loan.create({
      data: {
        lenderName: "Bank X", principal: 1000, currency: "USD", interestRatePct: 10,
        interestMethod: "COMPOUND_MONTHLY", disbursedOn: new Date("2026-01-01"),
        termMonths: 6, dueOn: new Date("2026-07-01"), accountId: account.id, recordedById: user.id,
      },
    });
    expect(loan.status).toBe("ACTIVE");
    expect(Number(loan.principal)).toBe(1000);
  });
});
```

- [ ] **Step 9: Run it**

Run: `cd Server && npx vitest run tests/services/schema-referral-finance.test.js`
Expected: 3 passing. Then run the full suite `cd Server && npx vitest run` — every existing suite still green (the `createHospital` country default keeps them valid).

- [ ] **Step 10: Apply the migration to the test DB and delete the sanity test**

`db-reset.js` only TRUNCATEs — it does not run migrations. Apply the new migration to `aster_db_dev_test` with `dotenv-cli` (a devDependency): `cd Server && npx dotenv-cli -e .env.test -- npx prisma migrate deploy`. (Subsystem A's migration reached the test DB the same way.) Then re-run `cd Server && npx vitest run` — full suite green. Then `git rm Server/tests/services/schema-referral-finance.test.js`.

- [ ] **Step 11: Commit**

```bash
cd Server
git add prisma/schema.prisma prisma/migrations Src/Services/Settings/settingsService.js \
  cmd/Seed/adminSeed.js Src/Services/Accounts/accountsService.js tests/helpers/factories.js
git commit -m "feat: schema + ledger wiring for referral & finance expansion"
```

---

## Task 2: `Hospital.country` + allow multiple pending inquiries

**Files:**
- Modify: `Server/Src/Services/Hospitals/hospitalsService.js`
- Modify: `Server/Src/Services/Cases/casesService.js` (`sendInquiry`, `CASE_DETAIL_INCLUDE`)
- Test: `Server/tests/services/hospitals.test.js` (create if absent), `Server/tests/services/case-events.test.js` (add a multi-inquiry case)

**Interfaces:**
- Consumes: schema from Task 1.
- Produces:
  - `createHospital(data)` requires `data.country` (non-empty string); `updateHospital` accepts `country`.
  - `sendInquiry(caseId, { hospitalId, notes }, userId)` no longer rejects a second `PENDING` inquiry — a case may have many open inquiries at once. It still requires `SENDABLE_CASE_STATUSES` and rejects a duplicate `PENDING` inquiry **to the same hospital** (`409 CONFLICT`).
  - `CASE_DETAIL_INCLUDE.inquiries` now `include: { hospital: true, documents: { orderBy: { createdAt: "desc" } } }` and selects `isChosen`.

- [ ] **Step 1: Failing test — hospital country**

Create/extend `Server/tests/services/hospitals.test.js`:
```js
import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createHospital, updateHospital } from "../../Src/Services/Hospitals/hospitalsService.js";

describe("createHospital — country", () => {
  it("rejects a missing country", async () => {
    await expect(
      createHospital({ name: "Apollo", city: "Chennai" }),
    ).rejects.toThrow("Country is required");
  });

  it("stores a trimmed country and lets it be updated", async () => {
    const h = await createHospital({ name: `H ${Date.now()}`, city: "Chennai", country: "  India  " });
    expect(h.country).toBe("India");
    const u = await updateHospital(h.id, { country: "UAE" });
    expect(u.country).toBe("UAE");
  });
});
```

- [ ] **Step 2: Run — fails** (`country` not validated, not stored)

Run: `cd Server && npx vitest run tests/services/hospitals.test.js`

- [ ] **Step 3: Implement — `hospitalsService.js`**

`createHospital`: destructure `country`; after the city check add
```js
  if (!country?.trim()) {
    throw new AppError("Country is required", 400, "VALIDATION_ERROR");
  }
```
and add `country: country.trim(),` to the `create` data.
`updateHospital`: after the `city` block add
```js
  if (data.country !== undefined) {
    if (!data.country?.trim()) {
      throw new AppError("Country is required", 400, "VALIDATION_ERROR");
    }
    updateData.country = data.country.trim();
  }
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Failing test — multiple pending inquiries**

Add to `Server/tests/services/case-events.test.js` (it already imports `sendInquiry`, `createCase`, `createHospital`, `createUser`):
```js
it("allows several pending inquiries on one case, but not two to the same hospital", async () => {
  const user = await createUser();
  const kase = await createCase();
  const h1 = await createHospital();
  const h2 = await createHospital();

  await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
  await sendInquiry(kase.id, { hospitalId: h2.id }, user.id); // no throw

  const open = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id, status: "PENDING" } });
  expect(open).toHaveLength(2);

  await expect(sendInquiry(kase.id, { hospitalId: h1.id }, user.id)).rejects.toThrow(
    /already has a pending inquiry to this hospital/,
  );
});
```
(Ensure `Prisma` is imported in that file — it is.)

- [ ] **Step 6: Run — fails** (current code rejects the 2nd inquiry entirely)

- [ ] **Step 7: Implement — `sendInquiry`**

Replace the "already has a pending inquiry" block (currently `findFirst({ where: { caseId, status: "PENDING" } })`) with a same-hospital check:
```js
  const dupe = await Prisma.hospitalInquiry.findFirst({
    where: { caseId, hospitalId, status: "PENDING" },
  });
  if (dupe) {
    throw new AppError(
      "This case already has a pending inquiry to this hospital.",
      409,
      "CONFLICT",
    );
  }
```

- [ ] **Step 8: Update `CASE_DETAIL_INCLUDE`**

Change the `inquiries` include to:
```js
  inquiries: {
    orderBy: { sentAt: "desc" },
    include: {
      hospital: true,
      documents: { orderBy: { createdAt: "desc" } },
    },
  },
```

- [ ] **Step 9: Run the affected suites + full suite**

Run: `cd Server && npx vitest run tests/services/hospitals.test.js tests/services/case-events.test.js tests/services/case-timeline.test.js` then `cd Server && npx vitest run`. All green. (Existing hospital controller tests / hospital create callers that omit `country` are test-only and updated via the `createHospital` factory default from Task 1; if any service-level test constructs a hospital through `hospitalsService.createHospital` without a country, add `country: "Testland"` there.)

- [ ] **Step 10: Commit**

```bash
cd Server
git add Src/Services/Hospitals/hospitalsService.js Src/Services/Cases/casesService.js \
  tests/services/hospitals.test.js tests/services/case-events.test.js
git commit -m "feat: hospital country + multiple concurrent hospital inquiries per case"
```

---

## Task 3: `recordChosenResponse` — the case-advancing trigger

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js`
- Modify: `Server/Src/Controllers/Cases/casesController.js`
- Modify: `Server/Src/Routes/Cases/casesRoute.js`
- Modify: `Server/Src/Services/Documents/documentsService.js` (`DOCUMENT_TYPES += "EVALUATION_DOC"`)
- Modify: `Server/tests/helpers/factories.js`
- Test: `Server/tests/services/chosen-hospital.test.js`

**Interfaces:**
- Consumes: `isAgencyCase` (existing), `caseEventOp` (existing), `saveDocumentLocal`, `uploadDocument`, schema from Task 1.
- Produces:
  - `recordChosenResponse(caseId, inquiryId, data, files, userId)` — `data = { treatmentCostEstimate, currency, notes? }`, `files = { evaluationDoc: File[], invitationLetter: File[] }` (Multer `.fields()` shape; `File = { buffer, mimetype, originalname }`). Both files required. Sets the inquiry `ACCEPTED` + `isChosen`, writes two inquiry-scoped `Document` rows, sets every other `PENDING` inquiry on the case to `NOT_SELECTED`, moves the case to `HOSPITAL_ACCEPTED`, auto-creates visa applications exactly as the old `respondToInquiry` ACCEPTED branch (PATIENT + ATTENDANT-if-present, skipped for agency cases), logs `CASE_STATUS_CHANGED` + `HOSPITAL_CHOSEN`. Returns the case via `CASE_DETAIL_INCLUDE`.
  - HTTP `POST /cases/:id/inquiries/:inquiryId/response` (`RECORD_HOSPITAL_RESPONSE`, multipart).
  - `factories.js`: `recordChosenResponseFor(caseId, { hospitalId?, user, cost = 5000, currency = "USD" })` — a test helper that sends an inquiry (creating a hospital if none given) and calls `recordChosenResponse` with stub docs; returns the updated case. Also `chosenResponseFiles()` returning `{ evaluationDoc: [fakeUpload("eval.pdf")], invitationLetter: [fakeUpload("invite.pdf")] }`.

- [ ] **Step 1: `DOCUMENT_TYPES`**

`Server/Src/Services/Documents/documentsService.js` — add `"EVALUATION_DOC"` to the `DOCUMENT_TYPES` array (after `"CASE_DOCUMENT"`).

- [ ] **Step 2: Failing tests**

Create `Server/tests/services/chosen-hospital.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { sendInquiry, recordChosenResponse } from "../../Src/Services/Cases/casesService.js";
import { createUser, createHospital, createCase, chosenResponseFiles } from "../helpers/factories.js";
import { createCase as createCaseRow } from "../helpers/factories.js";

const agencyCase = async () => {
  const agency = await Prisma.agency.create({ data: { name: `Ag ${Date.now()}${Math.random()}` } });
  return createCaseRow({ reachOutType: "AGENCY", agencyId: agency.id });
};

describe("recordChosenResponse", () => {
  it("chooses one inquiry, marks the rest NOT_SELECTED, advances the case, creates visa apps", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital({ country: "India" });
    const h2 = await createHospital({ country: "UAE" });
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);

    const updated = await recordChosenResponse(
      kase.id, i1.id,
      { treatmentCostEstimate: 8000, currency: "USD" },
      chosenResponseFiles(),
      user.id,
    );

    expect(updated.status).toBe("HOSPITAL_ACCEPTED");
    const inquiries = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id } });
    expect(inquiries.find((i) => i.id === i1.id)).toMatchObject({ status: "ACCEPTED", isChosen: true });
    expect(inquiries.filter((i) => i.status === "NOT_SELECTED")).toHaveLength(1);

    const docs = await Prisma.document.findMany({ where: { hospitalInquiryId: i1.id }, orderBy: { type: "asc" } });
    expect(docs.map((d) => d.type).sort()).toEqual(["EVALUATION_DOC", "INVITATION_LETTER"]);

    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(1);
    expect(visaApps[0].travelerType).toBe("PATIENT");
  });

  it("creates no visa apps for an agency case", async () => {
    const user = await createUser();
    const kase = await agencyCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    await recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    const visaApps = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaApps).toHaveLength(0);
  });

  it("rejects a second chosen response on the same case", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    await expect(
      recordChosenResponse(kase.id, i2.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/already has a chosen hospital/);
  });

  it("requires both documents", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    const files = chosenResponseFiles();
    delete files.invitationLetter;
    await expect(
      recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "USD" }, files, user.id),
    ).rejects.toThrow(/invitation letter is required/i);
  });

  it("rejects a bad currency and a missing cost", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h = await createHospital();
    const i = await sendInquiry(kase.id, { hospitalId: h.id }, user.id);
    await expect(
      recordChosenResponse(kase.id, i.id, { treatmentCostEstimate: 1, currency: "GBP" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(AppError);
    await expect(
      recordChosenResponse(kase.id, i.id, { currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/treatment cost/i);
  });
});
```

- [ ] **Step 3: `factories.js` helpers**

```js
export const chosenResponseFiles = () => ({
  evaluationDoc: [fakeUpload("eval.pdf", "application/pdf")],
  invitationLetter: [fakeUpload("invite.pdf", "application/pdf")],
});

// Sends an inquiry then records it as the chosen response — the post-Task-4
// replacement for `respondToInquiry(..., { status: "ACCEPTED" })` in tests.
export const recordChosenResponseFor = async (
  caseId,
  { user, hospitalId, cost = 5000, currency = "USD" } = {},
) => {
  const { sendInquiry, recordChosenResponse } = await import(
    "../../Src/Services/Cases/casesService.js"
  );
  const hid = hospitalId || (await createHospital()).id;
  const inquiry = await sendInquiry(caseId, { hospitalId: hid }, user.id);
  return recordChosenResponse(
    caseId, inquiry.id, { treatmentCostEstimate: cost, currency }, chosenResponseFiles(), user.id,
  );
};
```

- [ ] **Step 4: Run — fails** (`recordChosenResponse` not exported)

Run: `cd Server && npx vitest run tests/services/chosen-hospital.test.js`

- [ ] **Step 5: Implement `recordChosenResponse` in `casesService.js`**

Add near the imports: `import crypto from "crypto";` and `import { saveDocumentLocal } from "../../Utils/Documents/saveDocumentLocal.js";` (skip whichever is already imported from Subsystem A).

```js
const CURRENCIES = ["USD", "INR"];

/**
 * Records the chosen hospital's response — the case-advancing trigger.
 * @param {string} caseId
 * @param {string} inquiryId
 * @param {{ treatmentCostEstimate: number|string, currency: string, notes?: string }} data
 * @param {{ evaluationDoc?: {buffer,mimetype,originalname}[], invitationLetter?: {buffer,mimetype,originalname}[] }} files
 * @param {string} userId
 */
export const recordChosenResponse = async (caseId, inquiryId, data, files, userId) => {
  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  if (kase.status === "CANCELLED") {
    throw new AppError("Cannot record a response for a cancelled case", 400, "VALIDATION_ERROR");
  }

  const inquiry = await Prisma.hospitalInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry || inquiry.caseId !== caseId) {
    throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  }
  if (inquiry.status !== "PENDING") {
    throw new AppError("This inquiry is no longer pending", 400, "VALIDATION_ERROR");
  }

  const alreadyChosen = await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } });
  if (alreadyChosen) {
    throw new AppError(
      "This case already has a chosen hospital. Use the change-hospital action instead.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { treatmentCostEstimate, currency, notes } = data;
  if (treatmentCostEstimate === undefined || treatmentCostEstimate === null || treatmentCostEstimate === "" || Number(treatmentCostEstimate) <= 0) {
    throw new AppError("A positive treatment cost estimate is required", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  const evaluationDoc = files?.evaluationDoc?.[0] ?? null;
  const invitationLetter = files?.invitationLetter?.[0] ?? null;
  if (!evaluationDoc) throw new AppError("An evaluation document is required", 400, "VALIDATION_ERROR");
  if (!invitationLetter) throw new AppError("An invitation letter is required", 400, "VALIDATION_ERROR");

  const docPlan = [
    [evaluationDoc, "EVALUATION_DOC"],
    [invitationLetter, "INVITATION_LETTER"],
  ];

  return Prisma.$transaction(async (tx) => {
    await tx.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status: "ACCEPTED",
        isChosen: true,
        treatmentCostEstimate,
        currency,
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
    });

    await tx.hospitalInquiry.updateMany({
      where: { caseId, status: "PENDING", id: { not: inquiryId } },
      data: { status: "NOT_SELECTED", respondedAt: new Date() },
    });

    for (const [file, type] of docPlan) {
      const documentId = crypto.randomUUID();
      const fileUrl = await saveDocumentLocal(file.buffer, caseId, documentId, file.mimetype);
      await tx.document.create({
        data: {
          id: documentId,
          caseId,
          hospitalInquiryId: inquiryId,
          type,
          fileName: file.originalname,
          fileUrl,
          uploadedById: userId,
        },
      });
    }

    await tx.case.update({ where: { id: caseId }, data: { status: "HOSPITAL_ACCEPTED" } });

    await tx.caseEvent.create({
      data: { caseId, type: "CASE_STATUS_CHANGED", fromStatus: kase.status, toStatus: "HOSPITAL_ACCEPTED", actorId: userId },
    });
    await tx.caseEvent.create({
      data: { caseId, type: "HOSPITAL_CHOSEN", fromStatus: null, toStatus: "ACCEPTED", inquiryId, actorId: userId },
    });

    if (!isAgencyCase(kase)) {
      await tx.visaApplication.create({ data: { caseId, travelerType: "PATIENT" } });
      if (kase.attendant) {
        await tx.visaApplication.create({ data: { caseId, travelerType: "ATTENDANT" } });
      }
    }

    return tx.case.findUnique({ where: { id: caseId }, include: CASE_DETAIL_INCLUDE });
  }, { timeout: 30000 });
};
```

- [ ] **Step 6: Run — passes** (`chosen-hospital.test.js` all green)

- [ ] **Step 7: Controller + route**

`casesController.js` — add to the `casesService` import and:
```js
export const recordChosenResponseCtrl = asyncHandler(async (req, res) => {
  const kase = await recordChosenResponse(req.params.id, req.params.inquiryId, req.body, req.files ?? {}, req.user.id);
  return sendCreated(res, "Hospital response recorded successfully", kase);
});
```
`casesRoute.js` — add the import and, after the `POST /:id/inquiries` line:
```js
router.post(
  "/:id/inquiries/:inquiryId/response",
  RequirePermission("RECORD_HOSPITAL_RESPONSE"),
  uploadDocument.fields([
    { name: "evaluationDoc", maxCount: 1 },
    { name: "invitationLetter", maxCount: 1 },
  ]),
  recordChosenResponseCtrl,
);
```

- [ ] **Step 8: Full suite**

Run: `cd Server && npx vitest run` — all green (nothing else touched yet; `respondToInquiry` still handles ACCEPTED, so Subsystem A suites are unaffected).

- [ ] **Step 9: Commit**

```bash
cd Server
git add Src/Services/Cases/casesService.js Src/Controllers/Cases/casesController.js \
  Src/Routes/Cases/casesRoute.js Src/Services/Documents/documentsService.js \
  tests/helpers/factories.js tests/services/chosen-hospital.test.js
git commit -m "feat: recordChosenResponse — chosen-hospital flow with per-inquiry documents"
```

---

## Task 4: Narrow `respondToInquiry` to decline-only + migrate callers

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js` (`respondToInquiry`)
- Modify: `Server/Src/Controllers/Cases/casesController.js`, `Server/Src/Routes/Cases/casesRoute.js`
- Modify: `Server/tests/services/{agency-visa-workflow,attendant-passport-gate,case-intake-documents,case-events,case-timeline}.test.js`
- Test: `Server/tests/services/chosen-hospital.test.js` (add decline cases)

**Interfaces:**
- Consumes: `recordChosenResponseFor` (Task 3 factory).
- Produces:
  - `respondToInquiry(caseId, inquiryId, data, userId)` — `data = { notes? }`. Sets the inquiry `DECLINED`, `respondedAt`, logs `INQUIRY_STATUS_CHANGED`. Does **not** touch case status, does **not** create visa apps. Rejects any `data.status` other than an omitted/`"DECLINED"` value with `400`. The case moves to `HOSPITAL_DECLINED` **only if this was the case's last open inquiry** (no remaining `PENDING`), otherwise case status is unchanged.
  - Route unchanged in shape: `PATCH /cases/:id/inquiries/:inquiryId` still maps to `respondInquiryCtrl`.

- [ ] **Step 1: Update the failing/expectation tests first**

In `chosen-hospital.test.js` add:
```js
import { respondToInquiry } from "../../Src/Services/Cases/casesService.js";

describe("respondToInquiry — decline only", () => {
  it("declines an inquiry without advancing the case while others are open", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);

    await respondToInquiry(kase.id, i1.id, { notes: "too expensive" }, user.id);

    const c = await Prisma.case.findUnique({ where: { id: kase.id } });
    expect(c.status).toBe("HOSPITAL_MATCHING");
    const declined = await Prisma.hospitalInquiry.findUnique({ where: { id: i1.id } });
    expect(declined.status).toBe("DECLINED");
  });

  it("moves the case to HOSPITAL_DECLINED when the last open inquiry is declined", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await respondToInquiry(kase.id, i1.id, {}, user.id);
    const c = await Prisma.case.findUnique({ where: { id: kase.id } });
    expect(c.status).toBe("HOSPITAL_DECLINED");
  });

  it("rejects an ACCEPTED status", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    await expect(
      respondToInquiry(kase.id, i1.id, { status: "ACCEPTED" }, user.id),
    ).rejects.toThrow(/use the record-response action/i);
  });
});
```

- [ ] **Step 2: Run — fails** (current `respondToInquiry` accepts ACCEPTED and always sets case status)

- [ ] **Step 3: Rewrite `respondToInquiry`**

Replace the function body from the `const { status, treatmentCostEstimate, currency, notes } = data;` line onward:
```js
  const { status, notes } = data;
  if (status !== undefined && status !== "DECLINED") {
    throw new AppError(
      "Only a decline can be recorded here — use the record-response action to choose a hospital.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const remainingPending = await Prisma.hospitalInquiry.count({
    where: { caseId, status: "PENDING", id: { not: inquiryId } },
  });
  const caseGoesDeclined = remainingPending === 0 && !(await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } }));

  const ops = [
    Prisma.hospitalInquiry.update({
      where: { id: inquiryId },
      data: { status: "DECLINED", notes: notes !== undefined ? notes || null : undefined, respondedAt: new Date() },
      include: { hospital: true },
    }),
    caseEventOp({ caseId, type: "INQUIRY_STATUS_CHANGED", fromStatus: "PENDING", toStatus: "DECLINED", inquiryId, actorId: userId }),
  ];
  if (caseGoesDeclined) {
    ops.push(
      Prisma.case.update({ where: { id: caseId }, data: { status: "HOSPITAL_DECLINED" } }),
      caseEventOp({ caseId, type: "CASE_STATUS_CHANGED", fromStatus: kase.status, toStatus: "HOSPITAL_DECLINED", actorId: userId }),
    );
  }

  const [updatedInquiry] = await Prisma.$transaction(ops);
  return updatedInquiry;
```
Update the JSDoc `@param` for `data` to `{ status?: "DECLINED", notes?: string }`.

- [ ] **Step 4: Run — `chosen-hospital.test.js` passes**

- [ ] **Step 5: Migrate the Subsystem A call sites**

In each of these files, every `respondToInquiry(caseId, inquiryId, { status: "ACCEPTED", ... }, user.id)` (and the `sendInquiry` + accept pair preceding it) becomes a single `await recordChosenResponseFor(kase.id, { user })` call (import it from `../helpers/factories.js`). Where the test needs the created `PATIENT` visa app, fetch it after: `await Prisma.visaApplication.findFirstOrThrow({ where: { caseId: kase.id, travelerType: "PATIENT" } })`.
- `agency-visa-workflow.test.js` — the `acceptAndGetPatientVisaApp` helper and the DIRECT-regression test.
- `attendant-passport-gate.test.js` — `acceptAndGetPatientVisaApp`.
- `case-intake-documents.test.js` — none use `respondToInquiry` directly (verify with a grep); skip if clean.
- `case-events.test.js` / `case-timeline.test.js` — the acceptance-path assertions; keep any assertion about `HOSPITAL_ACCEPTED` and visa-app counts, just change how the state is reached. The event-type assertions change: expect `HOSPITAL_CHOSEN` where they previously expected `INQUIRY_STATUS_CHANGED → ACCEPTED`.
Run a grep first: `cd Server && grep -rn "status: \"ACCEPTED\"" tests/` — every hit is a call site to migrate.

- [ ] **Step 6: Run the full suite**

Run: `cd Server && npx vitest run` — all green. Fix any missed call site.

- [ ] **Step 7: Commit**

```bash
cd Server
git add Src/Services/Cases/casesService.js Src/Controllers/Cases/casesController.js \
  Src/Routes/Cases/casesRoute.js tests/services
git commit -m "refactor: respondToInquiry becomes decline-only; migrate acceptance-path tests"
```

---

## Task 5: `changeChosenHospital`

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js`
- Modify: `Server/Src/Controllers/Cases/casesController.js`, `Server/Src/Routes/Cases/casesRoute.js`
- Test: `Server/tests/services/chosen-hospital.test.js`

**Interfaces:**
- Consumes: `recordChosenResponse` internals pattern, `createPayment` factory (existing).
- Produces:
  - `changeChosenHospital(caseId, newInquiryId, data, files, userId)` — same `data`/`files` shape as `recordChosenResponse`. Requires an existing chosen inquiry and **no `Payment`** on any of the case's visa applications. `newInquiryId` must be a `PENDING` or `NOT_SELECTED` inquiry on the case, not the current chosen one. Flips the old chosen to `NOT_SELECTED` (`isChosen=false`, docs kept), sets the new one `ACCEPTED`/`isChosen`/cost/docs, leaves visa applications and case status untouched, logs `HOSPITAL_CHANGED`.
  - HTTP `POST /cases/:id/chosen-hospital` (`RECORD_HOSPITAL_RESPONSE`, multipart, body carries `newInquiryId` + cost/currency/notes).

- [ ] **Step 1: Failing tests**

Add to `chosen-hospital.test.js`:
```js
import { changeChosenHospital, recordFeePaymentByTraveler } from "../../Src/Services/Cases/casesService.js";
import { createAccount } from "../helpers/factories.js";

describe("changeChosenHospital", () => {
  it("re-points the chosen hospital, keeps visa apps, NOT_SELECTs the old one", async () => {
    const user = await createUser();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    const visaBefore = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });

    await changeChosenHospital(kase.id, i2.id, { treatmentCostEstimate: 2, currency: "USD" }, chosenResponseFiles(), user.id);

    const inqs = await Prisma.hospitalInquiry.findMany({ where: { caseId: kase.id } });
    expect(inqs.find((i) => i.id === i1.id)).toMatchObject({ isChosen: false, status: "NOT_SELECTED" });
    expect(inqs.find((i) => i.id === i2.id)).toMatchObject({ isChosen: true, status: "ACCEPTED" });
    const visaAfter = await Prisma.visaApplication.findMany({ where: { caseId: kase.id } });
    expect(visaAfter.map((v) => v.id).sort()).toEqual(visaBefore.map((v) => v.id).sort());
  });

  it("is rejected once a visa fee has been paid", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const h1 = await createHospital();
    const h2 = await createHospital();
    const i1 = await sendInquiry(kase.id, { hospitalId: h1.id }, user.id);
    const i2 = await sendInquiry(kase.id, { hospitalId: h2.id }, user.id);
    await recordChosenResponse(kase.id, i1.id, { treatmentCostEstimate: 1, currency: "USD" }, chosenResponseFiles(), user.id);
    await recordFeePaymentByTraveler(kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id);

    await expect(
      changeChosenHospital(kase.id, i2.id, { treatmentCostEstimate: 2, currency: "USD" }, chosenResponseFiles(), user.id),
    ).rejects.toThrow(/cannot be changed after a visa fee has been paid/i);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement**

```js
export const changeChosenHospital = async (caseId, newInquiryId, data, files, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  if (kase.status === "CANCELLED") throw new AppError("This case has been cancelled", 400, "VALIDATION_ERROR");

  const current = await Prisma.hospitalInquiry.findFirst({ where: { caseId, isChosen: true } });
  if (!current) throw new AppError("This case has no chosen hospital yet", 400, "VALIDATION_ERROR");

  const paid = await Prisma.payment.findFirst({ where: { visaApplication: { caseId } } });
  if (paid) throw new AppError("The hospital cannot be changed after a visa fee has been paid", 400, "VALIDATION_ERROR");

  const next = await Prisma.hospitalInquiry.findUnique({ where: { id: newInquiryId } });
  if (!next || next.caseId !== caseId) throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  if (next.id === current.id) throw new AppError("That hospital is already the chosen one", 400, "VALIDATION_ERROR");
  if (!["PENDING", "NOT_SELECTED"].includes(next.status)) {
    throw new AppError("That inquiry cannot be chosen", 400, "VALIDATION_ERROR");
  }

  const { treatmentCostEstimate, currency, notes } = data;
  if (treatmentCostEstimate === undefined || treatmentCostEstimate === null || treatmentCostEstimate === "" || Number(treatmentCostEstimate) <= 0) {
    throw new AppError("A positive treatment cost estimate is required", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  const evaluationDoc = files?.evaluationDoc?.[0] ?? null;
  const invitationLetter = files?.invitationLetter?.[0] ?? null;
  if (!evaluationDoc) throw new AppError("An evaluation document is required", 400, "VALIDATION_ERROR");
  if (!invitationLetter) throw new AppError("An invitation letter is required", 400, "VALIDATION_ERROR");

  return Prisma.$transaction(async (tx) => {
    await tx.hospitalInquiry.update({ where: { id: current.id }, data: { isChosen: false, status: "NOT_SELECTED" } });
    await tx.hospitalInquiry.update({
      where: { id: next.id },
      data: { isChosen: true, status: "ACCEPTED", treatmentCostEstimate, currency, notes: notes || null, respondedAt: new Date() },
    });
    for (const [file, type] of [[evaluationDoc, "EVALUATION_DOC"], [invitationLetter, "INVITATION_LETTER"]]) {
      const documentId = crypto.randomUUID();
      const fileUrl = await saveDocumentLocal(file.buffer, caseId, documentId, file.mimetype);
      await tx.document.create({
        data: { id: documentId, caseId, hospitalInquiryId: next.id, type, fileName: file.originalname, fileUrl, uploadedById: userId },
      });
    }
    await tx.caseEvent.create({
      data: { caseId, type: "HOSPITAL_CHANGED", fromStatus: null, toStatus: "ACCEPTED", inquiryId: next.id, actorId: userId },
    });
    return tx.case.findUnique({ where: { id: caseId }, include: CASE_DETAIL_INCLUDE });
  }, { timeout: 30000 });
};
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Controller + route**

`casesController.js`:
```js
export const changeChosenHospitalCtrl = asyncHandler(async (req, res) => {
  const { newInquiryId, ...rest } = req.body;
  const kase = await changeChosenHospital(req.params.id, newInquiryId, rest, req.files ?? {}, req.user.id);
  return sendCreated(res, "Chosen hospital changed successfully", kase);
});
```
`casesRoute.js`:
```js
router.post(
  "/:id/chosen-hospital",
  RequirePermission("RECORD_HOSPITAL_RESPONSE"),
  uploadDocument.fields([
    { name: "evaluationDoc", maxCount: 1 },
    { name: "invitationLetter", maxCount: 1 },
  ]),
  changeChosenHospitalCtrl,
);
```

- [ ] **Step 6: Full suite + commit**

Run: `cd Server && npx vitest run`. Then:
```bash
cd Server
git add Src/Services/Cases/casesService.js Src/Controllers/Cases/casesController.js \
  Src/Routes/Cases/casesRoute.js tests/services/chosen-hospital.test.js
git commit -m "feat: changeChosenHospital (allowed until first visa fee)"
```

**— Phase 1 checkpoint: Part B is complete and independently testable. —**

---

## Task 6: Revenue register

**Files:**
- Create: `Server/Src/Services/Revenue/revenueService.js`, `Server/Src/Controllers/Revenue/revenueController.js`, `Server/Src/Routes/Revenue/revenueRoute.js`
- Modify: `Server/cmd/Server/Server.js`
- Test: `Server/tests/services/revenue.test.js`

**Interfaces:**
- Consumes: schema + ledger constants (Task 1).
- Produces:
  - `createRevenue(data, userId)` — `data = { category, amount, currency, accountId, receivedOn, caseId?, description? }`. `category ∈ {"HOSPITAL_REFERRAL_COMMISSION","OTHER_INCOME"}`. Creates `Revenue` + a credit `AccountTransaction` (`REVENUE_RECEIVED`, `revenueId` set, `occurredAt = receivedOn`) in one `$transaction`. Returns the revenue with `case`/`account`/`recordedBy` includes.
  - `listRevenue({ page, limit, caseId, category })` → `{ revenue, total, page, limit, totalPages }`.
  - HTTP `/api/v1/revenue`: `GET /` (`RequireAnyPermission(["VIEW_FINANCE","MANAGE_REVENUE"])`), `POST /` (`RequirePermission("MANAGE_REVENUE")`).

- [ ] **Step 1: Failing tests**

`Server/tests/services/revenue.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createRevenue, listRevenue } from "../../Src/Services/Revenue/revenueService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createCase } from "../helpers/factories.js";

const base = (o = {}) => ({ category: "OTHER_INCOME", amount: 250, currency: "USD", receivedOn: "2026-03-01", ...o });

describe("createRevenue", () => {
  it("records revenue and credits the account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const rev = await createRevenue(base({ accountId: account.id, description: "Sponsorship" }), user.id);
    expect(rev.category).toBe("OTHER_INCOME");
    expect(Number(rev.amount)).toBe(250);
    expect(rev.recordedById).toBe(user.id);
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(250);
    const txn = await Prisma.accountTransaction.findFirst({ where: { revenueId: rev.id } });
    expect(txn.type).toBe("REVENUE_RECEIVED");
  });

  it("links referral commission to a case", async () => {
    const user = await createUser();
    const account = await createAccount();
    const kase = await createCase();
    const rev = await createRevenue(
      base({ category: "HOSPITAL_REFERRAL_COMMISSION", accountId: account.id, caseId: kase.id }), user.id,
    );
    expect(rev.caseId).toBe(kase.id);
  });

  it("rejects a bad category, currency, amount, and unknown account/case", async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createRevenue(base({ category: "NOPE", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ currency: "GBP", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ amount: 0, accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createRevenue(base({ accountId: "nope" }), user.id)).rejects.toThrow("Account not found");
    await expect(createRevenue(base({ accountId: account.id, caseId: "nope" }), user.id)).rejects.toThrow("Case not found");
  });
});

describe("listRevenue", () => {
  it("filters by category", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createRevenue(base({ category: "OTHER_INCOME", accountId: account.id }), user.id);
    await createRevenue(base({ category: "HOSPITAL_REFERRAL_COMMISSION", accountId: account.id }), user.id);
    const res = await listRevenue({ page: 1, limit: 20, category: "HOSPITAL_REFERRAL_COMMISSION" });
    expect(res.revenue).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `revenueService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const CURRENCIES = ["USD", "INR"];
const CATEGORIES = ["HOSPITAL_REFERRAL_COMMISSION", "OTHER_INCOME"];

const INCLUDE = {
  case: { select: { id: true, caseNumber: true } },
  account: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const createRevenue = async (data, userId) => {
  const { category, amount, currency, accountId, caseId, description, receivedOn } = data;

  if (!CATEGORIES.includes(category)) {
    throw new AppError(`category must be one of: ${CATEGORIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  }
  if (!receivedOn) throw new AppError("receivedOn is required", 400, "VALIDATION_ERROR");
  const received = new Date(receivedOn);
  if (Number.isNaN(received.getTime())) throw new AppError("receivedOn is not a valid date", 400, "VALIDATION_ERROR");

  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");
  if (caseId) {
    const kase = await Prisma.case.findUnique({ where: { id: caseId } });
    if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  return Prisma.revenue.create({
    data: {
      category,
      amount,
      currency,
      description: description?.trim() || null,
      receivedOn: received,
      case: caseId ? { connect: { id: caseId } } : undefined,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "REVENUE_RECEIVED",
          amount,
          currency,
          notes: description?.trim() || null,
          createdById: userId,
          occurredAt: received,
        },
      },
    },
    include: INCLUDE,
  });
};

export const listRevenue = async ({ page = 1, limit = 20, caseId, category } = {}) => {
  const where = {};
  if (caseId) where.caseId = caseId;
  if (category) where.category = category;
  const [revenue, total] = await Promise.all([
    Prisma.revenue.findMany({ where, include: INCLUDE, orderBy: { receivedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.revenue.count({ where }),
  ]);
  return { revenue, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Controller + route + mount**

`revenueController.js`:
```js
import asyncHandler from "express-async-handler";
import { createRevenue, listRevenue } from "../../Services/Revenue/revenueService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listRevenueCtrl = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const result = await listRevenue({ page, limit, caseId: req.query.caseId, category: req.query.category });
  return sendSuccess(res, "Revenue retrieved successfully", result);
});

export const createRevenueCtrl = asyncHandler(async (req, res) => {
  const revenue = await createRevenue(req.body, req.user.id);
  return sendCreated(res, "Revenue recorded successfully", revenue);
});
```
`revenueRoute.js`:
```js
import express from "express";
import { listRevenueCtrl, createRevenueCtrl } from "../../Controllers/Revenue/revenueController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();
router.use(Verify);
router.get("/", RequireAnyPermission(["VIEW_FINANCE", "MANAGE_REVENUE"]), listRevenueCtrl);
router.post("/", RequirePermission("MANAGE_REVENUE"), createRevenueCtrl);
export default router;
```
`Server.js`: `import revenueRoutes from "../../Src/Routes/Revenue/revenueRoute.js";` (match the existing import style/path) and `Server.use("/api/v1/revenue", revenueRoutes);` after the `/expenses` line.

- [ ] **Step 6: Full suite + commit**

```bash
cd Server
git add Src/Services/Revenue Src/Controllers/Revenue Src/Routes/Revenue cmd/Server/Server.js \
  tests/services/revenue.test.js
git commit -m "feat: revenue register"
```

---

## Task 7: `loanProjection` — pure interest & outstanding math

**Files:**
- Create: `Server/Src/Services/Loans/loanProjection.js`
- Test: `Server/tests/services/loan-projection.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `loanProjection(loan, repayments, asOf = new Date())` → `{ accruedInterest, totalRepaid, outstanding, isOverdue }`, all numbers rounded to 2dp.
  - `loan`: `{ principal, interestRatePct, interestMethod, disbursedOn, termMonths, dueOn }` (Decimal fields may arrive as `Decimal`/`string`/`number` — coerce with `Number()`). `repayments`: `[{ amount }]`.
  - `SIMPLE`: `accruedInterest = principal * (rate/100) * elapsedYears`, `elapsedYears` clamped to `[0, termMonths/12]`.
  - `COMPOUND_MONTHLY`: `months = clamp(floor(elapsedMonths), 0, termMonths)`; `accruedInterest = principal * ((1 + rate/100/12)^months - 1)`.
  - `outstanding = max(0, round2(principal + accruedInterest - totalRepaid))`.
  - `isOverdue = asOf > dueOn && outstanding > 0`.

- [ ] **Step 1: Failing tests**

`Server/tests/services/loan-projection.test.js`:
```js
import { describe, it, expect } from "vitest";
import { loanProjection } from "../../Src/Services/Loans/loanProjection.js";

const loan = (o = {}) => ({
  principal: 1000, interestRatePct: 12, interestMethod: "SIMPLE",
  disbursedOn: new Date("2026-01-01"), termMonths: 12, dueOn: new Date("2027-01-01"), ...o,
});

describe("loanProjection", () => {
  it("SIMPLE: no interest at disbursement", () => {
    const p = loanProjection(loan(), [], new Date("2026-01-01"));
    expect(p.accruedInterest).toBe(0);
    expect(p.outstanding).toBe(1000);
  });

  it("SIMPLE: half a year → half the annual interest", () => {
    const p = loanProjection(loan(), [], new Date("2026-07-01"));
    expect(p.accruedInterest).toBeCloseTo(60, 1); // 1000 * 0.12 * 0.5
    expect(p.outstanding).toBeCloseTo(1060, 1);
  });

  it("SIMPLE: interest stops accruing after the term", () => {
    const p = loanProjection(loan(), [], new Date("2030-01-01"));
    expect(p.accruedInterest).toBeCloseTo(120, 1); // full-term only
  });

  it("COMPOUND_MONTHLY: 3 months", () => {
    const p = loanProjection(loan({ interestMethod: "COMPOUND_MONTHLY" }), [], new Date("2026-04-01"));
    // 1000 * ((1 + 0.01)^3 - 1) ≈ 30.30
    expect(p.accruedInterest).toBeCloseTo(30.3, 1);
  });

  it("repayments reduce outstanding; overdue flag", () => {
    const p = loanProjection(loan(), [{ amount: 400 }, { amount: 300 }], new Date("2027-06-01"));
    expect(p.totalRepaid).toBe(700);
    expect(p.outstanding).toBeCloseTo(1000 + 120 - 700, 1);
    expect(p.isOverdue).toBe(true);
  });

  it("not overdue once outstanding hits zero", () => {
    const p = loanProjection(loan(), [{ amount: 2000 }], new Date("2030-01-01"));
    expect(p.outstanding).toBe(0);
    expect(p.isOverdue).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `loanProjection.js`**

```js
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const MS_PER_DAY = 86_400_000;

export const loanProjection = (loan, repayments = [], asOf = new Date()) => {
  const principal = Number(loan.principal);
  const rate = Number(loan.interestRatePct) / 100;
  const disbursedOn = new Date(loan.disbursedOn);
  const dueOn = new Date(loan.dueOn);
  const termMonths = Number(loan.termMonths);

  const elapsedDays = Math.max(0, (asOf.getTime() - disbursedOn.getTime()) / MS_PER_DAY);
  const elapsedYears = Math.min(elapsedDays / 365, termMonths / 12);
  const elapsedMonths = Math.min(Math.floor(elapsedDays / (365 / 12)), termMonths);

  let accruedInterest;
  if (loan.interestMethod === "COMPOUND_MONTHLY") {
    accruedInterest = principal * (Math.pow(1 + rate / 12, Math.max(0, elapsedMonths)) - 1);
  } else {
    accruedInterest = principal * rate * Math.max(0, elapsedYears);
  }

  const totalRepaid = repayments.reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = Math.max(0, round2(principal + accruedInterest - totalRepaid));

  return {
    accruedInterest: round2(accruedInterest),
    totalRepaid: round2(totalRepaid),
    outstanding,
    isOverdue: asOf.getTime() > dueOn.getTime() && outstanding > 0,
  };
};
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
cd Server
git add Src/Services/Loans/loanProjection.js tests/services/loan-projection.test.js
git commit -m "feat: loanProjection interest & outstanding math"
```

---

## Task 8: Loans service (create, repay, list, detail)

**Files:**
- Create: `Server/Src/Services/Loans/loansService.js`, `Server/Src/Controllers/Loans/loansController.js`, `Server/Src/Routes/Loans/loansRoute.js`
- Modify: `Server/cmd/Server/Server.js`
- Test: `Server/tests/services/loans.test.js`

**Interfaces:**
- Consumes: `loanProjection` (Task 7).
- Produces:
  - `createLoan(data, userId)` — `data = { lenderName, principal, currency, interestRatePct, interestMethod, disbursedOn, termMonths, notes? }`. Computes `dueOn = disbursedOn + termMonths months`. One `$transaction`: `Loan` + credit `AccountTransaction` (`LOAN_RECEIVED`, `loanId` set). `data.accountId` required (where the principal landed).
  - `recordLoanRepayment(loanId, data, userId)` — `data = { amount, paidOn, accountId }`. Rejects a `SETTLED` loan. One `$transaction`: `LoanRepayment` + debit `AccountTransaction` (`LOAN_REPAYMENT`, `loanRepaymentId` set). After commit, recompute `loanProjection` as of `paidOn`; if `outstanding <= 0`, set `Loan.status = "SETTLED"`.
  - `listLoans({ page, limit, status })` → `{ loans, total, page, limit, totalPages }`, each loan carrying a `projection` (as of now).
  - `getLoanById(id)` → the loan + `repayments` (ordered by `paidOn`) + `projection`.
  - HTTP `/api/v1/loans`: `GET /` (`RequireAnyPermission(["VIEW_FINANCE","MANAGE_LOANS"])`), `GET /:id` (same), `POST /` and `POST /:id/repayments` (`RequirePermission("MANAGE_LOANS")`).

- [ ] **Step 1: Failing tests**

`Server/tests/services/loans.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createLoan, recordLoanRepayment, listLoans, getLoanById } from "../../Src/Services/Loans/loansService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount } from "../helpers/factories.js";

const base = (o = {}) => ({
  lenderName: "Bank X", principal: 1000, currency: "USD", interestRatePct: 12,
  interestMethod: "SIMPLE", disbursedOn: "2026-01-01", termMonths: 12, ...o,
});

describe("createLoan", () => {
  it("stores terms, computes dueOn, credits the account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    expect(new Date(loan.dueOn).toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(loan.status).toBe("ACTIVE");
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(1000);
    const txn = await Prisma.accountTransaction.findFirst({ where: { loanId: loan.id } });
    expect(txn.type).toBe("LOAN_RECEIVED");
  });

  it("rejects bad amount / currency / method", async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createLoan(base({ principal: 0, accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createLoan(base({ currency: "GBP", accountId: account.id }), user.id)).rejects.toThrow(AppError);
    await expect(createLoan(base({ interestMethod: "WEEKLY", accountId: account.id }), user.id)).rejects.toThrow(AppError);
  });
});

describe("recordLoanRepayment", () => {
  it("debits the account and settles the loan when paid off", async () => {
    const user = await createUser();
    const account = await createAccount({ });
    // seed the account so it can go negative-free is not required; balances may go negative
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    await recordLoanRepayment(loan.id, { amount: 500, paidOn: "2026-06-01", accountId: account.id }, user.id);
    let fresh = await getLoanById(loan.id);
    expect(fresh.status).toBe("ACTIVE");
    expect(fresh.repayments).toHaveLength(1);

    await recordLoanRepayment(loan.id, { amount: 1000, paidOn: "2027-02-01", accountId: account.id }, user.id);
    fresh = await getLoanById(loan.id);
    expect(fresh.status).toBe("SETTLED");
    expect(fresh.projection.outstanding).toBe(0);
  });

  it("rejects a repayment on a settled loan", async () => {
    const user = await createUser();
    const account = await createAccount();
    const loan = await createLoan(base({ accountId: account.id }), user.id);
    await recordLoanRepayment(loan.id, { amount: 5000, paidOn: "2027-02-01", accountId: account.id }, user.id);
    await expect(
      recordLoanRepayment(loan.id, { amount: 1, paidOn: "2027-03-01", accountId: account.id }, user.id),
    ).rejects.toThrow(/already settled/i);
  });
});

describe("listLoans", () => {
  it("filters by status and carries a projection", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createLoan(base({ accountId: account.id }), user.id);
    const res = await listLoans({ page: 1, limit: 20, status: "ACTIVE" });
    expect(res.loans[0].projection).toHaveProperty("outstanding");
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `loansService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { loanProjection } from "./loanProjection.js";

const CURRENCIES = ["USD", "INR"];
const METHODS = ["SIMPLE", "COMPOUND_MONTHLY"];

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const LOAN_INCLUDE = {
  account: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
  repayments: { orderBy: { paidOn: "asc" }, include: { account: { select: { id: true, name: true } } } },
};

export const createLoan = async (data, userId) => {
  const { lenderName, principal, currency, interestRatePct, interestMethod, disbursedOn, termMonths, notes, accountId } = data;

  if (!lenderName?.trim()) throw new AppError("lenderName is required", 400, "VALIDATION_ERROR");
  if (principal === undefined || principal === null || principal === "" || Number(principal) <= 0) {
    throw new AppError("principal must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  if (interestRatePct === undefined || interestRatePct === null || interestRatePct === "" || Number(interestRatePct) < 0) {
    throw new AppError("interestRatePct must be zero or a positive number", 400, "VALIDATION_ERROR");
  }
  if (!METHODS.includes(interestMethod)) throw new AppError(`interestMethod must be one of: ${METHODS.join(", ")}`, 400, "VALIDATION_ERROR");
  if (!Number.isInteger(Number(termMonths)) || Number(termMonths) <= 0) {
    throw new AppError("termMonths must be a positive whole number", 400, "VALIDATION_ERROR");
  }
  const disbursed = new Date(disbursedOn);
  if (Number.isNaN(disbursed.getTime())) throw new AppError("disbursedOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const dueOn = addMonths(disbursed, Number(termMonths));

  return Prisma.loan.create({
    data: {
      lenderName: lenderName.trim(),
      principal,
      currency,
      interestRatePct,
      interestMethod,
      disbursedOn: disbursed,
      termMonths: Number(termMonths),
      dueOn,
      notes: notes?.trim() || null,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "LOAN_RECEIVED",
          amount: principal,
          currency,
          notes: `Loan from ${lenderName.trim()}`,
          createdById: userId,
          occurredAt: disbursed,
        },
      },
    },
    include: LOAN_INCLUDE,
  });
};

export const recordLoanRepayment = async (loanId, data, userId) => {
  const { amount, paidOn, accountId } = data;
  const loan = await Prisma.loan.findUnique({ where: { id: loanId }, include: { repayments: true } });
  if (!loan) throw new AppError("Loan not found", 404, "NOT_FOUND");
  if (loan.status === "SETTLED") throw new AppError("This loan is already settled", 400, "VALIDATION_ERROR");
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  const paid = new Date(paidOn);
  if (Number.isNaN(paid.getTime())) throw new AppError("paidOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const repayment = await Prisma.loanRepayment.create({
    data: {
      loan: { connect: { id: loanId } },
      amount,
      paidOn: paid,
      account: { connect: { id: accountId } },
      recordedBy: { connect: { id: userId } },
      accountTransaction: {
        create: {
          accountId,
          type: "LOAN_REPAYMENT",
          amount,
          currency: loan.currency,
          notes: `Repayment to ${loan.lenderName}`,
          createdById: userId,
          occurredAt: paid,
        },
      },
    },
  });

  const projection = loanProjection(loan, [...loan.repayments, { amount }], paid);
  if (projection.outstanding <= 0) {
    await Prisma.loan.update({ where: { id: loanId }, data: { status: "SETTLED" } });
  }
  return repayment;
};

export const listLoans = async ({ page = 1, limit = 20, status } = {}) => {
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    Prisma.loan.findMany({ where, include: LOAN_INCLUDE, orderBy: { disbursedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.loan.count({ where }),
  ]);
  const loans = rows.map((l) => ({ ...l, projection: loanProjection(l, l.repayments) }));
  return { loans, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

export const getLoanById = async (id) => {
  const loan = await Prisma.loan.findUnique({ where: { id }, include: LOAN_INCLUDE });
  if (!loan) throw new AppError("Loan not found", 404, "NOT_FOUND");
  return { ...loan, projection: loanProjection(loan, loan.repayments) };
};
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Controller + route + mount**

`loansController.js`:
```js
import asyncHandler from "express-async-handler";
import { createLoan, recordLoanRepayment, listLoans, getLoanById } from "../../Services/Loans/loansService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

const paging = (req) => ({
  page: Math.max(1, parseInt(req.query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)),
});

export const listLoansCtrl = asyncHandler(async (req, res) => {
  const result = await listLoans({ ...paging(req), status: req.query.status });
  return sendSuccess(res, "Loans retrieved successfully", result);
});
export const getLoanCtrl = asyncHandler(async (req, res) => {
  const loan = await getLoanById(req.params.id);
  return sendSuccess(res, "Loan retrieved successfully", loan);
});
export const createLoanCtrl = asyncHandler(async (req, res) => {
  const loan = await createLoan(req.body, req.user.id);
  return sendCreated(res, "Loan recorded successfully", loan);
});
export const recordLoanRepaymentCtrl = asyncHandler(async (req, res) => {
  const repayment = await recordLoanRepayment(req.params.id, req.body, req.user.id);
  return sendCreated(res, "Repayment recorded successfully", repayment);
});
```
`loansRoute.js`:
```js
import express from "express";
import { listLoansCtrl, getLoanCtrl, createLoanCtrl, recordLoanRepaymentCtrl } from "../../Controllers/Loans/loansController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();
router.use(Verify);
const READ = RequireAnyPermission(["VIEW_FINANCE", "MANAGE_LOANS"]);
router.get("/", READ, listLoansCtrl);
router.get("/:id", READ, getLoanCtrl);
router.post("/", RequirePermission("MANAGE_LOANS"), createLoanCtrl);
router.post("/:id/repayments", RequirePermission("MANAGE_LOANS"), recordLoanRepaymentCtrl);
export default router;
```
`Server.js`: mount `Server.use("/api/v1/loans", loansRoutes);`.

- [ ] **Step 6: Full suite + commit**

```bash
cd Server
git add Src/Services/Loans Src/Controllers/Loans Src/Routes/Loans cmd/Server/Server.js tests/services/loans.test.js
git commit -m "feat: loans with terms, repayments, and computed balances"
```

---

## Task 9: Payables register

**Files:**
- Create: `Server/Src/Services/Payables/payablesService.js`, `Server/Src/Controllers/Payables/payablesController.js`, `Server/Src/Routes/Payables/payablesRoute.js`
- Modify: `Server/cmd/Server/Server.js`
- Test: `Server/tests/services/payables.test.js`

**Interfaces:**
- Produces:
  - `createPayable(data, userId)` — `data = { payeeName, amount, currency, reason, raisedOn, caseId? }`. Creates the `Payable` only (no ledger movement). `caseId` (if given) must exist.
  - `settlePayable(id, data, userId)` — `data = { accountId, paidOn }`. Rejects a `SETTLED` payable. One `$transaction`: debit `AccountTransaction` (`PAYABLE_SETTLED`, `payableId` set) + set `status = "SETTLED"`, `settledOn`.
  - `listPayables({ page, limit, status, caseId })` → `{ payables, total, page, limit, totalPages }`.
  - HTTP `/api/v1/payables`: `GET /` (`RequireAnyPermission(["VIEW_FINANCE","MANAGE_PAYABLES"])`), `POST /` and `POST /:id/settle` (`RequirePermission("MANAGE_PAYABLES")`).

- [ ] **Step 1: Failing tests**

`Server/tests/services/payables.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { createPayable, settlePayable, listPayables } from "../../Src/Services/Payables/payablesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { createUser, createAccount, createCase } from "../helpers/factories.js";

const base = (o = {}) => ({ payeeName: "Ali", amount: 300, currency: "USD", reason: "Overpayment", raisedOn: "2026-03-01", ...o });

describe("payables", () => {
  it("creates a payable with no ledger movement", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p = await createPayable(base(), user.id);
    expect(p.status).toBe("OUTSTANDING");
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(0);
  });

  it("links to a case when given", async () => {
    const user = await createUser();
    const kase = await createCase();
    const p = await createPayable(base({ caseId: kase.id }), user.id);
    expect(p.caseId).toBe(kase.id);
  });

  it("settles from an account and cannot be settled twice", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p = await createPayable(base(), user.id);
    await settlePayable(p.id, { accountId: account.id, paidOn: "2026-03-15" }, user.id);
    const fresh = await Prisma.payable.findUnique({ where: { id: p.id } });
    expect(fresh.status).toBe("SETTLED");
    expect(fresh.settledOn).not.toBeNull();
    const balances = await getAccountBalances(account.id);
    expect(balances.USD).toBe(-300);
    await expect(settlePayable(p.id, { accountId: account.id, paidOn: "2026-03-16" }, user.id)).rejects.toThrow(/already settled/i);
  });

  it("rejects a bad amount / currency and unknown case/account", async () => {
    const user = await createUser();
    await expect(createPayable(base({ amount: 0 }), user.id)).rejects.toThrow(AppError);
    await expect(createPayable(base({ currency: "GBP" }), user.id)).rejects.toThrow(AppError);
    await expect(createPayable(base({ caseId: "nope" }), user.id)).rejects.toThrow("Case not found");
    const p = await createPayable(base(), user.id);
    await expect(settlePayable(p.id, { accountId: "nope", paidOn: "2026-03-15" }, user.id)).rejects.toThrow("Account not found");
  });
});

describe("listPayables", () => {
  it("filters by status", async () => {
    const user = await createUser();
    const account = await createAccount();
    const p1 = await createPayable(base(), user.id);
    await createPayable(base(), user.id);
    await settlePayable(p1.id, { accountId: account.id, paidOn: "2026-03-15" }, user.id);
    const res = await listPayables({ page: 1, limit: 20, status: "OUTSTANDING" });
    expect(res.payables).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `payablesService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const CURRENCIES = ["USD", "INR"];

const INCLUDE = {
  case: { select: { id: true, caseNumber: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
  accountTransaction: { select: { account: { select: { id: true, name: true } } } },
};

export const createPayable = async (data, userId) => {
  const { payeeName, amount, currency, reason, raisedOn, caseId } = data;
  if (!payeeName?.trim()) throw new AppError("payeeName is required", 400, "VALIDATION_ERROR");
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }
  if (!CURRENCIES.includes(currency)) throw new AppError(`currency must be one of: ${CURRENCIES.join(", ")}`, 400, "VALIDATION_ERROR");
  if (!reason?.trim()) throw new AppError("reason is required", 400, "VALIDATION_ERROR");
  const raised = new Date(raisedOn);
  if (Number.isNaN(raised.getTime())) throw new AppError("raisedOn is not a valid date", 400, "VALIDATION_ERROR");
  if (caseId) {
    const kase = await Prisma.case.findUnique({ where: { id: caseId } });
    if (!kase) throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  return Prisma.payable.create({
    data: {
      payeeName: payeeName.trim(),
      amount,
      currency,
      reason: reason.trim(),
      raisedOn: raised,
      case: caseId ? { connect: { id: caseId } } : undefined,
      recordedBy: { connect: { id: userId } },
    },
    include: INCLUDE,
  });
};

export const settlePayable = async (id, data, userId) => {
  const { accountId, paidOn } = data;
  const payable = await Prisma.payable.findUnique({ where: { id } });
  if (!payable) throw new AppError("Payable not found", 404, "NOT_FOUND");
  if (payable.status === "SETTLED") throw new AppError("This payable is already settled", 400, "VALIDATION_ERROR");
  const paid = new Date(paidOn);
  if (Number.isNaN(paid.getTime())) throw new AppError("paidOn is not a valid date", 400, "VALIDATION_ERROR");
  if (!accountId) throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  const [, updated] = await Prisma.$transaction([
    Prisma.accountTransaction.create({
      data: {
        accountId,
        type: "PAYABLE_SETTLED",
        amount: payable.amount,
        currency: payable.currency,
        notes: `Settled payable to ${payable.payeeName}`,
        createdById: userId,
        occurredAt: paid,
        payableId: id,
      },
    }),
    Prisma.payable.update({ where: { id }, data: { status: "SETTLED", settledOn: paid }, include: INCLUDE }),
  ]);
  return updated;
};

export const listPayables = async ({ page = 1, limit = 20, status, caseId } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (caseId) where.caseId = caseId;
  const [payables, total] = await Promise.all([
    Prisma.payable.findMany({ where, include: INCLUDE, orderBy: { raisedOn: "desc" }, skip: (page - 1) * limit, take: limit }),
    Prisma.payable.count({ where }),
  ]);
  return { payables, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};
```
Note: `Prisma.accountTransaction.create` here uses a raw scalar `payableId` (not a nested `connect`) because the `AccountTransaction` create has no *sibling nested relation write* in this call — the same reason `accountsService.createAccount` uses raw scalars for opening balances. This is fine.

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Controller + route + mount**

`payablesController.js`:
```js
import asyncHandler from "express-async-handler";
import { createPayable, settlePayable, listPayables } from "../../Services/Payables/payablesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listPayablesCtrl = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const result = await listPayables({ page, limit, status: req.query.status, caseId: req.query.caseId });
  return sendSuccess(res, "Payables retrieved successfully", result);
});
export const createPayableCtrl = asyncHandler(async (req, res) => {
  const payable = await createPayable(req.body, req.user.id);
  return sendCreated(res, "Payable recorded successfully", payable);
});
export const settlePayableCtrl = asyncHandler(async (req, res) => {
  const payable = await settlePayable(req.params.id, req.body, req.user.id);
  return sendSuccess(res, "Payable settled successfully", payable);
});
```
`payablesRoute.js`:
```js
import express from "express";
import { listPayablesCtrl, createPayableCtrl, settlePayableCtrl } from "../../Controllers/Payables/payablesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();
router.use(Verify);
router.get("/", RequireAnyPermission(["VIEW_FINANCE", "MANAGE_PAYABLES"]), listPayablesCtrl);
router.post("/", RequirePermission("MANAGE_PAYABLES"), createPayableCtrl);
router.post("/:id/settle", RequirePermission("MANAGE_PAYABLES"), settlePayableCtrl);
export default router;
```
`Server.js`: mount `Server.use("/api/v1/payables", payablesRoutes);`.

- [ ] **Step 6: Full suite + commit**

```bash
cd Server
git add Src/Services/Payables Src/Controllers/Payables Src/Routes/Payables cmd/Server/Server.js tests/services/payables.test.js
git commit -m "feat: payables register with settle-from-account"
```

---

## Task 10: Embassy-partnership commission on the embassy visit

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js` (`markEmbassyVisited`)
- Modify: `Server/Src/Services/Expenses/expensesService.js` (export the category constant)
- Modify: `Server/Src/Controllers/Cases/casesController.js` (already passes `req.body` — verify)
- Test: `Server/tests/services/embassy-commission.test.js`

**Interfaces:**
- Consumes: existing `markEmbassyVisited`, `Expense` model.
- Produces:
  - `expensesService.EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY = "Embassy partnership commission"` (exported string).
  - `markEmbassyVisited(caseId, visaApplicationId, data, userId)` — `data` gains optional `partnerCommission: { amount, accountId }`. When present (amount > 0): the same `$transaction` that flips the visa app to `EMBASSY_VISITED` also creates an `Expense` (that category, `caseId` + `visaApplicationId` connected) with its `EXPENSE_PAID` `AccountTransaction`. When absent or amount blank/zero: behaviour unchanged.
  - Validation (before the transaction): if `partnerCommission` present, `Number(amount) > 0` and `accountId` names a real account, else `400`.

- [ ] **Step 1: Failing tests**

`Server/tests/services/embassy-commission.test.js`:
```js
import { describe, it, expect } from "vitest";
import Prisma from "../../Src/Config/Prisma/db.js";
import { markEmbassyVisited, recordFeePaymentByTraveler } from "../../Src/Services/Cases/casesService.js";
import { getAccountBalances } from "../../Src/Services/Accounts/accountsService.js";
import { EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY } from "../../Src/Services/Expenses/expensesService.js";
import { createUser, createAccount, createCase, createHospital, recordChosenResponseFor } from "../helpers/factories.js";

const readyForEmbassy = async (user, account) => {
  const kase = await createCase();
  await recordChosenResponseFor(kase.id, { user });
  const visa = await recordFeePaymentByTraveler(kase.id, { travelerType: "PATIENT", accountId: account.id, amount: 100 }, user.id);
  return { kase, visaId: visa.id };
};

describe("markEmbassyVisited — partner commission", () => {
  it("records a commission expense in the same step", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);

    await markEmbassyVisited(
      kase.id, visaId,
      { embassyVisitDate: "2026-04-01", partnerCommission: { amount: 40, accountId: account.id } },
      user.id,
    );

    const expense = await Prisma.expense.findFirst({ where: { visaApplicationId: visaId, category: EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY } });
    expect(expense).not.toBeNull();
    expect(Number(expense.amount)).toBe(40);
    const balances = await getAccountBalances(account.id);
    // +100 fee - 40 commission = 60
    expect(balances.USD).toBe(60);
  });

  it("works with no commission (unchanged path)", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    const updated = await markEmbassyVisited(kase.id, visaId, { embassyVisitDate: "2026-04-01" }, user.id);
    expect(updated.status).toBe("EMBASSY_VISITED");
    const expense = await Prisma.expense.findFirst({ where: { visaApplicationId: visaId } });
    expect(expense).toBeNull();
  });

  it("rejects a commission with no account", async () => {
    const user = await createUser();
    const account = await createAccount();
    const { kase, visaId } = await readyForEmbassy(user, account);
    await expect(
      markEmbassyVisited(kase.id, visaId, { embassyVisitDate: "2026-04-01", partnerCommission: { amount: 40 } }, user.id),
    ).rejects.toThrow(/account/i);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement**

`expensesService.js` — add near the top: `export const EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY = "Embassy partnership commission";`

`markEmbassyVisited` — after the `embassyVisitDate` check, add:
```js
  const commission = data.partnerCommission;
  let commissionAccount = null;
  if (commission && commission.amount !== undefined && commission.amount !== null && commission.amount !== "" && Number(commission.amount) > 0) {
    if (!commission.accountId) throw new AppError("A commission account is required", 400, "VALIDATION_ERROR");
    commissionAccount = await Prisma.account.findUnique({ where: { id: commission.accountId } });
    if (!commissionAccount) throw new AppError("Commission account not found", 404, "NOT_FOUND");
  }
```
Then add the expense op to the existing `$transaction` array (after the `caseEventOp`):
```js
    ...(commissionAccount
      ? [
          Prisma.expense.create({
            data: {
              category: EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY,
              amount: commission.amount,
              currency: "USD",
              case: { connect: { id: caseId } },
              visaApplication: { connect: { id: visaApplicationId } },
              paidBy: { connect: { id: userId } },
              accountTransaction: {
                create: {
                  accountId: commission.accountId,
                  type: "EXPENSE_PAID",
                  amount: commission.amount,
                  currency: "USD",
                  notes: "Embassy partnership commission",
                  createdById: userId,
                },
              },
            },
          }),
        ]
      : []),
```
Import `EMBASSY_PARTNERSHIP_COMMISSION_CATEGORY` from `../Expenses/expensesService.js` at the top of `casesService.js`.

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Full suite + commit**

```bash
cd Server
git add Src/Services/Cases/casesService.js Src/Services/Expenses/expensesService.js tests/services/embassy-commission.test.js
git commit -m "feat: embassy-partnership commission recorded with the embassy visit"
```

---

## Task 11: `getFinanceStats` — outstanding loans + payables

**Files:**
- Modify: `Server/Src/Services/Dashboard/dashboardService.js`
- Test: `Server/tests/services/dashboard.test.js` (create/extend)

**Interfaces:**
- Consumes: `loanProjection` (Task 7).
- Produces: `getFinanceStats()` return gains `outstandingLoans: Record<Currency, number>` and `outstandingPayables: Record<Currency, number>` (existing `totalBalances`, `accountCount` unchanged).

- [ ] **Step 1: Failing test**

`Server/tests/services/dashboard.test.js`:
```js
import { describe, it, expect } from "vitest";
import { getFinanceStats } from "../../Src/Services/Dashboard/dashboardService.js";
import { createUser, createAccount, createLoan, createPayable } from "../helpers/factories.js";

describe("getFinanceStats — obligations", () => {
  it("sums outstanding loans and payables by currency", async () => {
    const user = await createUser();
    const account = await createAccount();
    await createLoan({ accountId: account.id, recordedById: user.id, principal: 1000, interestRatePct: 0, currency: "USD" });
    await createPayable({ recordedById: user.id, amount: 250, currency: "USD" });

    const stats = await getFinanceStats();
    expect(stats.outstandingLoans.USD).toBeCloseTo(1000, 1);
    expect(stats.outstandingPayables.USD).toBe(250);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement**

In `dashboardService.js`, import `loanProjection` and extend `getFinanceStats`:
```js
  const [loans, payables] = await Promise.all([
    Prisma.loan.findMany({ where: { status: "ACTIVE" }, include: { repayments: true } }),
    Prisma.payable.findMany({ where: { status: "OUTSTANDING" } }),
  ]);

  const outstandingLoans = {};
  const outstandingPayables = {};
  for (const currency of FINANCE_CURRENCIES) {
    outstandingLoans[currency] = 0;
    outstandingPayables[currency] = 0;
  }
  for (const loan of loans) {
    outstandingLoans[loan.currency] = (outstandingLoans[loan.currency] || 0) + loanProjection(loan, loan.repayments).outstanding;
  }
  for (const p of payables) {
    outstandingPayables[p.currency] = (outstandingPayables[p.currency] || 0) + Number(p.amount);
  }

  return { totalBalances, accountCount: accounts.length, outstandingLoans, outstandingPayables };
```
(`Prisma` is already imported in that file.)

- [ ] **Step 4: Run — passes; full suite green**

- [ ] **Step 5: Commit**

```bash
cd Server
git add Src/Services/Dashboard/dashboardService.js tests/services/dashboard.test.js
git commit -m "feat: dashboard finance stats include outstanding loans and payables"
```

**— Phase 2 checkpoint: Part C backend is complete. —**

---

## Phase 3 — Frontend

Frontend has **no test framework**. Every frontend task's verification is: `cd aster && npx tsc --noEmit` (only the two pre-existing `components/ui/{calendar,rich-text-editor}.tsx` failures remain) and `npm run lint` (73 problems, unchanged). Confirm both against baseline before each commit. UI follows the established pattern: `usePermissionGuard` at the top of a page, `PageHeader`, a table component, `ListPagination` + `usePagination`, a `*FormDialog` using `useForm` + a zod schema's `safeParse` in the submit handler + `form.setError` loop (see `aster/components/cases/embassy-visit-dialog.tsx` and `aster/app/dashboard/expenses/page.tsx` for the exact shape to mirror).

---

## Task 12: Frontend foundation — types & services

**Files:**
- Create: `aster/types/revenue.ts`, `aster/types/loan.ts`, `aster/types/payable.ts`
- Create: `aster/services/revenue.ts`, `aster/services/loans.ts`, `aster/services/payables.ts`
- Modify: `aster/types/case.ts`, `aster/types/hospital.ts`, `aster/types/document.ts`
- Modify: `aster/services/cases.ts`, `aster/services/hospitals.ts`

**Interfaces:**
- Produces (consumed by Tasks 13–17):
  - `types/hospital.ts`: `Hospital` gains `country: string`.
  - `types/document.ts`: `DocumentType` union gains `"EVALUATION_DOC"`.
  - `types/case.ts`: `HospitalInquiryStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "NOT_SELECTED"`; `HospitalInquiry` gains `isChosen: boolean`, `treatmentCostEstimate: string | null`, `currency: "USD" | "INR" | null`, `documents: CaseDocument[]`.
  - `services/hospitals.ts`: `HospitalPayload` gains `country: string`.
  - `services/cases.ts`:
    - `recordChosenResponse(caseId: string, inquiryId: string, payload: FormData): Promise<Case>` → `POST /cases/:id/inquiries/:inquiryId/response`
    - `changeChosenHospital(caseId: string, payload: FormData): Promise<Case>` → `POST /cases/:id/chosen-hospital`
    - `declineInquiry(caseId: string, inquiryId: string, notes?: string): Promise<HospitalInquiry>` → `PATCH /cases/:id/inquiries/:inquiryId` with `{ status: "DECLINED", notes }`
    - `markEmbassyVisited` payload type gains optional `partnerCommission?: { amount: string; accountId: string }`.
  - `services/revenue.ts`: `Revenue` type, `listRevenue({page,limit,caseId?,category?})`, `createRevenue(payload)`.
  - `services/loans.ts`: `Loan`, `LoanRepayment`, `LoanProjection` types; `listLoans({page,limit,status?})`, `getLoan(id)`, `createLoan(payload)`, `recordLoanRepayment(loanId, payload)`.
  - `services/payables.ts`: `Payable` type; `listPayables({page,limit,status?,caseId?})`, `createPayable(payload)`, `settlePayable(id, payload)`.

- [ ] **Step 1: Type files**

`aster/types/hospital.ts` — add `country: string;` to `Hospital`.
`aster/types/document.ts` — add `| "EVALUATION_DOC"` to `DocumentType`.
`aster/types/case.ts` — update:
```ts
export type HospitalInquiryStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "NOT_SELECTED";

export type HospitalInquiry = {
  id: string;
  hospitalId: string;
  hospital: Hospital;
  status: HospitalInquiryStatus;
  isChosen: boolean;
  treatmentCostEstimate: string | null;
  currency: "USD" | "INR" | null;
  notes: string | null;
  sentAt: string;
  respondedAt: string | null;
  documents: CaseDocument[];
};
```
(import `CaseDocument` from `@/types/document` if not already.)

`aster/types/revenue.ts`:
```ts
export type RevenueCategory = "HOSPITAL_REFERRAL_COMMISSION" | "OTHER_INCOME";

export type Revenue = {
  id: string;
  category: RevenueCategory;
  amount: string;
  currency: "USD" | "INR";
  description: string | null;
  receivedOn: string;
  caseId: string | null;
  case: { id: string; caseNumber: string } | null;
  account: { id: string; name: string };
  recordedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
};

export type RevenueListResult = {
  revenue: Revenue[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

`aster/types/loan.ts`:
```ts
export type LoanInterestMethod = "SIMPLE" | "COMPOUND_MONTHLY";
export type LoanStatus = "ACTIVE" | "SETTLED";

export type LoanProjection = {
  accruedInterest: number;
  totalRepaid: number;
  outstanding: number;
  isOverdue: boolean;
};

export type LoanRepayment = {
  id: string;
  amount: string;
  paidOn: string;
  account: { id: string; name: string };
  createdAt: string;
};

export type Loan = {
  id: string;
  lenderName: string;
  principal: string;
  currency: "USD" | "INR";
  interestRatePct: string;
  interestMethod: LoanInterestMethod;
  disbursedOn: string;
  termMonths: number;
  dueOn: string;
  status: LoanStatus;
  notes: string | null;
  account: { id: string; name: string };
  recordedBy: { id: string; firstName: string; lastName: string };
  repayments: LoanRepayment[];
  projection: LoanProjection;
  createdAt: string;
};

export type LoanListResult = {
  loans: Loan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

`aster/types/payable.ts`:
```ts
export type PayableStatus = "OUTSTANDING" | "SETTLED";

export type Payable = {
  id: string;
  payeeName: string;
  amount: string;
  currency: "USD" | "INR";
  reason: string;
  raisedOn: string;
  status: PayableStatus;
  settledOn: string | null;
  caseId: string | null;
  case: { id: string; caseNumber: string } | null;
  recordedBy: { id: string; firstName: string; lastName: string };
  accountTransaction: { account: { id: string; name: string } } | null;
  createdAt: string;
};

export type PayableListResult = {
  payables: Payable[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

- [ ] **Step 2: Service files**

Each mirrors `aster/services/expenses.ts` (same `ApiSuccess`/`unwrap`, `export { getErrorMessage }`).

`aster/services/revenue.ts`:
```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Revenue, RevenueListResult, RevenueCategory } from "@/types/revenue";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listRevenue(params: { page?: number; limit?: number; caseId?: string; category?: RevenueCategory } = {}): Promise<RevenueListResult> {
  const r = await api.get<ApiSuccess<RevenueListResult>>("/revenue", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, caseId: params.caseId || undefined, category: params.category || undefined },
  });
  return unwrap(r);
}

export type CreateRevenuePayload = {
  category: RevenueCategory;
  amount: string;
  currency: "USD" | "INR";
  accountId: string;
  receivedOn: string;
  caseId?: string;
  description?: string;
};

export async function createRevenue(payload: CreateRevenuePayload): Promise<Revenue> {
  const r = await api.post<ApiSuccess<Revenue>>("/revenue", payload);
  return unwrap(r);
}

export { getErrorMessage };
```

`aster/services/loans.ts`:
```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Loan, LoanListResult, LoanInterestMethod, LoanStatus } from "@/types/loan";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listLoans(params: { page?: number; limit?: number; status?: LoanStatus } = {}): Promise<LoanListResult> {
  const r = await api.get<ApiSuccess<LoanListResult>>("/loans", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, status: params.status || undefined },
  });
  return unwrap(r);
}

export async function getLoan(id: string): Promise<Loan> {
  const r = await api.get<ApiSuccess<Loan>>(`/loans/${id}`);
  return unwrap(r);
}

export type CreateLoanPayload = {
  lenderName: string;
  principal: string;
  currency: "USD" | "INR";
  interestRatePct: string;
  interestMethod: LoanInterestMethod;
  disbursedOn: string;
  termMonths: number;
  accountId: string;
  notes?: string;
};

export async function createLoan(payload: CreateLoanPayload): Promise<Loan> {
  const r = await api.post<ApiSuccess<Loan>>("/loans", payload);
  return unwrap(r);
}

export async function recordLoanRepayment(loanId: string, payload: { amount: string; paidOn: string; accountId: string }): Promise<LoanRepayment> {
  const r = await api.post<ApiSuccess<import("@/types/loan").LoanRepayment>>(`/loans/${loanId}/repayments`, payload);
  return unwrap(r);
}

export { getErrorMessage };
```

`aster/services/payables.ts`:
```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Payable, PayableListResult, PayableStatus } from "@/types/payable";

type ApiSuccess<T> = { success: boolean; message: string; data: T };
function unwrap<T>(r: { data: ApiSuccess<T> }): T {
  if (!r.data.success) throw new Error(r.data.message || "Request failed");
  return r.data.data;
}

export async function listPayables(params: { page?: number; limit?: number; status?: PayableStatus; caseId?: string } = {}): Promise<PayableListResult> {
  const r = await api.get<ApiSuccess<PayableListResult>>("/payables", {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, status: params.status || undefined, caseId: params.caseId || undefined },
  });
  return unwrap(r);
}

export type CreatePayablePayload = {
  payeeName: string;
  amount: string;
  currency: "USD" | "INR";
  reason: string;
  raisedOn: string;
  caseId?: string;
};

export async function createPayable(payload: CreatePayablePayload): Promise<Payable> {
  const r = await api.post<ApiSuccess<Payable>>("/payables", payload);
  return unwrap(r);
}

export async function settlePayable(id: string, payload: { accountId: string; paidOn: string }): Promise<Payable> {
  const r = await api.post<ApiSuccess<Payable>>(`/payables/${id}/settle`, payload);
  return unwrap(r);
}

export { getErrorMessage };
```

- [ ] **Step 3: `services/hospitals.ts` + `services/cases.ts`**

`hospitals.ts` — add `country: string;` to `HospitalPayload`.

`cases.ts` — add (axios auto-sets the multipart boundary for `FormData`):
```ts
export async function recordChosenResponse(caseId: string, inquiryId: string, payload: FormData): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(`/cases/${caseId}/inquiries/${inquiryId}/response`, payload);
  return unwrap(response);
}

export async function changeChosenHospital(caseId: string, payload: FormData): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(`/cases/${caseId}/chosen-hospital`, payload);
  return unwrap(response);
}

export async function declineInquiry(caseId: string, inquiryId: string, notes?: string): Promise<HospitalInquiry> {
  const response = await api.patch<ApiSuccess<HospitalInquiry>>(
    `/cases/${caseId}/inquiries/${inquiryId}`,
    { status: "DECLINED", notes: notes || undefined },
  );
  return unwrap(response);
}
```
Keep the existing `respondToInquiry` export only if something still imports it after Task 13; otherwise delete it (grep `respondToInquiry` under `aster/`).
In `markEmbassyVisited`'s payload type, add `partnerCommission?: { amount: string; accountId: string }`.

- [ ] **Step 4: tsc + lint against baseline**

Run: `cd aster && npx tsc --noEmit` — expect new errors only in the files Task 13–17 will fix (`hospital-inquiry-panel.tsx` will complain about `respondToInquiry` shape and the removed `RespondInquiryDialog` props once Task 13 runs — but at THIS point, having only added optional fields and new exports, tsc should still show only the 2 baseline failures). If a consumer breaks purely from the `HospitalInquiry` shape change (e.g. `hospital-inquiry-panel.tsx` reading a now-nullable field), add the null guard here.

- [ ] **Step 5: Commit**

```bash
git add aster/types/revenue.ts aster/types/loan.ts aster/types/payable.ts \
  aster/types/case.ts aster/types/hospital.ts aster/types/document.ts \
  aster/services/revenue.ts aster/services/loans.ts aster/services/payables.ts \
  aster/services/hospitals.ts aster/services/cases.ts
git commit -m "feat: frontend types & services for referral & finance expansion"
```

---

## Task 13: Part B UI — inquiry panel, record-response, change-hospital

**Files:**
- Create: `aster/components/cases/record-response-dialog.tsx`, `aster/components/cases/change-hospital-dialog.tsx`
- Modify: `aster/components/cases/hospital-inquiry-panel.tsx`
- Modify: `aster/components/hospitals/hospital-form-dialog.tsx`
- Delete: `aster/components/cases/respond-inquiry-dialog.tsx` (replaced)
- Modify: `aster/components/Layout/Sidebar.tsx` (nav for the new finance pages — do it here so it lands once)

**Interfaces:**
- Consumes: Task 12 services/types, the Subsystem A `FileField` (`aster/components/ui/file-field.tsx`).
- Produces: the reworked case-detail hospital panel.

- [ ] **Step 1: `record-response-dialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileField } from "@/components/ui/file-field";
import { useToast } from "@/hooks/use-toast";
import type { HospitalInquiry } from "@/types/case";

type Values = { treatmentCostEstimate: string; currency: "USD" | "INR"; notes: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: HospitalInquiry | null;
  title: string;
  extraField?: React.ReactNode; // used by change-hospital to add the target select
  buildExtra?: (fd: FormData) => void;
  onSubmit: (payload: FormData) => Promise<void>;
};

export function RecordResponseDialog({ open, onOpenChange, inquiry, title, extraField, buildExtra, onSubmit }: Props) {
  const toast = useToast();
  const form = useForm<Values>({ defaultValues: { treatmentCostEstimate: "", currency: "USD", notes: "" } });
  const [evaluationDoc, setEvaluationDoc] = useState<File | null>(null);
  const [invitationLetter, setInvitationLetter] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      form.reset({ treatmentCostEstimate: "", currency: "USD", notes: "" });
      setEvaluationDoc(null);
      setInvitationLetter(null);
    }
  }, [open, form]);

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!values.treatmentCostEstimate || Number(values.treatmentCostEstimate) <= 0) {
                form.setError("treatmentCostEstimate", { message: "A positive cost estimate is required" });
                return;
              }
              if (!evaluationDoc) { toast.error("Missing file", "Attach the evaluation document"); return; }
              if (!invitationLetter) { toast.error("Missing file", "Attach the invitation letter"); return; }
              const fd = new FormData();
              fd.append("treatmentCostEstimate", values.treatmentCostEstimate);
              fd.append("currency", values.currency);
              if (values.notes.trim()) fd.append("notes", values.notes.trim());
              fd.append("evaluationDoc", evaluationDoc);
              fd.append("invitationLetter", invitationLetter);
              buildExtra?.(fd);
              await onSubmit(fd);
            })}
            className="space-y-4"
          >
            {extraField}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="treatmentCostEstimate" render={({ field }) => (
                <FormItem><FormLabel>Treatment cost estimate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem><FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="INR">INR</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <FileField id="evaluationDoc" label="Evaluation document" required value={evaluationDoc} onChange={setEvaluationDoc} />
            <FileField id="invitationLetter" label="Invitation letter" required value={invitationLetter} onChange={setInvitationLetter} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `change-hospital-dialog.tsx`**

A thin wrapper over `RecordResponseDialog` that adds a `<Select>` of the case's `PENDING`/`NOT_SELECTED` inquiries and appends `newInquiryId` via `buildExtra`:
```tsx
"use client";

import { useState } from "react";
import { RecordResponseDialog } from "@/components/cases/record-response-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Case, HospitalInquiry } from "@/types/case";

export function ChangeHospitalDialog({
  open, onOpenChange, kase, currentChosen, onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kase: Case;
  currentChosen: HospitalInquiry;
  onSubmit: (payload: FormData) => Promise<void>;
}) {
  const options = kase.inquiries.filter((i) => ["PENDING", "NOT_SELECTED"].includes(i.status));
  const [target, setTarget] = useState<string>(options[0]?.id ?? "");

  return (
    <RecordResponseDialog
      open={open}
      onOpenChange={onOpenChange}
      inquiry={currentChosen}
      title="Change chosen hospital"
      onSubmit={onSubmit}
      buildExtra={(fd) => fd.append("newInquiryId", target)}
      extraField={
        <div className="space-y-2">
          <Label>New hospital</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Pick an inquiry" /></SelectTrigger>
            <SelectContent>
              {options.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.hospital.name} — {i.hospital.country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
```

- [ ] **Step 3: Rework `hospital-inquiry-panel.tsx`**

- Drop the `RespondInquiryDialog` import; import `RecordResponseDialog`, `ChangeHospitalDialog`, `recordChosenResponse`, `changeChosenHospital`, `declineInquiry`, and `getImageUrl` from `@/utils/imageUtils`.
- `INQUIRY_STATUS_VARIANT` gains `NOT_SELECTED: "outline"`.
- `canSend` no longer checks `!hasPending` — a case can have several pending inquiries; keep the `kase.status !== "CANCELLED"` and `hasPermission("UPDATE_CASES")` checks, and hide "Send" once an inquiry `isChosen`.
- Compute `const chosen = kase.inquiries.find((i) => i.isChosen) ?? null;` and `const feePaid = kase.visaApplications.some((v) => v.payment);`.
- For each inquiry row:
  - badge shows `inquiry.status` (map `NOT_SELECTED` → "Not selected"); a chosen row also gets a "Chosen" `Badge`.
  - if `inquiry.isChosen`: render its `documents` (evaluation + invitation) as download links (`<a href={getImageUrl(doc.fileUrl)} target="_blank">`), plus a "Change hospital" button when `!feePaid && hasPermission("RECORD_HOSPITAL_RESPONSE")`.
  - if `inquiry.status === "PENDING"` and no chosen inquiry exists yet: a "Record chosen response" button (`hasPermission("RECORD_HOSPITAL_RESPONSE")`) → opens `RecordResponseDialog` for that inquiry; and a "Mark declined" button (`hasPermission("UPDATE_CASES")`) → `declineInquiry`.
- Handlers:
```tsx
const handleRecord = async (payload: FormData) => {
  if (!recordingInquiry) return;
  try {
    await recordChosenResponse(kase.id, recordingInquiry.id, payload);
    toast.success("Response recorded"); setRecordingInquiry(null); onChanged();
  } catch (e) { toast.error("Could not record response", getErrorMessage(e)); throw e; }
};
const handleChange = async (payload: FormData) => {
  try {
    await changeChosenHospital(kase.id, payload);
    toast.success("Chosen hospital changed"); setChangeOpen(false); onChanged();
  } catch (e) { toast.error("Could not change hospital", getErrorMessage(e)); throw e; }
};
const handleDecline = async (inquiry: HospitalInquiry) => {
  try { await declineInquiry(kase.id, inquiry.id); toast.success("Inquiry declined"); onChanged(); }
  catch (e) { toast.error("Could not decline", getErrorMessage(e)); }
};
```
- Also show `inquiry.hospital.country` next to the city in the row header.

- [ ] **Step 4: `hospital-form-dialog.tsx` — country field**

Add a required `country` text `FormField` after `city` (mirror the `city` field exactly), add `country: ""` to the form defaults and `country` to the zod schema (`z.string().min(1, "Country is required")`), and include it in the submit payload.

- [ ] **Step 5: Sidebar nav**

In `aster/components/Layout/Sidebar.tsx`, add three items near the `Expenses` entry:
```ts
{ name: "Revenue", href: "/dashboard/revenue", icon: Receipt, permission: "VIEW_FINANCE" },
{ name: "Loans", href: "/dashboard/loans", icon: Wallet, permission: "VIEW_FINANCE" },
{ name: "Payables", href: "/dashboard/payables", icon: Wallet, permission: "VIEW_FINANCE" },
```
(reuse already-imported icons; do not add new imports unless needed.)

- [ ] **Step 6: tsc + lint against baseline; commit**

```bash
git add aster/components/cases/record-response-dialog.tsx aster/components/cases/change-hospital-dialog.tsx \
  aster/components/cases/hospital-inquiry-panel.tsx aster/components/hospitals/hospital-form-dialog.tsx \
  aster/components/Layout/Sidebar.tsx
git rm aster/components/cases/respond-inquiry-dialog.tsx
git commit -m "feat: multi-hospital referral UI — record chosen response, change hospital, country"
```

---

## Task 14: Revenue page

**Files:**
- Create: `aster/app/dashboard/revenue/page.tsx`, `aster/components/revenue/revenue-table.tsx`, `aster/components/revenue/revenue-form-dialog.tsx`

**Interfaces:** consumes `services/revenue.ts`, `services/accounts.ts` (`listAccounts`).

- [ ] **Step 1: `revenue-table.tsx`** — a `<table>` (mirror `aster/components/expenses/expenses-table.tsx`): columns Date (`receivedOn`), Category (humanized), Amount + currency, Account (`account.name`), Case (`case?.caseNumber ?? "—"`), Recorded by, Description. `loading` prop shows a spinner row; empty shows "No revenue recorded yet."

- [ ] **Step 2: `revenue-form-dialog.tsx`** — mirror `aster/components/expenses/expense-form-dialog.tsx`. Fields: `category` Select (`HOSPITAL_REFERRAL_COMMISSION` → "Hospital referral commission", `OTHER_INCOME` → "Other income"), `amount` number, `currency` Select, `accountId` Select (from `listAccounts()` loaded in a `useEffect`), `receivedOn` date, `caseId` optional text, `description` optional. zod schema `revenueFormSchema` inline in the file. Submit calls `props.onSubmit(values)`.

- [ ] **Step 3: `revenue/page.tsx`** — copy `aster/app/dashboard/expenses/page.tsx` structure exactly, swapping: `usePermissionGuard("VIEW_FINANCE")`, `listRevenue`/`createRevenue`, `hasPermission("MANAGE_REVENUE")` for the "Record revenue" button, `PageHeader` title "Revenue" / description "Income received that isn't a visa fee — referral commission and other income.", `RevenueTable`, result key `result.revenue`.

- [ ] **Step 4: tsc + lint against baseline; commit**

```bash
git add aster/app/dashboard/revenue aster/components/revenue
git commit -m "feat: revenue register page"
```

---

## Task 15: Loans pages (list + detail + repayment)

**Files:**
- Create: `aster/app/dashboard/loans/page.tsx`, `aster/app/dashboard/loans/[id]/page.tsx`
- Create: `aster/components/loans/loans-table.tsx`, `aster/components/loans/loan-form-dialog.tsx`, `aster/components/loans/repayment-dialog.tsx`

**Interfaces:** consumes `services/loans.ts`, `services/accounts.ts`.

- [ ] **Step 1: `loans-table.tsx`** — rows link to `/dashboard/loans/${loan.id}`. Columns: Lender, Principal + currency, Rate (`interestRatePct%` + method), Outstanding (`loan.projection.outstanding`, red if `isOverdue`), Due (`dueOn`), Status badge.

- [ ] **Step 2: `loan-form-dialog.tsx`** — mirror the expense dialog. Fields: `lenderName`, `principal`, `currency` Select, `interestRatePct`, `interestMethod` Select (`SIMPLE` → "Simple", `COMPOUND_MONTHLY` → "Compound (monthly)"), `disbursedOn` date, `termMonths` number (integer), `accountId` Select, `notes` optional. zod schema inline. `termMonths` submitted as `Number(values.termMonths)`.

- [ ] **Step 3: `repayment-dialog.tsx`** — fields `amount`, `paidOn` date, `accountId` Select. Calls `recordLoanRepayment(loanId, values)`.

- [ ] **Step 4: `loans/page.tsx`** — list page, `usePermissionGuard("VIEW_FINANCE")`, `hasPermission("MANAGE_LOANS")` gates "New loan", a status filter (`Select` All/Active/Settled) feeding `listLoans({ status })`.

- [ ] **Step 5: `loans/[id]/page.tsx`** — `const { id } = useParams()`, `getLoan(id)` in a `useEffect`. Render: a card of terms (lender, principal, rate/method, disbursed, due, account); a "Balance" card showing `projection.accruedInterest`, `projection.totalRepaid`, `projection.outstanding` (bold), and an "Overdue" badge if `isOverdue`; a repayments table (amount, date, account); a "Record repayment" button (`hasPermission("MANAGE_LOANS")` and `loan.status === "ACTIVE"`) opening `RepaymentDialog`. On success, re-fetch.

- [ ] **Step 6: tsc + lint against baseline; commit**

```bash
git add aster/app/dashboard/loans aster/components/loans
git commit -m "feat: loans pages with computed balances and repayment log"
```

---

## Task 16: Payables page

**Files:**
- Create: `aster/app/dashboard/payables/page.tsx`, `aster/components/payables/payables-table.tsx`, `aster/components/payables/payable-form-dialog.tsx`, `aster/components/payables/settle-payable-dialog.tsx`

**Interfaces:** consumes `services/payables.ts`, `services/accounts.ts`.

- [ ] **Step 1: `payables-table.tsx`** — columns: Payee, Amount + currency, Reason, Case (`case?.caseNumber ?? "—"`), Raised (`raisedOn`), Status badge, and a "Settle" button per `OUTSTANDING` row (`hasPermission("MANAGE_PAYABLES")` — pass a `canSettle` prop + `onSettle(payable)` callback).

- [ ] **Step 2: `payable-form-dialog.tsx`** — fields `payeeName`, `amount`, `currency` Select, `reason`, `raisedOn` date, `caseId` optional. zod inline.

- [ ] **Step 3: `settle-payable-dialog.tsx`** — fields `accountId` Select, `paidOn` date. Calls `settlePayable(payable.id, values)`.

- [ ] **Step 4: `payables/page.tsx`** — list page with a status filter; "New payable" gated on `MANAGE_PAYABLES`; holds `settlingPayable` state for the settle dialog.

- [ ] **Step 5: tsc + lint against baseline; commit**

```bash
git add aster/app/dashboard/payables aster/components/payables
git commit -m "feat: payables register page"
```

---

## Task 17: Embassy-commission field on the embassy-visit dialog

**Files:**
- Modify: `aster/components/cases/embassy-visit-dialog.tsx`
- Modify: `aster/components/cases/visa-application-panel.tsx` (pass accounts + settings default; forward the payload)
- Modify: `aster/lib/validations/case.ts` (`embassyVisitSchema` gains the optional commission fields)

**Interfaces:** consumes `services/accounts.ts` (`listAccounts`), `services/settings.ts` (`getSettings`).

- [ ] **Step 1: `embassyVisitSchema`**

Add optional fields: `partnerCommissionAmount: z.string().optional()`, `partnerCommissionAccountId: z.string().optional()`. Keep `embassyVisitDate` required.

- [ ] **Step 2: `embassy-visit-dialog.tsx`**

- Add props `accounts: { id: string; name: string }[]` and `defaultCommission: string`.
- Add form fields `partnerCommissionAmount` (number, prefilled from `defaultCommission`) and `partnerCommissionAccountId` (Select of `accounts`), under a "Partner commission (optional)" label.
- In the submit handler, build the callback value:
```ts
const amt = parsed.data.partnerCommissionAmount;
await onSubmit({
  embassyVisitDate: parsed.data.embassyVisitDate,
  notes: parsed.data.notes?.trim() || undefined,
  partnerCommission:
    amt && Number(amt) > 0
      ? { amount: amt, accountId: parsed.data.partnerCommissionAccountId ?? "" }
      : undefined,
});
```
- Change the `onSubmit` prop type to accept the optional `partnerCommission`.
- If `partnerCommission` is set but `accountId` is empty, `form.setError("partnerCommissionAccountId", ...)` and return.

- [ ] **Step 3: `visa-application-panel.tsx`**

Where `<EmbassyVisitDialog>` is rendered, load `listAccounts()` and `getSettings()` in a `useEffect` (or lift from an existing loader), pass `accounts` and `defaultCommission={settings.EMBASSY_COMMISSION_DEFAULT ?? "0"}`. The existing `handleEmbassyVisit` forwards `values` to `markEmbassyVisited(kase.id, visaAppId, values)` — the extended `values` (with `partnerCommission`) flows straight through; just widen its local type.

- [ ] **Step 4: tsc + lint against baseline; commit**

```bash
git add aster/components/cases/embassy-visit-dialog.tsx aster/components/cases/visa-application-panel.tsx \
  aster/lib/validations/case.ts
git commit -m "feat: record embassy-partnership commission with the embassy visit"
```

**— Phase 3 complete: full feature shipped. —**

---

## Final Verification (whole plan)

- [ ] `cd Server && npx vitest run` — every suite green.
- [ ] `cd aster && npx tsc --noEmit` — only the two pre-existing `components/ui/{calendar,rich-text-editor}.tsx` failures.
- [ ] `cd aster && npm run lint` — 73 problems (unchanged from baseline).
- [ ] `cd Server && npx prisma migrate status` — up to date on the dev DB.
- [ ] Re-run the seed (`node Server/cmd/Seed/adminSeed.js` or the project's usual command) so the four new permissions + `EMBASSY_COMMISSION_DEFAULT` land.

---

## Self-Review

**Spec coverage:**
- Hospital country → Task 2. Per-inquiry documents (`EVALUATION_DOC` + invitation) → Tasks 1 (enum), 3 (`recordChosenResponse`). `recordChosenResponse` as trigger → Task 3. `respondToInquiry` narrowed → Task 4. `NOT_SELECTED` cascade → Task 3. `changeChosenHospital` + no-payment guard → Task 5. Agency-case visa-app skip preserved → Task 3 (uses `isAgencyCase`). Multiple concurrent inquiries → Task 2. `HOSPITAL_CHOSEN`/`HOSPITAL_CHANGED` events → Tasks 1, 3, 5.
- Revenue register → Task 6. Loans + terms + repayments + on-read projection → Tasks 7 (math), 8 (service). Payables + settle-from-account → Task 9. Embassy commission as expense → Task 10. Ledger enum values + `CREDIT`/`DEBIT` arrays → Task 1. `getFinanceStats` extension → Task 11.
- Four new permissions → Task 1 (seed) + used on routes in Tasks 3, 5, 6, 8, 9. `VIEW_FINANCE` read access → Tasks 6, 8, 9 (`RequireAnyPermission`).
- Frontend: types/services → Task 12; Part B UI → Task 13; Revenue/Loans/Payables pages → Tasks 14–16; embassy commission field → Task 17; nav → Task 13.
- Migration (additive, backfill `Hospital.country`) → Task 1. `EMBASSY_COMMISSION_DEFAULT` setting → Task 1.
- Spec assumptions: (1) re-choose until first payment → Task 5 guard. (2) on-read accrual, term cap → Task 7. (3) staff-entered commission amount → Task 6 (no auto-calc; % helper is a Task 14 UI nicety, optional). (4) both inquiry docs required → Task 3. (5) distinct permissions → Task 1.

**Placeholder scan:** the `% of estimate` helper in Revenue (Task 14 Step 2) is described as an optional nicety, not required — acceptable (spec §9.3 says the stored value is staff-entered regardless). No "TBD"/"handle errors"/"similar to Task N" — each task carries its own code.

**Type consistency:** `recordChosenResponse(caseId, inquiryId, data, files, userId)` — 5 args, consistent across service (Task 3), controller (Task 3), factory `recordChosenResponseFor` (Task 3), and frontend `recordChosenResponse(caseId, inquiryId, FormData)` (Task 12). `loanProjection(loan, repayments, asOf)` consistent between Task 7 (def), Task 8 (3 call sites), Task 11 (dashboard). `changeChosenHospital` — service takes `(caseId, newInquiryId, data, files, userId)`; controller destructures `newInquiryId` out of `req.body` and passes the rest as `data` (Task 5); frontend sends one `FormData` with `newInquiryId` appended (Task 13). `AccountTransaction` new FK field names (`revenueId`, `loanId`, `loanRepaymentId`, `payableId`) consistent between schema (Task 1), each service's nested/scalar create (Tasks 6, 8, 9), and `accountsService` includes (Task 1 Step 6).

