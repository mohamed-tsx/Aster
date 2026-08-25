# Visa Processing & Fee Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the visa-application lifecycle (auto-created per traveler on hospital
acceptance, through fee payment, embassy visit, and outcome), document upload/download/
delete, and a minimal Account create-and-list slice — on top of the merged Cases module
and the merged Accounts/Ledger schema.

**Architecture:** Extend the existing Cases aggregate
(`Server/Src/{Routes,Controllers,Services}/Cases`) with `VisaApplication` lifecycle
actions (same shape as the already-implemented `sendInquiry`/`respondToInquiry`/
`cancelCase`). Add two new backend aggregates: `Documents` (file upload/delete,
generalizing the existing avatar-upload pattern) and `Accounts` (minimal create/list,
including the single balance-computation helper the accounts ledger schema's final
review called for). Frontend follows the Cases module's established page/panel shape.

**Tech Stack:** Express 5, Prisma Client, Next.js App Router, react-hook-form + zod,
shadcn/ui, Multer (file uploads, already used for avatars).

**Spec:** `docs/superpowers/specs/2026-08-25-visa-processing-design.md`

## Global Constraints

- Response envelope: `sendSuccess`/`sendCreated` → `{ success, message, data }`, list
  endpoints wrap under a named key (matches every existing module).
- `VisaApplication.status` flow is strictly sequential — `PENDING` → `FEE_PAID` →
  `EMBASSY_VISITED` → `APPROVED`/`REJECTED`. Each action rejects (400) if the
  `VisaApplication` isn't in the exact status it expects.
- `sendInquiry` only allows sending a new inquiry when `Case.status` is `NEW`,
  `HOSPITAL_MATCHING`, or `HOSPITAL_DECLINED` — **not** just "not `CANCELLED`" as
  today. This closes a real gap: once a case reaches `HOSPITAL_ACCEPTED` its
  `VisaApplication`s already exist, and a second accepted inquiry would crash on the
  `@@unique([caseId, travelerType])` constraint instead of failing cleanly.
- `VisaApplication` auto-creation happens inside `respondToInquiry`'s existing
  `$transaction`, not a separate endpoint — one row for the patient, one more for the
  attendant if the case has one, both `status: "PENDING"` (the schema default).
- The visa-registration fee's `currency` is always hardcoded `"USD"` server-side in
  `recordFeePayment` — **never** accepted from the request body, even though
  `Account`s can hold multiple currencies. `amount` defaults client-side to $400
  (`DIRECT`)/$100 (`AGENCY`) but is editable; the server only validates it's a
  positive number, it doesn't recompute or lock it.
- `Case.status → VISA_PROCESSING` happens in `recordFeePayment`, and **only** on that
  case's first-ever fee payment (checked via `Prisma.payment.findFirst({ where: {
  visaApplication: { caseId } } })` before creating the new one).
- `Case.status → COMPLETED` happens in `recordVisaOutcome`, and only when every one of
  the case's `VisaApplication`s (checked by re-querying all of them, treating the one
  just updated as already terminal) is `APPROVED` or `REJECTED`.
- No new permissions beyond what's already seeded: `recordFeePayment` is gated by
  `MANAGE_FINANCE`; `markEmbassyVisited`/`recordVisaOutcome` by `UPDATE_CASES`;
  Document upload by `UPDATE_CASES`, delete by `DELETE_CASES` (this permission's first
  real use); Account list by `RequireAnyPermission(["MANAGE_ACCOUNTS",
  "MANAGE_FINANCE"])`, create by `MANAGE_ACCOUNTS`.
- Documents accept JPG/PNG/WEBP/PDF/DOC/DOCX, 50MB per file, stored on local disk at
  `uploads/documents/<caseId>/<documentId>.<ext>` (one file per upload, never
  overwritten), served by the existing `/uploads` static route (already gated by
  `Verify`, no route changes needed there).
- `getAccountBalances(accountId)` (in `Server/Src/Services/Accounts/accountsService.js`)
  is the **only** place balance is computed, built on exported `CREDIT_TYPES`/
  `DEBIT_TYPES` constants — no other file computes a balance by hand.
- No `PATCH`/deactivate/delete endpoint for `Account` in this plan — create-and-list
  only, per the spec's explicit scope.
- No test framework exists in this codebase. Verification is: manual `curl`/browser
  pass against a running server, `npx tsc --noEmit` clean on the frontend.

---

## File Structure

- Modify: `Server/Src/Services/Cases/casesService.js` — `sendInquiry` guard fix,
  `respondToInquiry` auto-creates `VisaApplication`(s), `CASE_DETAIL_INCLUDE`
  extension, `DATE_ONLY_FIELDS` extension, new `recordFeePayment`/
  `markEmbassyVisited`/`recordVisaOutcome`.
- Modify: `Server/Src/Controllers/Cases/casesController.js`,
  `Server/Src/Routes/Cases/casesRoute.js` — 3 new controller functions + routes.
- Create: `Server/Src/Middlewares/Multer/uploadDocument.js`,
  `Server/Src/Utils/Documents/saveDocumentLocal.js`,
  `Server/Src/Services/Documents/documentsService.js`,
  `Server/Src/Controllers/Documents/documentsController.js`,
  `Server/Src/Routes/Documents/documentsRoute.js`.
- Create: `Server/Src/Services/Accounts/accountsService.js`,
  `Server/Src/Controllers/Accounts/accountsController.js`,
  `Server/Src/Routes/Accounts/accountsRoute.js`.
- Modify: `Server/cmd/Server/Server.js` — mount the Documents and Accounts routers.
- Create: `aster/types/visa.ts`, `aster/types/document.ts`, `aster/types/account.ts`.
- Modify: `aster/types/case.ts` — add `visaApplications`/`documents` to `Case`.
- Modify: `aster/lib/validations/case.ts` — add fee-payment/embassy-visit/outcome
  schemas.
- Create: `aster/lib/validations/account.ts`.
- Modify: `aster/services/cases.ts` — add `recordFeePayment`/`markEmbassyVisited`/
  `recordVisaOutcome`.
- Create: `aster/services/documents.ts`, `aster/services/accounts.ts`.
- Create: `aster/app/dashboard/accounts/page.tsx`,
  `aster/components/accounts/accounts-table.tsx`,
  `aster/components/accounts/account-form-dialog.tsx`.
- Create: `aster/components/cases/visa-application-panel.tsx`,
  `aster/components/cases/fee-payment-dialog.tsx`,
  `aster/components/cases/embassy-visit-dialog.tsx`,
  `aster/components/cases/visa-outcome-dialog.tsx`,
  `aster/components/cases/documents-panel.tsx`,
  `aster/components/cases/upload-document-dialog.tsx`.
- Modify: `aster/app/dashboard/cases/[id]/page.tsx` — render the two new panels.
- Modify: `aster/components/Layout/Sidebar.tsx` — "Accounts" nav item.

---

### Task 1: Backend — VisaApplication lifecycle (extend the Cases aggregate)

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js`
- Modify: `Server/Src/Controllers/Cases/casesController.js`
- Modify: `Server/Src/Routes/Cases/casesRoute.js`

**Interfaces:**
- Consumes: `Prisma.visaApplication`/`Prisma.payment`/`Prisma.account`/
  `Prisma.accountTransaction` client accessors (all pre-existing from prior plans).
- Produces: `recordFeePayment`, `markEmbassyVisited`, `recordVisaOutcome` (exported
  from `casesService.js`), and `POST /api/v1/cases/:id/visa-applications/:visaApplicationId/fee-payment`,
  `PATCH /api/v1/cases/:id/visa-applications/:visaApplicationId/embassy-visit`,
  `PATCH /api/v1/cases/:id/visa-applications/:visaApplicationId/outcome` — Task 4's
  frontend service calls these exact paths. `CASE_DETAIL_INCLUDE` now includes
  `visaApplications`/`documents` — Task 2's Document creation and Task 4's frontend
  both depend on `documents` appearing in the case-detail response shape.

- [ ] **Step 1: Add the `sendInquiry` guard fix**

In `Server/Src/Services/Cases/casesService.js`, find:
```js
const PATIENT_SEARCH_MIN_LENGTH = 4;
```

Replace with:
```js
const PATIENT_SEARCH_MIN_LENGTH = 4;

// A case can only accept a NEW hospital inquiry in these statuses. Once accepted,
// its VisaApplication(s) already exist — a second accepted inquiry would attempt to
// create duplicate rows and crash on VisaApplication's @@unique([caseId,
// travelerType]) constraint instead of failing cleanly.
const SENDABLE_CASE_STATUSES = ["NEW", "HOSPITAL_MATCHING", "HOSPITAL_DECLINED"];
```

- [ ] **Step 2: Apply the guard in `sendInquiry`**

Find:
```js
export const sendInquiry = async (caseId, data) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("Cannot send an inquiry for a cancelled case", 400, "VALIDATION_ERROR");
  }
```

Replace with:
```js
export const sendInquiry = async (caseId, data) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (!SENDABLE_CASE_STATUSES.includes(kase.status)) {
    throw new AppError(
      "This case cannot accept a new hospital inquiry in its current status",
      400,
      "VALIDATION_ERROR",
    );
  }
```

- [ ] **Step 3: Add `embassyVisitDate` to the date-normalization set**

Find:
```js
const DATE_ONLY_FIELDS = new Set(["dateOfBirth", "passportExpiry"]);
```

Replace with:
```js
const DATE_ONLY_FIELDS = new Set(["dateOfBirth", "passportExpiry", "embassyVisitDate"]);
```

- [ ] **Step 4: Extend `CASE_DETAIL_INCLUDE`**

Find:
```js
const CASE_DETAIL_INCLUDE = {
  patient: true,
  attendant: true,
  agency: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, username: true } },
  inquiries: {
    orderBy: { sentAt: "desc" },
    include: { hospital: true },
  },
};
```

Replace with:
```js
const CASE_DETAIL_INCLUDE = {
  patient: true,
  attendant: true,
  agency: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, username: true } },
  inquiries: {
    orderBy: { sentAt: "desc" },
    include: { hospital: true },
  },
  visaApplications: {
    orderBy: { createdAt: "asc" },
    include: { payment: true },
  },
  documents: {
    orderBy: { createdAt: "desc" },
  },
};
```

- [ ] **Step 5: Auto-create `VisaApplication`(s) in `respondToInquiry`'s ACCEPTED branch**

Find:
```js
export const respondToInquiry = async (caseId, inquiryId, data) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
```

Replace with:
```js
export const respondToInquiry = async (caseId, inquiryId, data) => {
  const kase = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
```

Find:
```js
  const caseStatus = status === "ACCEPTED" ? "HOSPITAL_ACCEPTED" : "HOSPITAL_DECLINED";

  const [updatedInquiry] = await Prisma.$transaction([
    Prisma.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status,
        treatmentCostEstimate:
          treatmentCostEstimate !== undefined && treatmentCostEstimate !== ""
            ? treatmentCostEstimate
            : undefined,
        currency: currency || undefined,
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
      include: { hospital: true },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: caseStatus },
    }),
  ]);

  return updatedInquiry;
};
```

Replace with:
```js
  const caseStatus = status === "ACCEPTED" ? "HOSPITAL_ACCEPTED" : "HOSPITAL_DECLINED";

  const transactionOps = [
    Prisma.hospitalInquiry.update({
      where: { id: inquiryId },
      data: {
        status,
        treatmentCostEstimate:
          treatmentCostEstimate !== undefined && treatmentCostEstimate !== ""
            ? treatmentCostEstimate
            : undefined,
        currency: currency || undefined,
        notes: notes !== undefined ? notes || null : undefined,
        respondedAt: new Date(),
      },
      include: { hospital: true },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: caseStatus },
    }),
  ];

  if (status === "ACCEPTED") {
    transactionOps.push(
      Prisma.visaApplication.create({
        data: { caseId, travelerType: "PATIENT" },
      }),
    );
    if (kase.attendant) {
      transactionOps.push(
        Prisma.visaApplication.create({
          data: { caseId, travelerType: "ATTENDANT" },
        }),
      );
    }
  }

  const [updatedInquiry] = await Prisma.$transaction(transactionOps);

  return updatedInquiry;
};
```

- [ ] **Step 6: Append the 3 new functions to the end of `casesService.js`**

Append (after `cancelCase`):
```js

const TERMINAL_VISA_STATUSES = ["APPROVED", "REJECTED"];

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ accountId: string, amount: number|string, notes?: string }} data
 * @param {string} userId
 */
export const recordFeePayment = async (caseId, visaApplicationId, data, userId) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }
  if (visaApplication.status !== "PENDING") {
    throw new AppError(
      "This visa application's fee has already been recorded",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { accountId, amount, notes } = data;
  if (!accountId) {
    throw new AppError("accountId is required", 400, "VALIDATION_ERROR");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0) {
    throw new AppError("amount must be a positive number", 400, "VALIDATION_ERROR");
  }

  const account = await Prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new AppError("Account not found", 404, "NOT_FOUND");
  }

  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  // Case.status only moves to VISA_PROCESSING on this case's *first* fee payment —
  // check before creating this one, since after this transaction there will always
  // be at least one.
  const alreadyHasPayment = await Prisma.payment.findFirst({
    where: { visaApplication: { caseId } },
  });
  const isFirstPayment = !alreadyHasPayment;

  // NOTE: nesting `accountTransaction: { create }` under this call forces Prisma's
  // "checked" create-input shape (same issue already documented in this codebase's
  // `createCase`) — that shape rejects raw scalar FKs (`visaApplicationId`,
  // `receivedById`) as siblings of a nested relation write, so both must use
  // `connect` here too. The nested `accountTransaction.create` object itself has no
  // sibling nested relation, so `accountId`/`createdById` stay as plain scalars
  // there.
  const transactionOps = [
    Prisma.payment.create({
      data: {
        visaApplication: { connect: { id: visaApplicationId } },
        amount,
        currency: "USD",
        feeType: kase.reachOutType,
        receivedBy: { connect: { id: userId } },
        accountTransaction: {
          create: {
            accountId,
            type: "PAYMENT_RECEIVED",
            amount,
            currency: "USD",
            notes: notes || null,
            createdById: userId,
          },
        },
      },
    }),
    Prisma.visaApplication.update({
      where: { id: visaApplicationId },
      data: { status: "FEE_PAID" },
    }),
  ];
  if (isFirstPayment) {
    transactionOps.push(
      Prisma.case.update({
        where: { id: caseId },
        data: { status: "VISA_PROCESSING" },
      }),
    );
  }

  const [payment] = await Prisma.$transaction(transactionOps);
  return payment;
};

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ embassyVisitDate: string, notes?: string }} data
 */
export const markEmbassyVisited = async (caseId, visaApplicationId, data) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }
  if (visaApplication.status !== "FEE_PAID") {
    throw new AppError(
      "The visa-registration fee must be paid before recording an embassy visit",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { embassyVisitDate, notes } = data;
  if (!embassyVisitDate) {
    throw new AppError("embassyVisitDate is required", 400, "VALIDATION_ERROR");
  }

  return Prisma.visaApplication.update({
    where: { id: visaApplicationId },
    data: {
      status: "EMBASSY_VISITED",
      embassyVisitDate: normalizeDateValue("embassyVisitDate", embassyVisitDate),
      notes: notes !== undefined ? notes || null : undefined,
    },
  });
};

/**
 * @param {string} caseId
 * @param {string} visaApplicationId
 * @param {{ status: "APPROVED"|"REJECTED", visaNumber?: string, notes?: string }} data
 */
export const recordVisaOutcome = async (caseId, visaApplicationId, data) => {
  const visaApplication = await Prisma.visaApplication.findUnique({
    where: { id: visaApplicationId },
  });
  if (!visaApplication || visaApplication.caseId !== caseId) {
    throw new AppError("Visa application not found", 404, "NOT_FOUND");
  }
  if (visaApplication.status !== "EMBASSY_VISITED") {
    throw new AppError(
      "The embassy visit must be recorded before a visa outcome",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { status, visaNumber, notes } = data;
  if (!TERMINAL_VISA_STATUSES.includes(status)) {
    throw new AppError("status must be APPROVED or REJECTED", 400, "VALIDATION_ERROR");
  }
  if (status === "APPROVED" && !visaNumber?.trim()) {
    throw new AppError(
      "visaNumber is required when the visa is approved",
      400,
      "VALIDATION_ERROR",
    );
  }

  const siblingApplications = await Prisma.visaApplication.findMany({
    where: { caseId },
  });
  const allTerminalAfterThisUpdate = siblingApplications.every((app) =>
    app.id === visaApplicationId ? true : TERMINAL_VISA_STATUSES.includes(app.status),
  );

  const transactionOps = [
    Prisma.visaApplication.update({
      where: { id: visaApplicationId },
      data: {
        status,
        visaNumber: status === "APPROVED" ? visaNumber.trim() : undefined,
        notes: notes !== undefined ? notes || null : undefined,
      },
    }),
  ];
  if (allTerminalAfterThisUpdate) {
    transactionOps.push(
      Prisma.case.update({
        where: { id: caseId },
        data: { status: "COMPLETED" },
      }),
    );
  }

  const [updatedVisaApplication] = await Prisma.$transaction(transactionOps);
  return updatedVisaApplication;
};
```

- [ ] **Step 7: Add the 3 controller functions**

In `Server/Src/Controllers/Cases/casesController.js`, find:
```js
import {
  searchPatients,
  listCases,
  getCaseById,
  createCase,
  updateCase,
  sendInquiry,
  respondToInquiry,
  cancelCase,
} from "../../Services/Cases/casesService.js";
```

Replace with:
```js
import {
  searchPatients,
  listCases,
  getCaseById,
  createCase,
  updateCase,
  sendInquiry,
  respondToInquiry,
  cancelCase,
  recordFeePayment,
  markEmbassyVisited,
  recordVisaOutcome,
} from "../../Services/Cases/casesService.js";
```

Append at the end of the file:
```js

export const recordFeePaymentCtrl = asyncHandler(async (req, res) => {
  const payment = await recordFeePayment(
    req.params.id,
    req.params.visaApplicationId,
    req.body,
    req.user.id,
  );
  return sendCreated(res, "Fee payment recorded successfully", payment);
});

export const markEmbassyVisitedCtrl = asyncHandler(async (req, res) => {
  const visaApplication = await markEmbassyVisited(
    req.params.id,
    req.params.visaApplicationId,
    req.body,
  );
  return sendSuccess(res, "Embassy visit recorded successfully", visaApplication);
});

export const recordVisaOutcomeCtrl = asyncHandler(async (req, res) => {
  const visaApplication = await recordVisaOutcome(
    req.params.id,
    req.params.visaApplicationId,
    req.body,
  );
  return sendSuccess(res, "Visa outcome recorded successfully", visaApplication);
});
```

- [ ] **Step 8: Add the 3 routes**

In `Server/Src/Routes/Cases/casesRoute.js`, find:
```js
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
  sendInquiryCtrl,
  respondInquiryCtrl,
  cancelCaseCtrl,
} from "../../Controllers/Cases/casesController.js";
```

Replace with:
```js
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
  sendInquiryCtrl,
  respondInquiryCtrl,
  cancelCaseCtrl,
  recordFeePaymentCtrl,
  markEmbassyVisitedCtrl,
  recordVisaOutcomeCtrl,
} from "../../Controllers/Cases/casesController.js";
```

Find:
```js
router.patch(
  "/:id/inquiries/:inquiryId",
  RequirePermission("UPDATE_CASES"),
  respondInquiryCtrl,
);

export default router;
```

Replace with:
```js
router.patch(
  "/:id/inquiries/:inquiryId",
  RequirePermission("UPDATE_CASES"),
  respondInquiryCtrl,
);
router.post(
  "/:id/visa-applications/:visaApplicationId/fee-payment",
  RequirePermission("MANAGE_FINANCE"),
  recordFeePaymentCtrl,
);
router.patch(
  "/:id/visa-applications/:visaApplicationId/embassy-visit",
  RequirePermission("UPDATE_CASES"),
  markEmbassyVisitedCtrl,
);
router.patch(
  "/:id/visa-applications/:visaApplicationId/outcome",
  RequirePermission("UPDATE_CASES"),
  recordVisaOutcomeCtrl,
);

export default router;
```

- [ ] **Step 9: Manual verification**

Start the server (from `Server/`): `npm run dev` (adjust `PORT` if needed). Log in and
save cookies as in prior plans' verification steps.

Using a case that's already `HOSPITAL_ACCEPTED` with an attendant (create one fresh via
the existing Cases API if needed — see the Cases module plan's verification steps for
the create/send-inquiry/accept flow), confirm:

```bash
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases/<CASE_ID>"
```
Expect `data.visaApplications` to contain 2 entries (`travelerType: "PATIENT"` and
`"ATTENDANT"`), both `status: "PENDING"`.

Try sending a new inquiry on this already-accepted case:
```bash
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/inquiries" \
  -H "Content-Type: application/json" \
  -d '{"hospitalId":"<HOSPITAL_ID>"}'
```
Expect 400 "This case cannot accept a new hospital inquiry in its current status".

Try the out-of-order guards (expect 400 for each, using a `<VISA_APPLICATION_ID>` from
the case above):
```bash
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/visa-applications/<VISA_APPLICATION_ID>/embassy-visit" \
  -H "Content-Type: application/json" -d '{"embassyVisitDate":"2026-09-01"}'
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/visa-applications/<VISA_APPLICATION_ID>/outcome" \
  -H "Content-Type: application/json" -d '{"status":"APPROVED","visaNumber":"V123"}'
```

Record the fee payment (you'll need an `<ACCOUNT_ID>` — Task 3 adds the endpoint to
create one; if Task 3 isn't done yet, create one directly via Prisma Studio for this
verification pass):
```bash
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/visa-applications/<VISA_APPLICATION_ID>/fee-payment" \
  -H "Content-Type: application/json" -d '{"accountId":"<ACCOUNT_ID>","amount":400}'
```
Expect 201; then re-fetch the case and confirm this `VisaApplication.status` is
`FEE_PAID` and `Case.status` is `VISA_PROCESSING`.

Now the embassy visit and outcome:
```bash
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/visa-applications/<VISA_APPLICATION_ID>/embassy-visit" \
  -H "Content-Type: application/json" -d '{"embassyVisitDate":"2026-09-01"}'
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/visa-applications/<VISA_APPLICATION_ID>/outcome" \
  -H "Content-Type: application/json" -d '{"status":"APPROVED","visaNumber":"V123456"}'
```
Since the attendant's `VisaApplication` is still `PENDING`, confirm `Case.status` is
still `VISA_PROCESSING` (not yet `COMPLETED`) after this. Repeat the fee-payment →
embassy-visit → outcome sequence for the attendant's `VisaApplication`, then re-fetch
the case and confirm `Case.status` is now `COMPLETED`.

- [ ] **Step 10: Commit**

```bash
git add Server/Src/Services/Cases/casesService.js Server/Src/Controllers/Cases/casesController.js Server/Src/Routes/Cases/casesRoute.js
git commit -m "Add VisaApplication lifecycle: auto-creation, fee payment, embassy visit, outcome"
```

---

### Task 2: Backend — Documents aggregate

**Files:**
- Create: `Server/Src/Middlewares/Multer/uploadDocument.js`
- Create: `Server/Src/Utils/Documents/saveDocumentLocal.js`
- Create: `Server/Src/Services/Documents/documentsService.js`
- Create: `Server/Src/Controllers/Documents/documentsController.js`
- Create: `Server/Src/Routes/Documents/documentsRoute.js`
- Modify: `Server/cmd/Server/Server.js`

**Interfaces:**
- Consumes: `Prisma.document`, `Prisma.case` (pre-existing); the existing `/uploads`
  static route in `Server.js` (unchanged, already `Verify`-gated).
- Produces: `POST/DELETE /api/v1/cases/:caseId/documents[/:id]` — Task 4's frontend
  service calls these exact paths.

- [ ] **Step 1: Create `Server/Src/Middlewares/Multer/uploadDocument.js`**

```js
import multer from "multer";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIME_TYPES.has(file.mimetype);
    cb(ok ? null : new Error("Only JPG/PNG/WEBP/PDF/DOC/DOCX files are allowed"), ok);
  },
});
```

- [ ] **Step 2: Create `Server/Src/Utils/Documents/saveDocumentLocal.js`**

```js
import fs from "fs/promises";
import path from "path";

const EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * @param {Buffer} buffer
 * @param {string} caseId
 * @param {string} documentId
 * @param {string} mimeType
 * @returns {Promise<string>} the public URL Express serves this file at
 */
export async function saveDocumentLocal(buffer, caseId, documentId, mimeType) {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType];
  if (!extension) {
    throw new Error(`Unsupported document mime type: ${mimeType}`);
  }

  const dir = path.join(process.cwd(), "uploads", "documents", caseId);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${documentId}.${extension}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/uploads/documents/${caseId}/${fileName}`;
}

/**
 * Best-effort file cleanup — matches saveAvatarLocal's existing pattern of ignoring
 * cleanup errors so a filesystem issue never blocks the DB delete that already
 * succeeded.
 * @param {string} fileUrl
 */
export async function deleteDocumentFile(fileUrl) {
  try {
    const relativePath = fileUrl.replace(/^\/uploads\//, "");
    const filePath = path.join(process.cwd(), "uploads", relativePath);
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore cleanup errors to avoid blocking deletion.
  }
}
```

- [ ] **Step 3: Create `Server/Src/Services/Documents/documentsService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { saveDocumentLocal, deleteDocumentFile } from "../../Utils/Documents/saveDocumentLocal.js";

const DOCUMENT_TYPES = [
  "PATIENT_PASSPORT",
  "ATTENDANT_PASSPORT",
  "INVITATION_LETTER",
  "VISA_COPY",
  "OTHER",
];

/**
 * @param {string} caseId
 * @param {{ type: string }} data
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @param {string} userId
 */
export const uploadDocumentForCase = async (caseId, data, file, userId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  if (!file) {
    throw new AppError("A file is required", 400, "VALIDATION_ERROR");
  }

  const { type } = data;
  if (!DOCUMENT_TYPES.includes(type)) {
    throw new AppError(
      `type must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  // Create the row first (with a placeholder fileUrl) to get an id to name the file
  // after, then update fileUrl once the file is written — avoids needing a separate
  // ID-generation step outside Prisma.
  const created = await Prisma.document.create({
    data: {
      caseId,
      type,
      fileName: file.originalname,
      fileUrl: "",
      uploadedById: userId,
    },
  });

  const fileUrl = await saveDocumentLocal(file.buffer, caseId, created.id, file.mimetype);

  return Prisma.document.update({
    where: { id: created.id },
    data: { fileUrl },
  });
};

/**
 * @param {string} caseId
 * @param {string} documentId
 */
export const deleteDocument = async (caseId, documentId) => {
  const document = await Prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.caseId !== caseId) {
    throw new AppError("Document not found", 404, "NOT_FOUND");
  }

  await Prisma.document.delete({ where: { id: documentId } });
  await deleteDocumentFile(document.fileUrl);

  return true;
};
```

- [ ] **Step 4: Create `Server/Src/Controllers/Documents/documentsController.js`**

```js
import asyncHandler from "express-async-handler";
import { uploadDocumentForCase, deleteDocument } from "../../Services/Documents/documentsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const uploadDocumentCtrl = asyncHandler(async (req, res) => {
  const document = await uploadDocumentForCase(
    req.params.caseId,
    req.body,
    req.file,
    req.user.id,
  );
  return sendCreated(res, "Document uploaded successfully", document);
});

export const deleteDocumentCtrl = asyncHandler(async (req, res) => {
  await deleteDocument(req.params.caseId, req.params.id);
  return sendSuccess(res, "Document deleted successfully");
});
```

- [ ] **Step 5: Create `Server/Src/Routes/Documents/documentsRoute.js`**

```js
import express from "express";
import { uploadDocumentCtrl, deleteDocumentCtrl } from "../../Controllers/Documents/documentsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import { uploadDocument } from "../../Middlewares/Multer/uploadDocument.js";

// mergeParams: true so this router (mounted at "/api/v1/cases/:caseId/documents" in
// Server.js) can read req.params.caseId even though it's declared on the parent path.
const router = express.Router({ mergeParams: true });

router.use(Verify);

router.post(
  "/",
  RequirePermission("UPDATE_CASES"),
  uploadDocument.single("file"),
  uploadDocumentCtrl,
);
router.delete("/:id", RequirePermission("DELETE_CASES"), deleteDocumentCtrl);

export default router;
```

- [ ] **Step 6: Mount the router in `Server/cmd/Server/Server.js`**

Find:
```js
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
import casesRoutes from "../../Src/Routes/Cases/casesRoute.js";
```

Replace with:
```js
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
import casesRoutes from "../../Src/Routes/Cases/casesRoute.js";
import documentsRoutes from "../../Src/Routes/Documents/documentsRoute.js";
```

Find:
```js
Server.use("/api/v1/agencies", agenciesRoutes);
Server.use("/api/v1/cases", casesRoutes);
```

Replace with:
```js
Server.use("/api/v1/agencies", agenciesRoutes);
Server.use("/api/v1/cases", casesRoutes);
Server.use("/api/v1/cases/:caseId/documents", documentsRoutes);
```

- [ ] **Step 7: Manual verification**

With the server running, using a `<CASE_ID>` from any existing case:

```bash
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/documents" \
  -F "type=PATIENT_PASSPORT" \
  -F "file=@/path/to/a/sample.pdf"
```
Expect 201, `data.fileUrl` like `/uploads/documents/<CASE_ID>/<id>.pdf`.

Confirm the file is actually servable:
```bash
curl -s -b cookies.txt -I "http://localhost:5000/uploads/documents/<CASE_ID>/<id>.pdf"
```
Expect `200`.

Confirm the case detail response now includes it:
```bash
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases/<CASE_ID>" | grep -o '"documents":\[[^]]*\]'
```

Try an oversized/wrong-type file (expect 400 from Multer's `fileFilter`/`limits`), and
delete it:
```bash
curl -s -b cookies.txt -X DELETE "http://localhost:5000/api/v1/cases/<CASE_ID>/documents/<DOCUMENT_ID>"
```
Expect 200, and confirm the file no longer exists on disk
(`ls Server/uploads/documents/<CASE_ID>/`).

- [ ] **Step 8: Commit**

```bash
git add Server/Src/Middlewares/Multer/uploadDocument.js Server/Src/Utils/Documents Server/Src/Services/Documents Server/Src/Controllers/Documents Server/Src/Routes/Documents Server/cmd/Server/Server.js
git commit -m "Add Document upload/delete API"
```

---

### Task 3: Backend — Accounts aggregate (minimal create + list)

**Files:**
- Create: `Server/Src/Services/Accounts/accountsService.js`
- Create: `Server/Src/Controllers/Accounts/accountsController.js`
- Create: `Server/Src/Routes/Accounts/accountsRoute.js`
- Modify: `Server/cmd/Server/Server.js`

**Interfaces:**
- Consumes: `Prisma.account`, `Prisma.accountTransaction` (both pre-existing from the
  accounts ledger schema plan).
- Produces: `listAccounts`, `createAccount`, `getAccountBalances`, `CREDIT_TYPES`,
  `DEBIT_TYPES` (exported from `accountsService.js` — Task 1's `recordFeePayment`
  already consumes `Prisma.account` directly, not this service, but a later Finance
  module will import `getAccountBalances`/`CREDIT_TYPES`/`DEBIT_TYPES` from here), and
  `GET/POST /api/v1/accounts` — Task 4's frontend service calls these exact paths.

- [ ] **Step 1: Create `Server/Src/Services/Accounts/accountsService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const ACCOUNT_TYPES = ["BANK", "CASH", "OTHER"];
const CURRENCIES = ["USD", "INR"];

export const CREDIT_TYPES = ["OPENING_BALANCE", "PAYMENT_RECEIVED"];
export const DEBIT_TYPES = ["EXPENSE_PAID", "REFUND_ISSUED"];

/**
 * The single place account balance is computed — never duplicate this math
 * elsewhere. A single Prisma `groupBy` can't net two directions of the same summed
 * column, so this runs one query per direction and merges them in JS.
 * @param {string} accountId
 * @returns {Promise<Record<string, number>>} e.g. { USD: 400, INR: 0 }
 */
export const getAccountBalances = async (accountId) => {
  const [credits, debits] = await Promise.all([
    Prisma.accountTransaction.groupBy({
      by: ["currency"],
      where: { accountId, type: { in: CREDIT_TYPES } },
      _sum: { amount: true },
    }),
    Prisma.accountTransaction.groupBy({
      by: ["currency"],
      where: { accountId, type: { in: DEBIT_TYPES } },
      _sum: { amount: true },
    }),
  ]);

  const balances = {};
  for (const currency of CURRENCIES) balances[currency] = 0;
  for (const row of credits) {
    balances[row.currency] = (balances[row.currency] || 0) + Number(row._sum.amount || 0);
  }
  for (const row of debits) {
    balances[row.currency] = (balances[row.currency] || 0) - Number(row._sum.amount || 0);
  }
  return balances;
};

export const listAccounts = async () => {
  const accounts = await Prisma.account.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    accounts.map(async (account) => ({
      ...account,
      balances: await getAccountBalances(account.id),
    })),
  );
};

/**
 * @param {{ name: string, type: string, notes?: string, openingBalances?: { currency: string, amount: number|string }[] }} data
 * @param {string} userId
 */
export const createAccount = async (data, userId) => {
  const { name, type, notes, openingBalances } = data;

  if (!name?.trim()) {
    throw new AppError("Account name is required", 400, "VALIDATION_ERROR");
  }
  if (!ACCOUNT_TYPES.includes(type)) {
    throw new AppError(
      `type must be one of: ${ACCOUNT_TYPES.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const existing = await Prisma.account.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new AppError("Account name already exists", 409, "CONFLICT");
  }

  const validOpeningBalances = [];
  if (Array.isArray(openingBalances)) {
    for (const entry of openingBalances) {
      if (!entry?.currency || !CURRENCIES.includes(entry.currency)) {
        throw new AppError(
          `Opening balance currency must be one of: ${CURRENCIES.join(", ")}`,
          400,
          "VALIDATION_ERROR",
        );
      }
      if (
        entry.amount === undefined ||
        entry.amount === null ||
        entry.amount === "" ||
        Number(entry.amount) <= 0
      ) {
        continue; // skip blank/zero entries rather than rejecting the whole request
      }
      validOpeningBalances.push(entry);
    }
  }

  const created = await Prisma.account.create({
    data: {
      name: name.trim(),
      type,
      notes: notes?.trim() || null,
      transactions: validOpeningBalances.length
        ? {
            create: validOpeningBalances.map((entry) => ({
              type: "OPENING_BALANCE",
              amount: entry.amount,
              currency: entry.currency,
              createdById: userId,
            })),
          }
        : undefined,
    },
  });

  return { ...created, balances: await getAccountBalances(created.id) };
};
```

- [ ] **Step 2: Create `Server/Src/Controllers/Accounts/accountsController.js`**

```js
import asyncHandler from "express-async-handler";
import { listAccounts, createAccount } from "../../Services/Accounts/accountsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listAccountsCtrl = asyncHandler(async (req, res) => {
  const accounts = await listAccounts();
  return sendSuccess(res, "Accounts retrieved successfully", { accounts });
});

export const createAccountCtrl = asyncHandler(async (req, res) => {
  const account = await createAccount(req.body, req.user.id);
  return sendCreated(res, "Account created successfully", account);
});
```

- [ ] **Step 3: Create `Server/Src/Routes/Accounts/accountsRoute.js`**

```js
import express from "express";
import { listAccountsCtrl, createAccountCtrl } from "../../Controllers/Accounts/accountsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["MANAGE_ACCOUNTS", "MANAGE_FINANCE"]),
  listAccountsCtrl,
);
router.post("/", RequirePermission("MANAGE_ACCOUNTS"), createAccountCtrl);

export default router;
```

- [ ] **Step 4: Mount the router in `Server/cmd/Server/Server.js`**

Find:
```js
import documentsRoutes from "../../Src/Routes/Documents/documentsRoute.js";
```

Replace with:
```js
import documentsRoutes from "../../Src/Routes/Documents/documentsRoute.js";
import accountsRoutes from "../../Src/Routes/Accounts/accountsRoute.js";
```

Find:
```js
Server.use("/api/v1/cases/:caseId/documents", documentsRoutes);
```

Replace with:
```js
Server.use("/api/v1/cases/:caseId/documents", documentsRoutes);
Server.use("/api/v1/accounts", accountsRoutes);
```

- [ ] **Step 5: Manual verification**

```bash
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/accounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"HDFC Operating","type":"BANK","openingBalances":[{"currency":"USD","amount":2000}]}'
```
Expect 201, `data.balances` = `{"USD":2000,"INR":0}`.

```bash
curl -s -b cookies.txt "http://localhost:5000/api/v1/accounts"
```
Expect the account above listed with the same balances.

Confirm duplicate-name rejection:
```bash
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/accounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"HDFC Operating","type":"BANK"}'
```
Expect 409 "Account name already exists".

If Task 1's fee-payment verification hasn't run yet, use this account's id for it now
— `recordFeePayment` should move this account's USD balance from 2000 to 2400 (or
whatever the fee was). Re-run `GET /api/v1/accounts` afterward to confirm.

- [ ] **Step 6: Commit**

```bash
git add Server/Src/Services/Accounts Server/Src/Controllers/Accounts Server/Src/Routes/Accounts Server/cmd/Server/Server.js
git commit -m "Add minimal Account create/list API with balance computation"
```

---

### Task 4: Frontend foundation — types, validations, and services

**Files:**
- Create: `aster/types/visa.ts`, `aster/types/document.ts`, `aster/types/account.ts`
- Modify: `aster/types/case.ts`
- Modify: `aster/lib/validations/case.ts`
- Create: `aster/lib/validations/account.ts`
- Modify: `aster/services/cases.ts`
- Create: `aster/services/documents.ts`, `aster/services/accounts.ts`

**Interfaces:**
- Consumes: Task 1-3's API endpoints; pre-existing `api`/`getErrorMessage`
  (`@/utils/api`).
- Produces: `VisaApplication`, `CaseDocument`, `Account` types and every new service
  function — Task 5 and Task 6 both import these directly.

- [ ] **Step 1: Create `aster/types/visa.ts`**

```ts
export type VisaApplicationStatus =
  | "PENDING"
  | "FEE_PAID"
  | "EMBASSY_VISITED"
  | "APPROVED"
  | "REJECTED";

export type TravelerType = "PATIENT" | "ATTENDANT";

export type VisaFeePayment = {
  id: string;
  amount: string;
  currency: "USD" | "INR";
  feeType: "DIRECT" | "AGENCY";
  paidAt: string;
};

export type VisaApplication = {
  id: string;
  caseId: string;
  travelerType: TravelerType;
  status: VisaApplicationStatus;
  visaNumber: string | null;
  embassyVisitDate: string | null;
  notes: string | null;
  payment: VisaFeePayment | null;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Create `aster/types/document.ts`**

```ts
// Named CaseDocument (not Document) to avoid clashing with the DOM's global
// `Document` type.
export type DocumentType =
  | "PATIENT_PASSPORT"
  | "ATTENDANT_PASSPORT"
  | "INVITATION_LETTER"
  | "VISA_COPY"
  | "OTHER";

export type CaseDocument = {
  id: string;
  caseId: string;
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  uploadedById: string;
  createdAt: string;
};
```

- [ ] **Step 3: Create `aster/types/account.ts`**

```ts
export type AccountType = "BANK" | "CASH" | "OTHER";

export type AccountBalances = Record<string, number>;

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  isActive: boolean;
  notes: string | null;
  balances: AccountBalances;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 4: Extend `aster/types/case.ts`**

Find:
```ts
import type { Gender, Patient } from "@/types/patient";
import type { Agency } from "@/types/agency";
import type { Hospital } from "@/types/hospital";
```

Replace with:
```ts
import type { Gender, Patient } from "@/types/patient";
import type { Agency } from "@/types/agency";
import type { Hospital } from "@/types/hospital";
import type { VisaApplication } from "@/types/visa";
import type { CaseDocument } from "@/types/document";
```

Find:
```ts
export type Case = {
  id: string;
  caseNumber: string;
  reachOutType: ReachOutType;
  status: CaseStatus;
  notes: string | null;
  patient: Patient;
  attendant: Attendant | null;
  agency: Agency | null;
  assignedTo: (CaseAssignee & { username: string }) | null;
  inquiries: HospitalInquiry[];
  createdAt: string;
  updatedAt: string;
};
```

Replace with:
```ts
export type Case = {
  id: string;
  caseNumber: string;
  reachOutType: ReachOutType;
  status: CaseStatus;
  notes: string | null;
  patient: Patient;
  attendant: Attendant | null;
  agency: Agency | null;
  assignedTo: (CaseAssignee & { username: string }) | null;
  inquiries: HospitalInquiry[];
  visaApplications: VisaApplication[];
  documents: CaseDocument[];
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 5: Append 3 new schemas to `aster/lib/validations/case.ts`**

Append at the end of the file:
```ts

export const feePaymentSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  notes: z.string().max(1000).optional(),
});

export type FeePaymentFormValues = z.infer<typeof feePaymentSchema>;

export const embassyVisitSchema = z.object({
  embassyVisitDate: z.string().min(1, "Embassy visit date is required"),
  notes: z.string().max(1000).optional(),
});

export type EmbassyVisitFormValues = z.infer<typeof embassyVisitSchema>;

export const visaOutcomeSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    visaNumber: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((v) => v.status !== "APPROVED" || !!v.visaNumber?.trim(), {
    message: "Visa number is required when approved",
    path: ["visaNumber"],
  });

export type VisaOutcomeFormValues = z.infer<typeof visaOutcomeSchema>;
```

- [ ] **Step 6: Create `aster/lib/validations/account.ts`**

```ts
import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(150),
  type: z.enum(["BANK", "CASH", "OTHER"]),
  notes: z.string().max(500).optional(),
  openingBalanceUSD: z.string().optional(),
  openingBalanceINR: z.string().optional(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

/**
 * Converts the form's two fixed currency fields into the flat array the backend
 * expects — only USD/INR exist as currencies (per Currency enum), so a dynamic list
 * UI would be over-engineering for exactly two fixed fields.
 */
export function buildAccountPayload(values: AccountFormValues) {
  const openingBalances: { currency: "USD" | "INR"; amount: string }[] = [];
  if (values.openingBalanceUSD && Number(values.openingBalanceUSD) > 0) {
    openingBalances.push({ currency: "USD", amount: values.openingBalanceUSD });
  }
  if (values.openingBalanceINR && Number(values.openingBalanceINR) > 0) {
    openingBalances.push({ currency: "INR", amount: values.openingBalanceINR });
  }

  return {
    name: values.name,
    type: values.type,
    notes: values.notes?.trim() || undefined,
    openingBalances: openingBalances.length ? openingBalances : undefined,
  };
}
```

- [ ] **Step 7: Add 3 functions to `aster/services/cases.ts`**

Find:
```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult, HospitalInquiry } from "@/types/case";
import type { PatientSummary } from "@/types/patient";
```

Replace with:
```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult, HospitalInquiry } from "@/types/case";
import type { PatientSummary } from "@/types/patient";
import type { VisaApplication } from "@/types/visa";
```

Then find:
```ts
export { getErrorMessage };
export type { CaseListItem };
```

Replace with:
```ts
export async function recordFeePayment(
  caseId: string,
  visaApplicationId: string,
  payload: { accountId: string; amount: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.post<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/fee-payment`,
    payload,
  );
  return unwrap(response);
}

export async function markEmbassyVisited(
  caseId: string,
  visaApplicationId: string,
  payload: { embassyVisitDate: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.patch<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/embassy-visit`,
    payload,
  );
  return unwrap(response);
}

export async function recordVisaOutcome(
  caseId: string,
  visaApplicationId: string,
  payload: { status: "APPROVED" | "REJECTED"; visaNumber?: string; notes?: string },
): Promise<VisaApplication> {
  const response = await api.patch<ApiSuccess<VisaApplication>>(
    `/cases/${caseId}/visa-applications/${visaApplicationId}/outcome`,
    payload,
  );
  return unwrap(response);
}

export { getErrorMessage };
export type { CaseListItem };
```

- [ ] **Step 8: Create `aster/services/documents.ts`**

```ts
import api, { getErrorMessage } from "@/utils/api";
import type { CaseDocument, DocumentType } from "@/types/document";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function uploadDocument(
  caseId: string,
  file: File,
  type: DocumentType,
): Promise<CaseDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await api.post<ApiSuccess<CaseDocument>>(
    `/cases/${caseId}/documents`,
    formData,
  );
  return unwrap(response);
}

export async function deleteDocument(caseId: string, documentId: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(
    `/cases/${caseId}/documents/${documentId}`,
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
```

- [ ] **Step 9: Create `aster/services/accounts.ts`**

```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Account } from "@/types/account";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function listAccounts(): Promise<Account[]> {
  const response = await api.get<ApiSuccess<{ accounts: Account[] }>>("/accounts");
  return unwrap(response).accounts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccount(payload: Record<string, any>): Promise<Account> {
  const response = await api.post<ApiSuccess<Account>>("/accounts", payload);
  return unwrap(response);
}

export { getErrorMessage };
```

- [ ] **Step 10: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors beyond the known pre-existing ones (`calendar.tsx`/
`rich-text-editor.tsx` missing packages).

- [ ] **Step 11: Commit**

```bash
git add aster/types/visa.ts aster/types/document.ts aster/types/account.ts aster/types/case.ts aster/lib/validations/case.ts aster/lib/validations/account.ts aster/services/cases.ts aster/services/documents.ts aster/services/accounts.ts
git commit -m "Add types, validations, and services for visa processing, documents, and accounts"
```

---

### Task 5: Frontend — Accounts pages + sidebar link

**Files:**
- Create: `aster/app/dashboard/accounts/page.tsx`,
  `aster/components/accounts/accounts-table.tsx`,
  `aster/components/accounts/account-form-dialog.tsx`
- Modify: `aster/components/Layout/Sidebar.tsx`

**Interfaces:**
- Consumes: Task 4's `services/accounts.ts`, `types/account.ts`,
  `lib/validations/account.ts`; pre-existing `usePermissionGuard`, `useToast`,
  `PageHeader`.
- Produces: the `/dashboard/accounts` page — no later task depends on this beyond the
  sidebar link added in this same task.

- [ ] **Step 1: Create `aster/components/accounts/account-form-dialog.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountSchema, type AccountFormValues } from "@/lib/validations/account";

type AccountFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
};

const EMPTY_VALUES: AccountFormValues = {
  name: "",
  type: "BANK",
  notes: "",
  openingBalanceUSD: "",
  openingBalanceINR: "",
};

export function AccountFormDialog({ open, onOpenChange, onSubmit }: AccountFormDialogProps) {
  const form = useForm<AccountFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (open) form.reset(EMPTY_VALUES);
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = accountSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof AccountFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. HDFC Operating" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BANK">Bank</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openingBalanceUSD"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening balance (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingBalanceINR"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening balance (INR)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `aster/components/accounts/accounts-table.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listAccounts,
  createAccount,
  getErrorMessage,
} from "@/services/accounts";
import { buildAccountPayload, type AccountFormValues } from "@/lib/validations/account";
import type { Account } from "@/types/account";

function formatBalances(balances: Account["balances"]) {
  return Object.entries(balances)
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
    .join(" · ") || "—";
}

export function AccountsTable() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listAccounts());
    } catch (error) {
      toast.error("Failed to load accounts", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async (values: AccountFormValues) => {
    try {
      await createAccount(buildAccountPayload(values));
      toast.success("Account created");
      setDialogOpen(false);
      fetchAll();
    } catch (error) {
      toast.error("Save failed", getErrorMessage(error));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add account
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  No accounts yet.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{account.type}</Badge>
                </TableCell>
                <TableCell>{formatBalances(account.balances)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AccountFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}
```

- [ ] **Step 3: Create `aster/app/dashboard/accounts/page.tsx`**

```tsx
"use client";

import { PageHeader } from "@/components/users/page-header";
import { AccountsTable } from "@/components/accounts/accounts-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function AccountsPage() {
  const allowed = usePermissionGuard("MANAGE_ACCOUNTS");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Accounts"
        description="Bank and cash accounts money is received into and paid out of."
      />
      <AccountsTable />
    </div>
  );
}
```

- [ ] **Step 4: Add the "Accounts" nav item to `aster/components/Layout/Sidebar.tsx`**

Find:
```tsx
  List,
  UserPlus,
  Building2,
  Handshake,
  ClipboardList,
  FilePlus2,
} from "lucide-react";
```

Replace with:
```tsx
  List,
  UserPlus,
  Building2,
  Handshake,
  ClipboardList,
  FilePlus2,
  Wallet,
} from "lucide-react";
```

Find:
```tsx
  {
    name: "Agencies",
    href: "/dashboard/agencies",
    icon: Handshake,
    children: null,
    permission: "MANAGE_AGENCIES",
  },
```

Replace with:
```tsx
  {
    name: "Agencies",
    href: "/dashboard/agencies",
    icon: Handshake,
    children: null,
    permission: "MANAGE_AGENCIES",
  },
  {
    name: "Accounts",
    href: "/dashboard/accounts",
    icon: Wallet,
    children: null,
    permission: "MANAGE_ACCOUNTS",
  },
```

- [ ] **Step 5: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add aster/app/dashboard/accounts aster/components/accounts aster/components/Layout/Sidebar.tsx
git commit -m "Add Accounts list/create page and sidebar link"
```

---

### Task 6: Frontend — Case detail: VisaApplication panel + Documents panel

**Files:**
- Create: `aster/components/cases/fee-payment-dialog.tsx`,
  `aster/components/cases/embassy-visit-dialog.tsx`,
  `aster/components/cases/visa-outcome-dialog.tsx`,
  `aster/components/cases/visa-application-panel.tsx`,
  `aster/components/cases/upload-document-dialog.tsx`,
  `aster/components/cases/documents-panel.tsx`
- Modify: `aster/app/dashboard/cases/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 4's `services/cases.ts` (`recordFeePayment`/`markEmbassyVisited`/
  `recordVisaOutcome`), `services/documents.ts`, `services/accounts.ts`; pre-existing
  `useToast`, `useRBAC`, `getImageUrl` (`@/utils/imageUtils`).
- Produces: the two panels rendered on the case detail page — this is the last piece
  of this plan's own UI; Task 7 is verification only.

- [ ] **Step 1: Create `aster/components/cases/fee-payment-dialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { feePaymentSchema, type FeePaymentFormValues } from "@/lib/validations/case";
import { listAccounts } from "@/services/accounts";
import type { Account } from "@/types/account";
import type { ReachOutType } from "@/types/case";

type FeePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reachOutType: ReachOutType;
  onSubmit: (values: { accountId: string; amount: string; notes?: string }) => Promise<void>;
};

export function FeePaymentDialog({
  open,
  onOpenChange,
  reachOutType,
  onSubmit,
}: FeePaymentDialogProps) {
  const defaultAmount = reachOutType === "AGENCY" ? "100" : "400";
  const form = useForm<FeePaymentFormValues>({
    defaultValues: { accountId: "", amount: defaultAmount, notes: "" },
  });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (open) {
      form.reset({ accountId: "", amount: defaultAmount, notes: "" });
      listAccounts()
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record fee payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = feePaymentSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof FeePaymentFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `aster/components/cases/embassy-visit-dialog.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { embassyVisitSchema, type EmbassyVisitFormValues } from "@/lib/validations/case";

type EmbassyVisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { embassyVisitDate: string; notes?: string }) => Promise<void>;
};

export function EmbassyVisitDialog({ open, onOpenChange, onSubmit }: EmbassyVisitDialogProps) {
  const form = useForm<EmbassyVisitFormValues>({
    defaultValues: { embassyVisitDate: "", notes: "" },
  });

  useEffect(() => {
    if (open) form.reset({ embassyVisitDate: "", notes: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record embassy visit</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = embassyVisitSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof EmbassyVisitFormValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="embassyVisitDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embassy visit date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `aster/components/cases/visa-outcome-dialog.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { visaOutcomeSchema, type VisaOutcomeFormValues } from "@/lib/validations/case";

type VisaOutcomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { status: "APPROVED" | "REJECTED"; visaNumber?: string; notes?: string }) => Promise<void>;
};

export function VisaOutcomeDialog({ open, onOpenChange, onSubmit }: VisaOutcomeDialogProps) {
  const form = useForm<VisaOutcomeFormValues>({
    defaultValues: { status: "APPROVED", visaNumber: "", notes: "" },
  });
  const status = form.watch("status");

  useEffect(() => {
    if (open) form.reset({ status: "APPROVED", visaNumber: "", notes: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record visa outcome</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = visaOutcomeSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(
                    (issue.path[0] as keyof VisaOutcomeFormValues) ?? "status",
                    { message: issue.message },
                  );
                }
                return;
              }
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {status === "APPROVED" && (
              <FormField
                control={form.control}
                name="visaNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visa number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `aster/components/cases/visa-application-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeePaymentDialog } from "@/components/cases/fee-payment-dialog";
import { EmbassyVisitDialog } from "@/components/cases/embassy-visit-dialog";
import { VisaOutcomeDialog } from "@/components/cases/visa-outcome-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import {
  recordFeePayment,
  markEmbassyVisited,
  recordVisaOutcome,
  getErrorMessage,
} from "@/services/cases";
import type { Case } from "@/types/case";
import type { VisaApplication, VisaApplicationStatus } from "@/types/visa";

const STATUS_VARIANT: Record<VisaApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  FEE_PAID: "outline",
  EMBASSY_VISITED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type VisaApplicationPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function VisaApplicationPanel({ kase, onChanged }: VisaApplicationPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [feePaymentTarget, setFeePaymentTarget] = useState<VisaApplication | null>(null);
  const [embassyVisitTarget, setEmbassyVisitTarget] = useState<VisaApplication | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<VisaApplication | null>(null);

  if (kase.visaApplications.length === 0) return null;

  const handleFeePayment = async (values: { accountId: string; amount: string; notes?: string }) => {
    if (!feePaymentTarget) return;
    try {
      await recordFeePayment(kase.id, feePaymentTarget.id, values);
      toast.success("Fee payment recorded");
      setFeePaymentTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record payment", getErrorMessage(error));
      throw error;
    }
  };

  const handleEmbassyVisit = async (values: { embassyVisitDate: string; notes?: string }) => {
    if (!embassyVisitTarget) return;
    try {
      await markEmbassyVisited(kase.id, embassyVisitTarget.id, values);
      toast.success("Embassy visit recorded");
      setEmbassyVisitTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record embassy visit", getErrorMessage(error));
      throw error;
    }
  };

  const handleOutcome = async (values: { status: "APPROVED" | "REJECTED"; visaNumber?: string; notes?: string }) => {
    if (!outcomeTarget) return;
    try {
      await recordVisaOutcome(kase.id, outcomeTarget.id, values);
      toast.success("Visa outcome recorded");
      setOutcomeTarget(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record outcome", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visa processing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kase.visaApplications.map((visaApplication) => (
          <div key={visaApplication.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {visaApplication.travelerType === "PATIENT" ? "Patient" : "Attendant"}
              </p>
              <Badge variant={STATUS_VARIANT[visaApplication.status]}>
                {visaApplication.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {visaApplication.payment && (
              <p className="mt-1 text-xs text-muted-foreground">
                Fee paid: {visaApplication.payment.amount} {visaApplication.payment.currency}
              </p>
            )}
            {visaApplication.embassyVisitDate && (
              <p className="text-xs text-muted-foreground">
                Embassy visited: {formatDate(visaApplication.embassyVisitDate)}
              </p>
            )}
            {visaApplication.visaNumber && (
              <p className="text-xs text-muted-foreground">
                Visa number: {visaApplication.visaNumber}
              </p>
            )}

            {visaApplication.status === "PENDING" && hasPermission("MANAGE_FINANCE") && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setFeePaymentTarget(visaApplication)}
              >
                Record fee payment
              </Button>
            )}
            {visaApplication.status === "FEE_PAID" && hasPermission("UPDATE_CASES") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setEmbassyVisitTarget(visaApplication)}
              >
                Mark embassy visited
              </Button>
            )}
            {visaApplication.status === "EMBASSY_VISITED" && hasPermission("UPDATE_CASES") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setOutcomeTarget(visaApplication)}
              >
                Record outcome
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <FeePaymentDialog
        open={!!feePaymentTarget}
        onOpenChange={(open) => !open && setFeePaymentTarget(null)}
        reachOutType={kase.reachOutType}
        onSubmit={handleFeePayment}
      />
      <EmbassyVisitDialog
        open={!!embassyVisitTarget}
        onOpenChange={(open) => !open && setEmbassyVisitTarget(null)}
        onSubmit={handleEmbassyVisit}
      />
      <VisaOutcomeDialog
        open={!!outcomeTarget}
        onOpenChange={(open) => !open && setOutcomeTarget(null)}
        onSubmit={handleOutcome}
      />
    </Card>
  );
}
```

- [ ] **Step 5: Create `aster/components/cases/upload-document-dialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentType } from "@/types/document";

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, type: DocumentType) => Promise<void>;
};

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "PATIENT_PASSPORT", label: "Patient passport" },
  { value: "ATTENDANT_PASSPORT", label: "Attendant passport" },
  { value: "INVITATION_LETTER", label: "Invitation letter" },
  { value: "VISA_COPY", label: "Visa copy" },
  { value: "OTHER", label: "Other" },
];

export function UploadDocumentDialog({ open, onOpenChange, onSubmit }: UploadDocumentDialogProps) {
  const [type, setType] = useState<DocumentType>("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("OTHER");
      setFile(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!file) {
      setError("Select a file to upload");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(file, type);
    } catch {
      // Error toast is handled by the caller; keep the dialog open on failure.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Create `aster/components/cases/documents-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { UploadDocumentDialog } from "@/components/cases/upload-document-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { uploadDocument, deleteDocument, getErrorMessage } from "@/services/documents";
import { getImageUrl } from "@/utils/imageUtils";
import type { Case } from "@/types/case";
import type { DocumentType } from "@/types/document";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PATIENT_PASSPORT: "Patient passport",
  ATTENDANT_PASSPORT: "Attendant passport",
  INVITATION_LETTER: "Invitation letter",
  VISA_COPY: "Visa copy",
  OTHER: "Other",
};

type DocumentsPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function DocumentsPanel({ kase, onChanged }: DocumentsPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [uploadOpen, setUploadOpen] = useState(false);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Document",
    onDelete: async (id) => {
      await deleteDocument(kase.id, id);
    },
    onSuccess: onChanged,
  });

  const handleUpload = async (file: File, type: DocumentType) => {
    try {
      await uploadDocument(kase.id, file, type);
      toast.success("Document uploaded");
      setUploadOpen(false);
      onChanged();
    } catch (error) {
      toast.error("Upload failed", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documents</CardTitle>
        {hasPermission("UPDATE_CASES") && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {kase.documents.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
        {kase.documents.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[document.type]}</p>
              <p className="text-xs text-muted-foreground">{document.fileName}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild>
                <a href={getImageUrl(document.fileUrl)} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              {hasPermission("DELETE_CASES") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    handleDeleteClick({ id: document.id, name: document.fileName })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete document"
        description="This cannot be undone."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </Card>
  );
}
```

- [ ] **Step 7: Wire both panels into the case detail page**

In `aster/app/dashboard/cases/[id]/page.tsx`, find:
```tsx
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { HospitalInquiryPanel } from "@/components/cases/hospital-inquiry-panel";
```

Replace with:
```tsx
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { HospitalInquiryPanel } from "@/components/cases/hospital-inquiry-panel";
import { VisaApplicationPanel } from "@/components/cases/visa-application-panel";
import { DocumentsPanel } from "@/components/cases/documents-panel";
```

Find:
```tsx
      <CaseDetailView kase={kase} />
      <HospitalInquiryPanel kase={kase} onChanged={refetch} />
```

Replace with:
```tsx
      <CaseDetailView kase={kase} />
      <HospitalInquiryPanel kase={kase} onChanged={refetch} />
      <VisaApplicationPanel kase={kase} onChanged={refetch} />
      <DocumentsPanel kase={kase} onChanged={refetch} />
```

- [ ] **Step 8: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add aster/components/cases/fee-payment-dialog.tsx aster/components/cases/embassy-visit-dialog.tsx aster/components/cases/visa-outcome-dialog.tsx aster/components/cases/visa-application-panel.tsx aster/components/cases/upload-document-dialog.tsx aster/components/cases/documents-panel.tsx "aster/app/dashboard/cases/[id]/page.tsx"
git commit -m "Add VisaApplication and Documents panels to the case detail page"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-6.

- [ ] **Step 1: Full manual browser pass**

With both servers running (`Server/`: `npm run dev`; `aster/`: `npm run dev`):

1. Log in as ADMIN. Go to `/dashboard/accounts`, create an account (e.g. "Test
   Operating", type Bank, opening balance $2000 USD). Confirm it appears in the list
   with the right balance.
2. Create a case with an attendant, send it to a hospital, and accept the inquiry
   (reuse the existing Cases module flow). Confirm the case detail page now shows a
   new "Visa processing" card with two entries (Patient, Attendant), both `PENDING`.
3. Click "Record fee payment" on the patient's entry, pick the account created in
   step 1, confirm the amount defaulted to $400 (or $100 if this was an agency case),
   submit. Confirm the entry now shows `FEE_PAID` and the case's status badge updates
   to `VISA_PROCESSING`.
4. Click "Mark embassy visited", pick a date, submit. Confirm `EMBASSY_VISITED`.
5. Click "Record outcome", choose "Approved", enter a visa number, submit. Confirm the
   entry shows `APPROVED` with the visa number, and the case status is still
   `VISA_PROCESSING` (attendant not yet terminal).
6. Repeat steps 3-5 for the attendant's entry (any outcome). Confirm the case status
   badge updates to `COMPLETED` once both are terminal.
7. On the same case, upload a document (any small PDF or image) under "Documents".
   Confirm it appears in the list; click the download icon and confirm the file opens
   in a new tab. Delete it and confirm it disappears from the list.
8. Go back to `/dashboard/accounts` and confirm the test account's USD balance
   increased by whatever fee amount(s) were recorded in steps 3/6.
9. As a sanity check on the `sendInquiry` guard fix, attempt (via `curl`, not the UI —
   the UI already hides the button once a case is past `HOSPITAL_MATCHING`/
   `HOSPITAL_DECLINED`) to send a new inquiry on this now-`COMPLETED` case and confirm
   it's rejected with 400.

- [ ] **Step 2: Commit**

No code changes in this task — nothing to commit. If any issue surfaces during this
pass, fix it in the relevant task's files and amend that task's commit (or add a small
follow-up commit), then re-run this verification pass.
