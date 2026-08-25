# Domain Schema Design: Accounts & Financial Ledger

## Overview

The domain schema design (`2026-08-20-domain-schema-design.md`) modeled `Payment`,
`Expense`, and `Refund` as case-facing money records, but never modeled *where* that
money actually lives. There's no way today to say "this fee was deposited into which
bank account" or "what's our current USD balance across all accounts." This spec adds
that missing layer: a user-managed `Account` catalog and a ledger that every money
movement writes to, so balances are always derivable and auditable rather than tracked
by hand.

This is an amendment to the domain schema, following the same "schema-only, follow-up
plan implements it" approach as the original spec. No Finance API/UI exists yet (the
Cases module is the only implemented slice so far), so `Payment`/`Expense`/`Refund`
currently have zero rows in any real deployment — this migration needs no backfill.

## Business rules captured

- **Accounts are real, user-managed entities** — not a hardcoded USD/INR pair. A company
  holds money in several places (a US bank account, an Indian bank account, a cash
  till) and needs to add, rename, and eventually retire them over time, the same way
  `Hospital`/`Agency` are user-managed catalogs.
- **Accounts can hold either currency, or both** — a single account isn't restricted to
  one of USD/INR. Balance is tracked per `(account, currency)` pair, not one scalar per
  account.
- **Every money movement must name the account it hit.** The whole point of this spec is
  that nothing moves without a home — a `Payment`, `Expense`, or `Refund` cannot be
  recorded without saying which account received or paid it.
- **Balance is derived, never cached.** A ledger table (`AccountTransaction`) is the
  single source of truth; balance for `(account, currency)` is the sum of that
  account's credit-type entries minus its debit-type entries, filtered to that
  currency. This is the standard approach for money-tracking systems — a cached
  running-balance field can silently drift from reality; a derived sum cannot.
- **Opening balances**: an account being added to Aster may already hold money from
  before Aster started tracking it. Creating an account can optionally record a
  starting amount per currency, written as an `OPENING_BALANCE` ledger entry — no
  special-cased "starting balance" field on `Account` itself, so balance math never
  needs a separate case for it.
- **Accounts can be retired without losing history.** A closed bank account shouldn't be
  hard-deleted (its ledger history and balance must stay reportable) — it should
  disappear from "pick an account" pickers for new transactions but remain fully
  intact for historical reporting.
- **Inter-account movement is out of scope for this slice.** Moving money between two of
  your own accounts (e.g. converting USD fee income into INR to pay a hospital) is a
  real future need but is explicitly deferred — this slice only covers accounts
  existing and Payment/Expense/Refund recording which account they hit.

## Schema

Additions to the schema in `2026-08-20-domain-schema-design.md` (new models/enums only;
existing models are shown where they gain a back-relation).

```prisma
// ---------- Accounts & ledger ----------

model Account {
  id       String      @id @default(cuid())
  name     String      @unique
  type     AccountType
  isActive Boolean     @default(true)
  notes    String?

  transactions AccountTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AccountTransaction {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id])

  type     AccountTransactionType
  amount   Decimal // always positive; direction is implied by type
  currency Currency
  notes    String?

  // Exactly one of these three is set for a Payment/Expense/Refund-sourced entry;
  // all three are null for an OPENING_BALANCE entry. Same independent-optional-FK
  // pattern this schema already uses for Expense.caseId/visaApplicationId — one model
  // covers every ledger-entry origin without a polymorphic association.
  paymentId String?  @unique
  payment   Payment? @relation(fields: [paymentId], references: [id])

  expenseId String?  @unique
  expense   Expense? @relation(fields: [expenseId], references: [id])

  refundId String?  @unique
  refund   Refund?  @relation(fields: [refundId], references: [id])

  createdAt DateTime @default(now())
}

enum AccountType {
  BANK
  CASH
  OTHER
}

enum AccountTransactionType {
  OPENING_BALANCE  // credit
  PAYMENT_RECEIVED // credit
  EXPENSE_PAID     // debit
  REFUND_ISSUED    // debit
}
```

Existing models gain a back-relation (added to each model's block, not shown in full
here since the rest of each model is unchanged from the original spec):

```prisma
model Payment {
  // ...existing fields unchanged...
  accountTransaction AccountTransaction?
}

model Expense {
  // ...existing fields unchanged...
  accountTransaction AccountTransaction?
}

model Refund {
  // ...existing fields unchanged...
  accountTransaction AccountTransaction?
}
```

## Design notes / rationale

- **Ledger table, not `accountId` directly on Payment/Expense/Refund:** a generic
  `AccountTransaction` is the single place to query "this account's full history and
  balance," rather than merging three differently-shaped tables. It also extends
  cleanly to future entry types (a later transfer/exchange slice just adds another
  `AccountTransactionType` and two `accountId` fields — no change to how balance is
  computed for existing entries).
- **`amount` is always positive; direction comes from `type`.** Avoids the ambiguity of
  signed amounts meaning different things in different contexts — `OPENING_BALANCE`
  and `PAYMENT_RECEIVED` are credits, `EXPENSE_PAID` and `REFUND_ISSUED` are debits,
  and that mapping is fixed, not per-row.
- **No cached balance field on `Account`.** Balance is always `SUM(credits) -
  SUM(debits)` grouped by `(accountId, currency)`, computed on read. This matches the
  "derived, never drifts" decision — the alternative (a running balance field updated
  alongside every write) would need to survive every future money-movement feature
  without ever getting out of sync, which is a much easier property to break than to
  keep.
- **`accountId` "required" on Payment/Expense/Refund is a service-layer rule, not a DB
  column.** The account link lives on `AccountTransaction`, so "every payment must
  specify an account" means: the service that creates a `Payment` always creates its
  paired `AccountTransaction` in the same `Prisma.$transaction` — the identical pattern
  already used for `sendInquiry`/`respondToInquiry` in the Cases module (two writes,
  one atomic unit). The service must also validate the ledger entry's `currency`
  matches the source record's own `currency` field, since `Payment`/`Expense`/`Refund`
  already carry a `currency` and a multi-currency account could otherwise accept a
  mismatched entry.
- **`AccountTransaction.{payment,expense,refund}Id` are each `@unique`,** enforcing
  exactly one ledger entry per Payment/Expense/Refund (a 1:1 pairing, not 1:many) —
  each of those records represents one atomic money movement, not something that gets
  split across multiple ledger rows.
- **`isActive` instead of a hard delete for retiring an account:** an account with any
  `AccountTransaction` history must never be hard-deleted (mirrors the existing
  `_count`-based delete guard already used for `Hospital`/`Agency`); `isActive: false`
  is how a closed account leaves new-transaction pickers while keeping its balance and
  history fully reportable.
- **Opening balance has no dedicated field on `Account`** — it's just another
  `AccountTransaction` with `type: OPENING_BALANCE` and no `payment`/`expense`/`refund`
  link, created (optionally, once per starting currency) at the same time as the
  `Account` itself. This keeps "what is this account's balance" a single, uniform query
  with no special-cased starting value to remember.

## RBAC additions

New permission, seeded and granted to `ADMIN` like the existing ones:

- `MANAGE_ACCOUNTS` — account catalog CRUD (create/edit/deactivate), following the same
  pattern as `MANAGE_HOSPITALS`/`MANAGE_AGENCIES`.

Viewing account balances and ledger history reuses the already-planned `VIEW_FINANCE`
permission from the original domain schema spec — no new view-only permission needed.

## Out of scope (for this spec)

- **Inter-account transfers / currency exchange** (e.g. moving USD fee income into an
  INR account to pay a hospital) — a real future need, explicitly deferred to keep this
  slice focused on "accounts exist and money movements record which one they hit."
  When it's built, it's an additive `AccountTransactionType` (e.g. `TRANSFER_OUT`/
  `TRANSFER_IN`) plus a same-transaction pair of `AccountTransaction` rows — no change
  to this spec's balance-computation logic.
- **The actual API routes/controllers/services, frontend pages, and seed script
  changes** — this spec is schema-only, same as the original domain schema spec.
  Implementation (Account catalog CRUD, and wiring `Payment`/`Expense`/`Refund`
  creation to require picking an account) is a follow-up plan — most naturally the same
  plan that finally implements the Finance module, since Finance can't be built without
  somewhere for its money to go.
- **Multi-account defaults or per-user account preferences** — which account a form
  defaults to, if any, is a UI concern for that future implementation plan.
