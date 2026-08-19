# Domain Schema Design: Case Management & Finance

## Overview

Aster's existing schema (`User`/`Role`/`Permission`) is pure RBAC scaffolding — no domain
model exists yet for what the business actually does. This spec designs that domain model.

Aster is a medical-visa referral company, not a clinical EMR. It connects patients who need
treatment at a partner hospital in India with that hospital, arranges the hospital's
invitation, and runs the Indian visa process for the patient and (optionally) one attendant
traveling with them — collecting a service fee, paying an embassy-partner commission, and
tracking refunds and general company expenses along the way.

## Business rules captured

- **Reach-out sources:** a case originates either as a **direct** lead or via a referring
  **agency**. This determines the visa-registration fee: $400 direct, $100 agency.
- **Travelers:** a case is for one **patient**, plus at most one **attendant** (companion).
  The fee and the visa process apply **per traveler** — an attendant generates its own fee
  and its own visa application, separate from the patient's.
- **Patients are reusable**; a returning patient gets a new `Case` against the same `Patient`
  record rather than re-entering their info. **Attendants are not reusable** — collected fresh
  per case.
- **Hospital matching:** Aster works with multiple partner hospitals. A case's info can be
  sent to more than one hospital (if one declines, try another); each hospital's response —
  accept/decline plus a treatment cost estimate — is tracked per hospital, per case.
- **Visa pipeline:** once a hospital accepts, the visa-registration fee is collected per
  traveler, the embassy is visited (a fixed, per-traveler commission is paid to an embassy
  partner regardless of direct/agency), and the visa is approved or rejected.
- **Refunds:** the patient/agency can cancel at any stage, not just on a hospital/embassy
  rejection. A refund always reverses a specific previously-collected `Payment`.
- **Finance is broader than case money:** beyond fees/commissions/refunds tied to a case,
  the system also needs to record general company expenses (rent, salaries, etc.) not tied
  to any case.
- **Multi-currency:** USD and INR, since fees are collected in USD but hospital/embassy-side
  costs are effectively in INR.
- **Case ownership:** each case is assigned to a staff member (`User`) for accountability.
- **Documents:** file attachments (passport scans, invitation letters, visa copies) must be
  stored, not just tracked as status flags.

## Schema

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ---------- Identity & RBAC (existing) ----------

model User {
  id        String  @id @default(cuid())
  username  String  @unique
  email     String? @unique
  password  String
  firstName String
  lastName  String
  avatar    String  @default("https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png")

  roleId String
  role   Role   @relation(fields: [roleId], references: [id])

  assignedCases     Case[]
  documentsUploaded Document[]
  paymentsReceived  Payment[]  @relation("PaymentsReceived")
  expensesPaid      Expense[]  @relation("ExpensesPaid")
  refundsIssued     Refund[]   @relation("RefundsIssued")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Role {
  id   String @id @default(cuid())
  name String @unique

  users       User[]
  permissions Permission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Permission {
  id   String @id @default(cuid())
  name String @unique

  roles Role[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------- Case management ----------

model Patient {
  id             String   @id @default(cuid())
  firstName      String
  lastName       String
  gender         Gender
  dateOfBirth    DateTime
  nationality    String
  passportNumber String
  passportExpiry DateTime
  phone          String
  email          String?
  address        String?

  cases Case[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Attendant {
  id                String   @id @default(cuid())
  firstName         String
  lastName          String
  gender            Gender
  dateOfBirth       DateTime
  nationality       String
  passportNumber    String
  passportExpiry    DateTime
  phone             String
  relationToPatient String

  caseId String @unique
  case   Case   @relation(fields: [caseId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Agency {
  id            String  @id @default(cuid())
  name          String  @unique
  contactPerson String?
  phone         String?
  email         String?
  address       String?

  cases Case[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Case {
  id           String       @id @default(cuid())
  caseNumber   String       @unique
  reachOutType ReachOutType
  status       CaseStatus   @default(NEW)

  patientId String
  patient   Patient    @relation(fields: [patientId], references: [id])
  attendant Attendant?

  agencyId String?
  agency   Agency? @relation(fields: [agencyId], references: [id])

  assignedToId String?
  assignedTo   User?   @relation(fields: [assignedToId], references: [id])

  notes String?

  inquiries        HospitalInquiry[]
  visaApplications VisaApplication[]
  documents        Document[]
  expenses         Expense[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------- Hospital matching ----------

model Hospital {
  id            String  @id @default(cuid())
  name          String
  city          String
  specialties   String?
  contactPerson String?
  phone         String?
  email         String?

  inquiries HospitalInquiry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model HospitalInquiry {
  id     String @id @default(cuid())
  caseId String
  case   Case   @relation(fields: [caseId], references: [id])

  hospitalId String
  hospital   Hospital @relation(fields: [hospitalId], references: [id])

  status                HospitalInquiryStatus @default(PENDING)
  treatmentCostEstimate Decimal?
  currency              Currency?
  notes                 String?

  sentAt      DateTime  @default(now())
  respondedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------- Visa & documents ----------

model VisaApplication {
  id     String @id @default(cuid())
  caseId String
  case   Case   @relation(fields: [caseId], references: [id])

  travelerType TravelerType
  status       VisaStatus   @default(PENDING)

  visaNumber       String?
  embassyVisitDate DateTime?
  notes            String?

  payment  Payment?
  expenses Expense[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([caseId, travelerType])
}

model Document {
  id     String @id @default(cuid())
  caseId String
  case   Case   @relation(fields: [caseId], references: [id])

  type     DocumentType
  fileUrl  String
  fileName String

  uploadedById String
  uploadedBy   User   @relation(fields: [uploadedById], references: [id])

  createdAt DateTime @default(now())
}

// ---------- Finance ----------

model Payment {
  id                String          @id @default(cuid())
  visaApplicationId String          @unique
  visaApplication   VisaApplication @relation(fields: [visaApplicationId], references: [id])

  amount   Decimal
  currency Currency
  feeType  ReachOutType

  receivedById String
  receivedBy   User   @relation("PaymentsReceived", fields: [receivedById], references: [id])

  paidAt    DateTime @default(now())
  createdAt DateTime @default(now())

  refunds Refund[]
}

model Expense {
  id       String  @id @default(cuid())
  category String
  amount   Decimal
  currency Currency
  notes    String?

  caseId String?
  case   Case?   @relation(fields: [caseId], references: [id])

  visaApplicationId String?
  visaApplication   VisaApplication? @relation(fields: [visaApplicationId], references: [id])

  paidById String
  paidBy   User   @relation("ExpensesPaid", fields: [paidById], references: [id])

  incurredAt DateTime @default(now())
  createdAt  DateTime @default(now())
}

model Refund {
  id        String  @id @default(cuid())
  paymentId String
  payment   Payment @relation(fields: [paymentId], references: [id])

  amount Decimal
  reason String

  refundedById String
  refundedBy   User   @relation("RefundsIssued", fields: [refundedById], references: [id])

  refundedAt DateTime @default(now())
  createdAt  DateTime @default(now())
}

// ---------- Enums ----------

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum ReachOutType {
  DIRECT
  AGENCY
}

enum CaseStatus {
  NEW
  HOSPITAL_MATCHING
  HOSPITAL_ACCEPTED
  HOSPITAL_DECLINED
  VISA_PROCESSING
  COMPLETED
  CANCELLED
}

enum HospitalInquiryStatus {
  PENDING
  ACCEPTED
  DECLINED
}

enum TravelerType {
  PATIENT
  ATTENDANT
}

enum VisaStatus {
  PENDING
  FEE_PAID
  EMBASSY_VISITED
  APPROVED
  REJECTED
}

enum DocumentType {
  PATIENT_PASSPORT
  ATTENDANT_PASSPORT
  INVITATION_LETTER
  VISA_COPY
  OTHER
}

enum Currency {
  USD
  INR
}
```

## Design notes / rationale

- **`HospitalInquiry` instead of a single `hospitalId` on `Case`:** a case can be sent to
  more than one hospital before one accepts. The accepted inquiry (if any) is "the" matched
  hospital, derived rather than stored redundantly.
- **`VisaApplication` as the per-traveler anchor:** since fees, embassy commissions, and visa
  status are all per-traveler, `VisaApplication` (one row per `{case, travelerType}`, enforced
  by `@@unique([caseId, travelerType])`) is what `Payment` and per-traveler `Expense` rows
  hang off of, rather than duplicating traveler logic on `Case` itself.
- **`Payment.feeType` is a snapshot**, not a lookup through `Case.reachOutType` — if pricing
  rules ever change, historical payments stay accurate to what was actually charged.
- **`Expense` has independent optional `caseId` and `visaApplicationId`:** embassy commission
  sets `visaApplicationId` (per-traveler), a case-level-but-not-traveler-specific cost would
  set only `caseId`, and general company expenses (rent, salaries) leave both null — one
  model covers all three without a polymorphic association.
- **`Refund` points at `Payment`, not `Case`:** a refund is inherently "undo this specific
  collected fee." `Payment.refunds` is a list (not 1:1) to allow partial refunds without
  forcing that decision now.
- **`Document` hangs off `Case` directly** (not per-traveler) with a `type` enum identifying
  whose/which document it is — avoids polymorphic association complexity for a handful of
  document kinds.
- **`Attendant` is 1:1 with `Case`** (`caseId @unique`), not a reusable master record like
  `Patient` — matches "one attendant max, collected fresh per case."
- **Multi-user relations on `User`** (`PaymentsReceived`, `ExpensesPaid`, `RefundsIssued`)
  are named because Prisma requires disambiguation when multiple relations target the same
  model.
- **`caseNumber`** is a human-readable unique string (e.g. `ASR-CASE-26-08-0001`), generated
  the same way `customUserIdGenerator.js` generates user IDs today — an implementation detail
  for the plan, not a schema concern beyond the `@unique` field.

## RBAC additions

New permissions, seeded in `adminSeed.js` and granted to `ADMIN` like the existing four:

- `VIEW_CASES`, `CREATE_CASES`, `UPDATE_CASES`, `DELETE_CASES`
- `MANAGE_HOSPITALS` — hospital catalog CRUD
- `MANAGE_AGENCIES` — agency catalog CRUD
- `VIEW_FINANCE`, `MANAGE_FINANCE` — record payments/expenses
- `ISSUE_REFUNDS` — kept separate from `MANAGE_FINANCE` since issuing a refund is more
  sensitive than recording routine income/expense, worth its own gate

Document upload/delete is gated by `UPDATE_CASES`/`DELETE_CASES` — it's always in service of
a case, doesn't need its own permission.

## Out of scope (for this spec)

- Agency referral commissions — confirmed not needed; the $100 agency fee is the only
  agency-related money.
- A `TransactionCategory`/general-ledger catalog table — `Expense.category` is a plain string
  for now (per the chosen approach); can be normalized into a catalog later if categories
  proliferate.
- Full audit history of `Case.status` transitions — only the current status is tracked, no
  history table. Can be added later if reporting needs "how long was this case in each
  stage."
- Hospital specialty as a structured/multi-select field — `specialties` is free text for now.
- The actual API routes/controllers/services, frontend pages, and seed script changes that
  implement this schema — this spec is schema-only; implementation is a follow-up plan.
