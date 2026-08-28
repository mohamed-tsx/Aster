# Case Kanban Pipeline Board Design

## Overview

`/dashboard/cases` today is a paginated table. This spec adds a **Kanban board
view** of the same cases — one column per pipeline stage, cases as cards — as an
alternative view toggled alongside the existing table. It is the highest-impact
visual upgrade to the product: coordinators see the whole operation at a glance
instead of scanning a table.

This is a **behavior-and-frontend spec — no schema changes.** Every model and
field it reads (`Case.status`, `CaseEvent`, `HospitalInquiry`, `VisaApplication`,
`Patient.passportExpiry`) already exists. It adds exactly one backend read
endpoint (`GET /cases/board`) and a set of frontend components.

The board also lays the groundwork for the next two roadmap features: the
per-stage **age thresholds** defined here are what feature #2 (case-aging alerts)
will reuse, and `enteredStageAt` is the field both need.

## Key constraint: status is machine-driven

`Case.status` never changes by direct assignment. It only moves as a side effect
of a workflow action, each with strict preconditions and required data:

| Transition | Caused by | Requires |
|---|---|---|
| `NEW` → `HOSPITAL_MATCHING` | first `sendInquiry` | hospital |
| → `HOSPITAL_ACCEPTED` / `HOSPITAL_DECLINED` | `respondToInquiry` | cost estimate, currency |
| → `VISA_PROCESSING` | first `recordFeePayment` | account, amount |
| → `COMPLETED` | all `VisaApplication`s terminal via `recordVisaOutcome` | visa number(s) |
| → `CANCELLED` | `cancelCase` | — |

There is no "set status" endpoint and `updateCase` deliberately never touches
status. Therefore **the board's drag gesture is a shortcut into the existing
workflow dialogs — never a raw status write.** Dragging a card to the next column
opens the dialog that legitimately causes that transition; on the dialog's
success the board refetches and the card lands in its new column. A drag that has
no valid corresponding action is rejected and the card snaps back.

## Columns

Left to right: `NEW`, `HOSPITAL_MATCHING`, `HOSPITAL_ACCEPTED`, `VISA_PROCESSING`,
`COMPLETED`.

- **`HOSPITAL_DECLINED` cases render in the `HOSPITAL_MATCHING` column** with a
  red "Hospital declined" badge. The backend's `SENDABLE_CASE_STATUSES` already
  groups `HOSPITAL_DECLINED` with `NEW`/`HOSPITAL_MATCHING` as "can still send an
  inquiry" — the case is effectively back to needing a hospital, so it belongs
  visually with matching, not in its own dead-end column.
- **`CANCELLED` is hidden by default**, shown via a "Show cancelled" toggle that
  adds a sixth column. Cancelled cards are never draggable.
- `COMPLETED` cards are not draggable (terminal).

## Drag rules

Forward only, one column at a time. Any other drag (backward, skipping a column)
is rejected on drop and the card snaps back with no dialog.

| From → To | Opens | Blocked when |
|---|---|---|
| `NEW` → `HOSPITAL_MATCHING` | `SendInquiryDialog` | never (any `NEW` case can be sent) |
| `HOSPITAL_MATCHING` / `HOSPITAL_DECLINED` → `HOSPITAL_ACCEPTED` | `RespondInquiryDialog`, ACCEPTED preselected | no `PENDING` inquiry on the case → toast "Send an inquiry first" |
| `HOSPITAL_ACCEPTED` → `VISA_PROCESSING` | `FeePaymentDialog` for the **patient** `VisaApplication` | caller lacks `MANAGE_FINANCE` → toast "You don't have permission to record payments" |
| any non-terminal → **Cancel drop-zone** | `AlertDialog` confirm (reuses the case page's cancel copy) | caller lacks `UPDATE_CASES` → zone not shown |
| `VISA_PROCESSING` → `COMPLETED` | — | always → toast "Record each visa outcome on the case page" |

Notes:

- **The Cancel drop-zone** appears as a full-width strip at the bottom of the
  board only while a drag is in progress (and only for `UPDATE_CASES` holders).
- **Attendant fee payments are not handled from the board.** Dragging
  `HOSPITAL_ACCEPTED` → `VISA_PROCESSING` always opens the payment dialog for the
  patient's `VisaApplication`. The attendant's payment (and every subsequent visa
  step — embassy visit, outcome) stays on the case detail page. The board's job
  is to get a case *into* visa processing, not to run visa processing.
- **On dialog success:** the board calls `getCaseBoard()` again and re-groups.
  No optimistic movement in v1 — a refetch is always correct and the payloads are
  small. Optimistic moves are a noted later optimization.
- **Keyboard / no-mouse fallback:** every card has a kebab menu with an "Advance
  to <next stage>" item that opens the exact same dialog the drag would. The
  board is usable without dragging.

## Age-in-stage indicator

Each card shows a "**Nd in stage**" pill computed from `enteredStageAt`.

Per-stage thresholds (calendar days):

```
NEW: 3
HOSPITAL_MATCHING: 7      (also applies to HOSPITAL_DECLINED)
HOSPITAL_ACCEPTED: 5
VISA_PROCESSING: 14
```

- At or past threshold → amber pill.
- Past 2× threshold → red pill.
- Below threshold → muted/neutral pill.
- `COMPLETED` / `CANCELLED` → no pill.

This threshold map lives in one module (`lib/case-pipeline.ts`) and is exported,
so feature #2 (aging alerts on the dashboard) consumes the same numbers.

## Passport-expiry flag

If the card's `patientPassportExpiry` is within 90 days (matching the dashboard's
existing `getExpiringPassports(90)` window), show a small amber passport icon with
a tooltip "Passport expires <date>". Attendant passports are not surfaced on the
board (the dashboard card already covers both; the board flag is a lightweight
heads-up, not the system of record).

## Backend

### `GET /cases/board`

- **Route:** `router.get("/board", RequirePermission("VIEW_CASES"), getCaseBoardCtrl)`
  in `casesRoute.js`, registered **before `/:id`** (same reason `patients/search`
  is — so "board" is never parsed as a case id).
- **Query params:** `includeCancelled` (`"true"` to add cancelled cases; default
  excludes them).
- **Response:** `{ success, message, data: { cards: BoardCard[] } }`, cards in
  `createdAt desc` order (newest first within each column once the frontend
  groups).
- **Not paginated.** A referral center runs on the order of hundreds of active
  cases; returning them all is acceptable. Flagged as a revisit point if active
  (non-terminal) case count exceeds ~500 — at which point either virtualize the
  columns or cap per column with a "show more".

### `BoardCard` shape

```
{
  id: string,
  caseNumber: string,
  status: CaseStatus,
  reachOutType: "DIRECT" | "AGENCY",
  patientName: string,                       // "First Last"
  patientPassportExpiry: string,             // ISO
  agencyName: string | null,
  assigneeName: string | null,               // "First Last" or null
  enteredStageAt: string,                    // ISO — see below
  pendingInquiry: { id: string, hospitalName: string } | null,
  patientVisaApplicationId: string | null,   // for the fee-payment drag
}
```

### `casesService.getCaseBoard({ includeCancelled })`

1. `Prisma.case.findMany` with `where` = `{}` or `{ status: { not: "CANCELLED" } }`,
   selecting: `id, caseNumber, status, reachOutType, createdAt`,
   `patient { firstName, lastName, passportExpiry }`,
   `agency { name }`, `assignedTo { firstName, lastName }`,
   `inquiries (where status PENDING) { id, hospital { name } }`,
   `visaApplications (where travelerType PATIENT) { id }`.
2. **`enteredStageAt`** — for the returned case ids, one
   `Prisma.caseEvent.findMany({ where: { caseId: { in }, type: { in: ["CASE_CREATED", "CASE_STATUS_CHANGED"] } }, orderBy: { createdAt: "desc" }, select: { caseId, toStatus, createdAt } })`.
   For each case, take the first (most-recent) event whose `toStatus === case.status`;
   fall back to `case.createdAt` if none (shouldn't happen for a well-formed case,
   but the board must never 500 on it).
3. Map to `BoardCard`. `pendingInquiry` = first of the filtered `inquiries` or
   `null`. `patientVisaApplicationId` = the patient `VisaApplication`'s id or
   `null`.

### Controller

`getCaseBoardCtrl` in `casesController.js` — reads `req.query.includeCancelled`,
calls the service, wraps in the standard `{ success, message, data }` envelope
(match the existing controllers in that file).

### Test

`Server/tests/` — a vitest integration test against the real DB (per the repo's
testing convention):

- Seeds cases spanning `NEW`, `HOSPITAL_MATCHING`, `HOSPITAL_DECLINED`,
  `HOSPITAL_ACCEPTED`, `VISA_PROCESSING`, `COMPLETED`, `CANCELLED` — using the
  existing service functions (`createCase`, `sendInquiry`, `respondToInquiry`,
  `recordFeePayment`) so `CaseEvent` rows are real.
- Asserts: `CANCELLED` excluded by default and included with the flag; each
  `BoardCard` field is populated; `pendingInquiry` is set for a case with a
  pending inquiry and `null` otherwise; `patientVisaApplicationId` is set once the
  case is `HOSPITAL_ACCEPTED`+; `enteredStageAt` equals the timestamp of the
  latest status event into the current status.

## Frontend

### View toggle on `/dashboard/cases`

- A `Board | Table` segmented control in the `PageHeader` actions area.
- Selection persisted to `localStorage` key `cases:view` (values `"board"` /
  `"table"`), read on mount inside a `useEffect` with a `try/catch` and a
  `"board"` default.
- **Below the `lg` breakpoint the page forces the table** regardless of the
  stored preference — native HTML5 drag is unreliable on touch, and five columns
  don't fit. The toggle is hidden under `lg`.
- The existing `CaseFilters` bar stays mounted in both views. In board view the
  **Status filter is hidden** (the columns *are* the statuses); `reachOutType`,
  `assignedToId`, and `q` filter the board's cards client-side.

### New modules

| File | Responsibility |
|---|---|
| `lib/case-pipeline.ts` | `BOARD_COLUMNS` order, `STAGE_AGE_THRESHOLDS`, `stageAgeLevel(status, enteredStageAt) → "ok" \| "warn" \| "over"`, `nextStage(status)`, `columnForStatus(status)` (maps `HOSPITAL_DECLINED` → `HOSPITAL_MATCHING`). Pure, no React. |
| `services/cases.ts` | `getCaseBoard(includeCancelled?)` → `BoardCard[]`. |
| `types/case.ts` | `BoardCard` type. |
| `components/cases/case-board.tsx` | Fetches the board, groups cards by column via `columnForStatus`, owns: drag state, which dialog is open + its target card, the cancel-confirm state, refetch-on-success. Renders columns + cancel drop-zone + the three reused dialogs + cancel `AlertDialog`. |
| `components/cases/case-board-column.tsx` | One column: header (label + count), scroll area, drop target (`onDragOver`/`onDrop`), drop-allowed highlight. |
| `components/cases/case-board-card.tsx` | `draggable` card: patient name, case number, `DIRECT`/agency name, assignee initials, age pill, passport-expiry icon, pending-inquiry hospital line, kebab menu ("Advance to …", "Open case"). |
| `components/cases/case-board-cancel-zone.tsx` | Bottom strip, visible only mid-drag and only for `UPDATE_CASES`; drop → cancel confirm. |

### Drag mechanism

Native HTML5 drag-and-drop — **no new dependency**:

- Card `onDragStart` puts `{ caseId, fromStatus }` on a module-level ref (not
  `dataTransfer` alone — we need it synchronously in React state to drive
  highlights).
- Column `onDragOver` calls `preventDefault()` only when the drop is a legal
  forward step (so the cursor shows "no-drop" otherwise).
- Column `onDrop` resolves the `(fromStatus → toStatus)` pair to an action via
  `lib/case-pipeline.ts` and either opens the mapped dialog with the dragged card
  as target, or fires a toast and does nothing.

### Reused dialogs — board-level `onSubmit` handlers

| Dialog | Board handler calls | Props the board supplies |
|---|---|---|
| `SendInquiryDialog` | `sendInquiry(card.id, values)` | — |
| `RespondInquiryDialog` | `respondToInquiry(card.id, card.pendingInquiry.id, values)` | `inquiry` synthesized from `card.pendingInquiry` (id + hospital name is enough for the dialog's display) |
| `FeePaymentDialog` | `recordFeePayment(card.id, card.patientVisaApplicationId, values)` | `reachOutType={card.reachOutType}` |

Each handler: on success `toast.success` + refetch board + close dialog; on error
`toast.error(getErrorMessage(e))` and rethrow (dialogs already expect a throwing
`onSubmit`).

### Testing

No component-test infrastructure exists in the frontend (the repo's tests are
backend integration). Verify with `tsc --noEmit`, `eslint`, and a manual pass /
screenshot of the board. `lib/case-pipeline.ts` is pure and the natural place for
a unit test if frontend test infra is added later; not added now.

## Out of scope (YAGNI)

- Within-column ordering / manual priority.
- Real-time / multi-user live board updates.
- Saved or shareable board filter presets.
- Bulk drag (multi-select).
- Attendant fee payment, embassy visit, or visa outcome from the board.
- Optimistic card movement (refetch is v1).
- A direct "set status" endpoint (explicitly rejected — would bypass invariants).

## Risks

- **Unpaginated board query.** Fine at current scale; revisit past ~500
  non-terminal cases (virtualize or cap-per-column).
- **Native DnD on touch is weak.** Mitigated by forcing the table view under
  `lg`.
- **A card can go stale between fetch and drop** (another user advanced the case).
  The backend workflow guards already reject the resulting action cleanly; the
  board surfaces that as an error toast and refetches.
