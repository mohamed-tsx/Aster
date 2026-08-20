# Cases Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cases module — patient intake (with returning-patient reuse), case CRUD,
the hospital-matching inquiry flow with auto status transitions, and manual cancellation —
on top of the domain schema foundation and the Hospitals & Agencies catalogs (both already
merged to `main`).

**Architecture:** One backend aggregate (`Server/Src/{Routes,Controllers,Services}/Cases`)
covering `Case`+`Patient`+`Attendant`+`HospitalInquiry` together, following the same
Route→Controller→Service pattern as every other feature in this repo. Frontend follows the
Users feature's page shape (list / new / detail / edit) rather than the tabs-in-one-page shape
used by Roles, since Cases genuinely needs four separate screens.

**Tech Stack:** Express 5, Prisma Client, Next.js App Router, react-hook-form + zod,
shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-20-cases-hospitals-agencies-design.md`
(Sections 2-4: "Case creation & patient reuse", "Case list, detail, edit, cancel",
"Hospital inquiry flow + auto status transitions")

## Global Constraints

- Response envelope: `sendSuccess`/`sendCreated` → `{ success, message, data }`, list
  endpoints wrap under a named key (`{ cases: [...] }`, `{ patients: [...] }`).
- Permission gating per the spec's API surface: `VIEW_CASES` (GET list/detail),
  `CREATE_CASES` (POST case), `UPDATE_CASES` (PUT case, cancel, send-inquiry,
  respond-inquiry — all case mutations after creation), and
  `RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES"])` for the patient-search
  lookup (needed during both create and edit flows).
- **Case-immutable fields after creation:** `patientId`, `reachOutType`, `caseNumber`.
  `updateCase` must reject any attempt to change `patientId`/`reachOutType` with a 400.
- **One `PENDING` `HospitalInquiry` per case at a time** — enforced at the service layer
  with a `findFirst` check before creating a new inquiry, not a DB constraint. 409 on
  violation.
- **Case status is auto-driven, never set directly by an update:** `createCase` always
  starts at `NEW`. `sendInquiry` transactionally sets `HOSPITAL_MATCHING`.
  `respondToInquiry` transactionally sets `HOSPITAL_ACCEPTED`/`HOSPITAL_DECLINED`
  depending on the response. `cancelCase` sets `CANCELLED` (blocked only if already
  `CANCELLED`). No endpoint accepts a raw `status` field on `Case`.
- **No `DELETE /api/v1/cases/:id` endpoint** — intentionally out of the approved spec.
  `DELETE_CASES` remains a seeded-but-unused permission for now (reserved for a future
  hard-delete feature if ever needed); cancellation is the only termination path in this
  plan.
- **Editing a case never adds or removes its attendant** — `updateCase` only ever
  updates the fields of an attendant that already exists (`existing.attendant &&
  data.hasAttendant !== false`); it never creates one for a case that started without
  one, and unchecking the "traveling with an attendant" toggle in the edit form does
  not delete an existing attendant record (the checkbox reverting to unchecked has no
  server-side effect if left submitted that way — the attendant silently persists
  unchanged). This is intentional, matching the spec's "collected inline at intake"
  design, not a bug to fix in this plan. If a genuine add/remove-attendant-after-intake
  need comes up later, it's a deliberate follow-up, not something Task 4's reviewer
  should treat as a missed requirement.
- **No `zodResolver`** — every form in this codebase validates manually
  (`schema.safeParse` inside `form.handleSubmit`, or for full-page forms like
  `create-user-form.tsx`, a manual parse-and-toast-the-first-error pattern). Follow
  whichever precedent a given file's Interfaces section names. Dialog-style forms that
  do use the safeParse pattern must call `form.setError` on failure (per the fix already
  applied to every existing dialog in this repo) — never a bare `return`.
- **Date fields use plain `<Input type="date">`**, not a calendar/date-picker component.
  `components/ui/calendar.tsx` is currently broken in this repo (missing
  `react-day-picker`/`@tiptap/*` packages, pre-existing and unrelated to this plan) —
  do not depend on it, and do not add the missing packages as a side effect of this
  plan.
- **Flat form schemas, not nested objects.** Every existing zod schema in this codebase
  (`hospitalSchema`, `agencySchema`, `createUserSchema`, etc.) is a flat object. The
  Case create/edit forms follow that same flat-field convention (`patientFirstName`,
  `attendantFirstName`, etc. as top-level keys) rather than nested `patient`/`attendant`
  sub-objects — simpler to wire to `react-hook-form`'s flat `defaultValues`/`FormField`
  `name` props, consistent with every other form in the repo.
- No test framework exists in this codebase. Verification is: manual `curl` pass against
  a running server, `npx tsc --noEmit` clean on the frontend, then a manual browser pass.

---

## File Structure

- Create: `Server/Src/Config/Generators/ID/customCaseIdGenerator.js`
- Create: `Server/Src/Services/Cases/casesService.js`
- Create: `Server/Src/Controllers/Cases/casesController.js`
- Create: `Server/Src/Routes/Cases/casesRoute.js`
- Modify: `Server/cmd/Server/Server.js` — mount the cases router
- Create: `aster/types/patient.ts`, `aster/types/case.ts`
- Create: `aster/lib/validations/case.ts`
- Create: `aster/services/cases.ts`
- Create: `aster/hooks/use-case-detail.ts`
- Create: `aster/app/dashboard/cases/page.tsx`,
  `aster/components/cases/cases-table.tsx`
- Create: `aster/app/dashboard/cases/new/page.tsx`,
  `aster/app/dashboard/cases/[id]/edit/page.tsx`,
  `aster/components/cases/case-form.tsx`,
  `aster/components/cases/patient-search.tsx`
- Create: `aster/app/dashboard/cases/[id]/page.tsx`,
  `aster/components/cases/case-detail-view.tsx`,
  `aster/components/cases/hospital-inquiry-panel.tsx`
- Modify: `aster/components/Layout/Sidebar.tsx` — "Cases" dropdown

---

### Task 1: Backend — Case number generator, Case/Patient/Attendant CRUD

**Files:**
- Create: `Server/Src/Config/Generators/ID/customCaseIdGenerator.js`
- Create: `Server/Src/Services/Cases/casesService.js`
- Create: `Server/Src/Controllers/Cases/casesController.js`
- Create: `Server/Src/Routes/Cases/casesRoute.js`
- Modify: `Server/cmd/Server/Server.js`

**Interfaces:**
- Consumes: `Prisma.case`/`Prisma.patient`/`Prisma.attendant`/`Prisma.agency`/`Prisma.user`
  client accessors, `AppError`, `sendSuccess`/`sendCreated`, `Verify`,
  `RequirePermission`, `RequireAnyPermission` (all pre-existing).
- Produces: `searchPatients`, `listCases`, `getCaseById`, `createCase`, `updateCase`
  (exported from `casesService.js`) — Task 2 adds `sendInquiry`/`respondToInquiry`/
  `cancelCase` to the same file. `GET/POST/PUT /api/v1/cases[/:id]` and
  `GET /api/v1/cases/patients/search` — Task 3's frontend service calls these exact
  paths.

- [ ] **Step 1: Create `Server/Src/Config/Generators/ID/customCaseIdGenerator.js`**

```js
import Prisma from "../../Prisma/db.js";

/**
 * Generates a human-readable case number with the format:
 * ASR-CASE-YY-MM-####
 * Example: ASR-CASE-26-08-0001
 *
 * @returns {Promise<string>} The generated case number
 */
export const generateCaseNumber = async () => {
  const prefix = "ASR-CASE";

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const baseId = `${prefix}-${year}-${month}`;

  const lastCase = await Prisma.case.findFirst({
    where: {
      caseNumber: {
        startsWith: baseId,
      },
    },
    orderBy: { caseNumber: "desc" },
  });

  let sequence = 1;
  if (lastCase) {
    const lastSeqStr = lastCase.caseNumber.split("-").pop();
    const lastSeq = parseInt(lastSeqStr, 10);

    if (isNaN(lastSeq) || lastSeq < 0) {
      console.warn(
        `Invalid sequence number found for case ${lastCase.caseNumber}, resetting to 1`,
      );
      sequence = 1;
    } else {
      sequence = lastSeq + 1;
    }
  }

  return `${baseId}-${sequence.toString().padStart(4, "0")}`;
};
```

- [ ] **Step 2: Create `Server/Src/Services/Cases/casesService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";
import { generateCaseNumber } from "../../Config/Generators/ID/customCaseIdGenerator.js";

const CASE_LIST_SELECT = {
  id: true,
  caseNumber: true,
  reachOutType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: { id: true, firstName: true, lastName: true, passportNumber: true },
  },
  agency: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
};

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

const PATIENT_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "phone",
  "email",
  "address",
];

const PATIENT_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "phone",
];

// Attendant fields arrive on the request body prefixed with "attendant" (e.g.
// `attendantFirstName`) since they sit flat alongside the patient's own bare
// `firstName`/`lastName`/etc. in the same JSON body — this map translates each
// Prisma `Attendant` field name to the body key that carries it.
const ATTENDANT_FIELD_MAP = {
  firstName: "attendantFirstName",
  lastName: "attendantLastName",
  gender: "attendantGender",
  dateOfBirth: "attendantDateOfBirth",
  nationality: "attendantNationality",
  passportNumber: "attendantPassportNumber",
  passportExpiry: "attendantPassportExpiry",
  phone: "attendantPhone",
  relationToPatient: "attendantRelationToPatient",
};

const pickFields = (source, fields) => {
  const picked = {};
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
};

const pickAttendantFields = (source) => {
  const picked = {};
  for (const [prismaField, bodyField] of Object.entries(ATTENDANT_FIELD_MAP)) {
    if (source[bodyField] !== undefined) picked[prismaField] = source[bodyField];
  }
  return picked;
};

const assertRequiredFields = (data, fields, label) => {
  for (const field of fields) {
    if (!data[field]) {
      throw new AppError(`${label} ${field} is required`, 400, "VALIDATION_ERROR");
    }
  }
};

const assertAttendantRequiredFields = (data) => {
  for (const prismaField of Object.keys(ATTENDANT_FIELD_MAP)) {
    if (!data[prismaField]) {
      throw new AppError(`Attendant ${prismaField} is required`, 400, "VALIDATION_ERROR");
    }
  }
};

/**
 * @param {string} passportNumber
 */
export const searchPatients = async (passportNumber) => {
  if (!passportNumber?.trim()) {
    throw new AppError(
      "passportNumber query param is required",
      400,
      "VALIDATION_ERROR",
    );
  }

  return Prisma.patient.findMany({
    where: {
      passportNumber: { contains: passportNumber.trim(), mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
};

/**
 * @param {{ page?: number, limit?: number, status?: string, reachOutType?: string, assignedToId?: string, q?: string }} params
 */
export const listCases = async ({
  page = 1,
  limit = 20,
  status,
  reachOutType,
  assignedToId,
  q,
} = {}) => {
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (reachOutType) where.reachOutType = reachOutType;
  if (assignedToId) where.assignedToId = assignedToId;
  if (q?.trim()) {
    const term = q.trim();
    where.patient = {
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { passportNumber: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  const [cases, total] = await Promise.all([
    Prisma.case.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: CASE_LIST_SELECT,
    }),
    Prisma.case.count({ where }),
  ]);

  return { cases, total, page, limit };
};

/**
 * @param {string} caseId
 */
export const getCaseById = async (caseId) => {
  const found = await Prisma.case.findUnique({
    where: { id: caseId },
    include: CASE_DETAIL_INCLUDE,
  });

  if (!found) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  return found;
};

/**
 * @param {Object} data - patientId (reuse) OR flat patient* fields (new patient),
 *   optional flat attendant* fields, reachOutType, agencyId, assignedToId, notes
 */
export const createCase = async (data) => {
  const { patientId, reachOutType, agencyId, assignedToId, notes } = data;

  if (!reachOutType || !["DIRECT", "AGENCY"].includes(reachOutType)) {
    throw new AppError("reachOutType must be DIRECT or AGENCY", 400, "VALIDATION_ERROR");
  }
  if (reachOutType === "AGENCY" && !agencyId) {
    throw new AppError(
      "agencyId is required when reachOutType is AGENCY",
      400,
      "VALIDATION_ERROR",
    );
  }

  let patientCreateData = null;
  if (!patientId) {
    patientCreateData = pickFields(data, PATIENT_FIELDS);
    assertRequiredFields(patientCreateData, PATIENT_REQUIRED_FIELDS, "Patient");
  } else {
    const existingPatient = await Prisma.patient.findUnique({ where: { id: patientId } });
    if (!existingPatient) {
      throw new AppError("Patient not found", 404, "NOT_FOUND");
    }
  }

  if (agencyId) {
    const agency = await Prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) {
      throw new AppError("Agency not found", 404, "NOT_FOUND");
    }
  }

  if (assignedToId) {
    const assignee = await Prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) {
      throw new AppError("Assigned user not found", 404, "NOT_FOUND");
    }
  }

  let attendantCreateData = null;
  if (data.hasAttendant) {
    attendantCreateData = pickAttendantFields(data);
    assertAttendantRequiredFields(attendantCreateData);
  }

  const caseNumber = await generateCaseNumber();

  return Prisma.case.create({
    data: {
      caseNumber,
      reachOutType,
      agencyId: reachOutType === "AGENCY" ? agencyId : null,
      assignedToId: assignedToId || null,
      notes: notes || null,
      patient: patientId
        ? { connect: { id: patientId } }
        : { create: patientCreateData },
      ...(attendantCreateData ? { attendant: { create: attendantCreateData } } : {}),
    },
    include: CASE_DETAIL_INCLUDE,
  });
};

/**
 * @param {string} caseId
 * @param {Object} data - flat patient* fields, hasAttendant + flat attendant* fields,
 *   agencyId, assignedToId, notes. patientId/reachOutType are rejected if present and
 *   different from the existing case.
 */
export const updateCase = async (caseId, data) => {
  const existing = await Prisma.case.findUnique({
    where: { id: caseId },
    include: { attendant: true },
  });
  if (!existing) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }

  if (data.patientId !== undefined && data.patientId !== existing.patientId) {
    throw new AppError(
      "patientId cannot be changed after case creation",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (data.reachOutType !== undefined && data.reachOutType !== existing.reachOutType) {
    throw new AppError(
      "reachOutType cannot be changed after case creation",
      400,
      "VALIDATION_ERROR",
    );
  }

  const caseUpdateData = {};

  if (data.agencyId !== undefined) {
    if (existing.reachOutType === "AGENCY" && !data.agencyId) {
      throw new AppError(
        "agencyId is required for agency-sourced cases",
        400,
        "VALIDATION_ERROR",
      );
    }
    if (data.agencyId) {
      const agency = await Prisma.agency.findUnique({ where: { id: data.agencyId } });
      if (!agency) throw new AppError("Agency not found", 404, "NOT_FOUND");
    }
    caseUpdateData.agencyId = existing.reachOutType === "AGENCY" ? data.agencyId : null;
  }

  if (data.assignedToId !== undefined) {
    if (data.assignedToId) {
      const assignee = await Prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignee) throw new AppError("Assigned user not found", 404, "NOT_FOUND");
    }
    caseUpdateData.assignedToId = data.assignedToId || null;
  }

  if (data.notes !== undefined) caseUpdateData.notes = data.notes || null;

  const patientUpdateData = pickFields(data, PATIENT_FIELDS);
  if (Object.keys(patientUpdateData).length > 0) {
    await Prisma.patient.update({
      where: { id: existing.patientId },
      data: patientUpdateData,
    });
  }

  if (existing.attendant && data.hasAttendant !== false) {
    const attendantUpdateData = pickAttendantFields(data);
    if (Object.keys(attendantUpdateData).length > 0) {
      await Prisma.attendant.update({
        where: { caseId },
        data: attendantUpdateData,
      });
    }
  }

  const updated = await Prisma.case.update({
    where: { id: caseId },
    data: caseUpdateData,
    include: CASE_DETAIL_INCLUDE,
  });

  return updated;
};
```

- [ ] **Step 3: Create `Server/Src/Controllers/Cases/casesController.js`**

```js
import asyncHandler from "express-async-handler";
import {
  searchPatients,
  listCases,
  getCaseById,
  createCase,
  updateCase,
} from "../../Services/Cases/casesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const searchPatientsCtrl = asyncHandler(async (req, res) => {
  const patients = await searchPatients(req.query.passportNumber);
  return sendSuccess(res, "Patients retrieved successfully", { patients });
});

export const listCasesCtrl = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { status, reachOutType, assignedToId, q } = req.query;

  const result = await listCases({ page, limit, status, reachOutType, assignedToId, q });
  return sendSuccess(res, "Cases retrieved successfully", result);
});

export const getCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await getCaseById(req.params.id);
  return sendSuccess(res, "Case retrieved successfully", kase);
});

export const createCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await createCase(req.body);
  return sendCreated(res, "Case created successfully", kase);
});

export const updateCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await updateCase(req.params.id, req.body);
  return sendSuccess(res, "Case updated successfully", kase);
});
```

- [ ] **Step 4: Create `Server/Src/Routes/Cases/casesRoute.js`**

```js
import express from "express";
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
} from "../../Controllers/Cases/casesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

// Registered before "/:id" so "patients" is never matched as a case id.
router.get(
  "/patients/search",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES"]),
  searchPatientsCtrl,
);

router.get("/", RequirePermission("VIEW_CASES"), listCasesCtrl);
router.get("/:id", RequirePermission("VIEW_CASES"), getCaseCtrl);
router.post("/", RequirePermission("CREATE_CASES"), createCaseCtrl);
router.put("/:id", RequirePermission("UPDATE_CASES"), updateCaseCtrl);

export default router;
```

- [ ] **Step 5: Mount the router in `Server/cmd/Server/Server.js`**

Find:
```js
import hospitalsRoutes from "../../Src/Routes/Hospitals/hospitalsRoute.js";
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
```

Replace with:
```js
import hospitalsRoutes from "../../Src/Routes/Hospitals/hospitalsRoute.js";
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
import casesRoutes from "../../Src/Routes/Cases/casesRoute.js";
```

Find:
```js
Server.use("/api/v1/hospitals", hospitalsRoutes);
Server.use("/api/v1/agencies", agenciesRoutes);
```

Replace with:
```js
Server.use("/api/v1/hospitals", hospitalsRoutes);
Server.use("/api/v1/agencies", agenciesRoutes);
Server.use("/api/v1/cases", casesRoutes);
```

- [ ] **Step 6: Manual verification**

Start the server (from `Server/`): `npm run dev` (check `Server/.env`'s `PORT` — use
`PORT=5000 npm run dev` if the default port is already bound by something else).

Log in and save cookies:
```bash
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

Create a hospital and an agency to reference later (Task 1 & 2's catalogs already exist
from the prior plan — reuse existing ones if any, or create fresh):
```bash
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/hospitals \
  -H "Content-Type: application/json" \
  -d '{"name":"Aster Medcity","city":"Kochi"}'
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/agencies \
  -H "Content-Type: application/json" \
  -d '{"name":"Global Health Partners"}'
```
Note the returned `id`s for use below.

Create a direct case with a new patient and an attendant:
```bash
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{
    "reachOutType": "DIRECT",
    "firstName": "Amina", "lastName": "Yusuf", "gender": "FEMALE",
    "dateOfBirth": "1985-04-12", "nationality": "Somali",
    "passportNumber": "A1234567", "passportExpiry": "2028-01-01",
    "phone": "+252611234567",
    "hasAttendant": true,
    "attendantFirstName": "Hassan", "attendantLastName": "Yusuf",
    "attendantGender": "MALE", "attendantDateOfBirth": "1980-06-01",
    "attendantNationality": "Somali", "attendantPassportNumber": "B7654321",
    "attendantPassportExpiry": "2027-05-01", "attendantPhone": "+252611234568",
    "attendantRelationToPatient": "Husband"
  }'
```
Expect 201, `caseNumber` like `ASR-CASE-26-08-0001`, `status: "NEW"`, `attendant` populated.

Search for that patient by passport, and create a second, agency-sourced case reusing
them (omit attendant fields — no attendant this time):
```bash
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases/patients/search?passportNumber=A1234567"
# Expect the patient from above in data.patients

curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{"reachOutType":"AGENCY","agencyId":"<AGENCY_ID>","patientId":"<PATIENT_ID>","hasAttendant":false}'
# Expect 201, same patientId, attendant: null
```

List and filter:
```bash
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases"
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases?reachOutType=AGENCY"
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases?q=Amina"
```

Confirm immutability guards:
```bash
curl -s -b cookies.txt -X PUT "http://localhost:5000/api/v1/cases/<CASE_ID>" \
  -H "Content-Type: application/json" \
  -d '{"reachOutType":"DIRECT"}'
# Expect 400 "reachOutType cannot be changed after case creation" (on the AGENCY case)
```

- [ ] **Step 7: Commit**

```bash
git add Server/Src/Config/Generators/ID/customCaseIdGenerator.js Server/Src/Services/Cases Server/Src/Controllers/Cases Server/Src/Routes/Cases Server/cmd/Server/Server.js
git commit -m "Add Case/Patient/Attendant CRUD API with patient-reuse search"
```

---

### Task 2: Backend — Hospital inquiry flow + cancel action

**Files:**
- Modify: `Server/Src/Services/Cases/casesService.js`
- Modify: `Server/Src/Controllers/Cases/casesController.js`
- Modify: `Server/Src/Routes/Cases/casesRoute.js`

**Interfaces:**
- Consumes: `CASE_DETAIL_INCLUDE` (module-private constant already in
  `casesService.js` from Task 1), `Prisma.hospitalInquiry`/`Prisma.hospital`,
  `Prisma.$transaction` (new to this codebase — standard Prisma API, array form).
- Produces: `sendInquiry`, `respondToInquiry`, `cancelCase` (added to
  `casesService.js`'s exports) and
  `POST /api/v1/cases/:id/inquiries`,
  `PATCH /api/v1/cases/:id/inquiries/:inquiryId`,
  `PATCH /api/v1/cases/:id/cancel` — Task 5's frontend detail page calls these exact
  paths.

- [ ] **Step 1: Add 3 functions to the end of `Server/Src/Services/Cases/casesService.js`**

Append (after `updateCase`):

```js

/**
 * @param {string} caseId
 * @param {{ hospitalId: string, notes?: string }} data
 */
export const sendInquiry = async (caseId, data) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("Cannot send an inquiry for a cancelled case", 400, "VALIDATION_ERROR");
  }

  const { hospitalId, notes } = data;
  if (!hospitalId) {
    throw new AppError("hospitalId is required", 400, "VALIDATION_ERROR");
  }

  const hospital = await Prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  const pending = await Prisma.hospitalInquiry.findFirst({
    where: { caseId, status: "PENDING" },
  });
  if (pending) {
    throw new AppError(
      "This case already has a pending inquiry. Wait for a response before sending another.",
      409,
      "CONFLICT",
    );
  }

  const [inquiry] = await Prisma.$transaction([
    Prisma.hospitalInquiry.create({
      data: { caseId, hospitalId, notes: notes || null },
      include: { hospital: true },
    }),
    Prisma.case.update({
      where: { id: caseId },
      data: { status: "HOSPITAL_MATCHING" },
    }),
  ]);

  return inquiry;
};

/**
 * @param {string} caseId
 * @param {string} inquiryId
 * @param {{ status: "ACCEPTED" | "DECLINED", treatmentCostEstimate?: number, currency?: string, notes?: string }} data
 */
export const respondToInquiry = async (caseId, inquiryId, data) => {
  const inquiry = await Prisma.hospitalInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry || inquiry.caseId !== caseId) {
    throw new AppError("Hospital inquiry not found", 404, "NOT_FOUND");
  }
  if (inquiry.status !== "PENDING") {
    throw new AppError("This inquiry has already been responded to", 400, "VALIDATION_ERROR");
  }

  const { status, treatmentCostEstimate, currency, notes } = data;
  if (!["ACCEPTED", "DECLINED"].includes(status)) {
    throw new AppError("status must be ACCEPTED or DECLINED", 400, "VALIDATION_ERROR");
  }
  if (
    treatmentCostEstimate !== undefined &&
    treatmentCostEstimate !== null &&
    treatmentCostEstimate !== "" &&
    !currency
  ) {
    throw new AppError(
      "currency is required when treatmentCostEstimate is provided",
      400,
      "VALIDATION_ERROR",
    );
  }

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

/**
 * @param {string} caseId
 */
export const cancelCase = async (caseId) => {
  const kase = await Prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) {
    throw new AppError("Case not found", 404, "NOT_FOUND");
  }
  if (kase.status === "CANCELLED") {
    throw new AppError("This case is already cancelled", 400, "VALIDATION_ERROR");
  }

  return Prisma.case.update({
    where: { id: caseId },
    data: { status: "CANCELLED" },
    include: CASE_DETAIL_INCLUDE,
  });
};
```

- [ ] **Step 2: Add 3 controller functions to `Server/Src/Controllers/Cases/casesController.js`**

Find:
```js
import {
  searchPatients,
  listCases,
  getCaseById,
  createCase,
  updateCase,
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
} from "../../Services/Cases/casesService.js";
```

Append at the end of the file:
```js

export const sendInquiryCtrl = asyncHandler(async (req, res) => {
  const inquiry = await sendInquiry(req.params.id, req.body);
  return sendCreated(res, "Hospital inquiry sent successfully", inquiry);
});

export const respondInquiryCtrl = asyncHandler(async (req, res) => {
  const inquiry = await respondToInquiry(req.params.id, req.params.inquiryId, req.body);
  return sendSuccess(res, "Hospital inquiry response recorded", inquiry);
});

export const cancelCaseCtrl = asyncHandler(async (req, res) => {
  const kase = await cancelCase(req.params.id);
  return sendSuccess(res, "Case cancelled successfully", kase);
});
```

- [ ] **Step 3: Add 3 routes to `Server/Src/Routes/Cases/casesRoute.js`**

Find:
```js
import {
  searchPatientsCtrl,
  listCasesCtrl,
  getCaseCtrl,
  createCaseCtrl,
  updateCaseCtrl,
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
} from "../../Controllers/Cases/casesController.js";
```

Find:
```js
router.post("/", RequirePermission("CREATE_CASES"), createCaseCtrl);
router.put("/:id", RequirePermission("UPDATE_CASES"), updateCaseCtrl);

export default router;
```

Replace with:
```js
router.post("/", RequirePermission("CREATE_CASES"), createCaseCtrl);
router.put("/:id", RequirePermission("UPDATE_CASES"), updateCaseCtrl);
router.patch("/:id/cancel", RequirePermission("UPDATE_CASES"), cancelCaseCtrl);
router.post("/:id/inquiries", RequirePermission("UPDATE_CASES"), sendInquiryCtrl);
router.patch(
  "/:id/inquiries/:inquiryId",
  RequirePermission("UPDATE_CASES"),
  respondInquiryCtrl,
);

export default router;
```

- [ ] **Step 4: Manual verification**

With the server still running and using a case id (`<CASE_ID>`) and hospital id
(`<HOSPITAL_ID>`) from Task 1's verification:

```bash
# Send an inquiry
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/inquiries" \
  -H "Content-Type: application/json" \
  -d '{"hospitalId":"<HOSPITAL_ID>","notes":"Cardiology consult needed"}'
# Expect 201; note the returned inquiry id as <INQUIRY_ID>

# Confirm the case status auto-updated
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases/<CASE_ID>"
# Expect data.status: "HOSPITAL_MATCHING"

# Try sending a second inquiry while one is pending
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/inquiries" \
  -H "Content-Type: application/json" \
  -d '{"hospitalId":"<HOSPITAL_ID>"}'
# Expect 409 "already has a pending inquiry"

# Respond to the inquiry
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/inquiries/<INQUIRY_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED","treatmentCostEstimate":5000,"currency":"USD"}'
# Expect 200, inquiry status ACCEPTED

# Confirm the case status followed
curl -s -b cookies.txt "http://localhost:5000/api/v1/cases/<CASE_ID>"
# Expect data.status: "HOSPITAL_ACCEPTED"

# Cancel the case
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/cancel"
# Expect 200, status: "CANCELLED"

# Try sending an inquiry on the now-cancelled case
curl -s -b cookies.txt -X POST "http://localhost:5000/api/v1/cases/<CASE_ID>/inquiries" \
  -H "Content-Type: application/json" \
  -d '{"hospitalId":"<HOSPITAL_ID>"}'
# Expect 400 "Cannot send an inquiry for a cancelled case"

# Cancel it again
curl -s -b cookies.txt -X PATCH "http://localhost:5000/api/v1/cases/<CASE_ID>/cancel"
# Expect 400 "This case is already cancelled"
```

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add Server/Src/Services/Cases/casesService.js Server/Src/Controllers/Cases/casesController.js Server/Src/Routes/Cases/casesRoute.js
git commit -m "Add hospital-inquiry flow and case cancellation with auto status transitions"
```

---

### Task 3: Frontend foundation — types, validations, services, and the Cases list page

**Files:**
- Create: `aster/types/patient.ts`, `aster/types/case.ts`
- Create: `aster/lib/validations/case.ts`
- Create: `aster/services/cases.ts`
- Create: `aster/hooks/use-case-detail.ts`
- Create: `aster/app/dashboard/cases/page.tsx`,
  `aster/components/cases/cases-table.tsx`

**Interfaces:**
- Consumes: Task 1 & 2's `/api/v1/cases*` endpoints; pre-existing `api`/`getErrorMessage`
  (`@/utils/api`), `usePermissionGuard`, `usePagination`, `ListPagination`, `PageHeader`,
  `Badge`, `useRBAC`.
- Produces: `Case`, `CaseListItem`, `Patient`, `Attendant`, `HospitalInquiry`,
  `CaseStatus` types and every `services/cases.ts` function — Task 4 and Task 5 both
  import these directly.

- [ ] **Step 1: Create `aster/types/patient.ts`**

```ts
export type Gender = "MALE" | "FEMALE" | "OTHER";

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Create `aster/types/case.ts`**

```ts
import type { Gender, Patient } from "@/types/patient";
import type { Agency } from "@/types/agency";
import type { Hospital } from "@/types/hospital";

export type Attendant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  phone: string;
  relationToPatient: string;
};

export type HospitalInquiryStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type HospitalInquiry = {
  id: string;
  hospitalId: string;
  hospital: Hospital;
  status: HospitalInquiryStatus;
  treatmentCostEstimate: string | null;
  currency: "USD" | "INR" | null;
  notes: string | null;
  sentAt: string;
  respondedAt: string | null;
};

export type CaseStatus =
  | "NEW"
  | "HOSPITAL_MATCHING"
  | "HOSPITAL_ACCEPTED"
  | "HOSPITAL_DECLINED"
  | "VISA_PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export type ReachOutType = "DIRECT" | "AGENCY";

export type CaseAssignee = { id: string; firstName: string; lastName: string };

export type CaseListItem = {
  id: string;
  caseNumber: string;
  reachOutType: ReachOutType;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string; passportNumber: string };
  agency: { id: string; name: string } | null;
  assignedTo: CaseAssignee | null;
};

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

export type CasesListResult = {
  cases: CaseListItem[];
  total: number;
  page: number;
  limit: number;
};
```

- [ ] **Step 3: Create `aster/lib/validations/case.ts`**

```ts
import { z } from "zod";

const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

export const caseFormSchema = z.object({
  // Patient fields — required only when creating a new patient (no patientId selected).
  patientFirstName: z.string().max(100).optional(),
  patientLastName: z.string().max(100).optional(),
  patientGender: genderSchema.optional(),
  patientDateOfBirth: z.string().optional(),
  patientNationality: z.string().max(100).optional(),
  patientPassportNumber: z.string().max(50).optional(),
  patientPassportExpiry: z.string().optional(),
  patientPhone: z.string().max(30).optional(),
  patientEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  patientAddress: z.string().max(300).optional(),

  hasAttendant: z.boolean(),
  attendantFirstName: z.string().max(100).optional(),
  attendantLastName: z.string().max(100).optional(),
  attendantGender: genderSchema.optional(),
  attendantDateOfBirth: z.string().optional(),
  attendantNationality: z.string().max(100).optional(),
  attendantPassportNumber: z.string().max(50).optional(),
  attendantPassportExpiry: z.string().optional(),
  attendantPhone: z.string().max(30).optional(),
  attendantRelationToPatient: z.string().max(50).optional(),

  reachOutType: z.enum(["DIRECT", "AGENCY"]),
  agencyId: z.string().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

const PATIENT_REQUIRED: (keyof CaseFormValues)[] = [
  "patientFirstName",
  "patientLastName",
  "patientGender",
  "patientDateOfBirth",
  "patientNationality",
  "patientPassportNumber",
  "patientPassportExpiry",
  "patientPhone",
];

const ATTENDANT_REQUIRED: (keyof CaseFormValues)[] = [
  "attendantFirstName",
  "attendantLastName",
  "attendantGender",
  "attendantDateOfBirth",
  "attendantNationality",
  "attendantPassportNumber",
  "attendantPassportExpiry",
  "attendantPhone",
  "attendantRelationToPatient",
];

/**
 * Manual cross-field validation the flat zod schema can't express (conditional
 * requiredness depending on patient-reuse / attendant-toggle / reach-out-type state).
 * Returns the first error message, or null if valid.
 */
export function validateCaseForm(
  values: CaseFormValues,
  { selectedPatientId }: { selectedPatientId: string | null },
): string | null {
  if (!selectedPatientId) {
    for (const field of PATIENT_REQUIRED) {
      if (!values[field]) {
        return `Patient ${String(field).replace("patient", "").toLowerCase()} is required`;
      }
    }
  }

  if (values.hasAttendant) {
    for (const field of ATTENDANT_REQUIRED) {
      if (!values[field]) {
        return `Attendant ${String(field).replace("attendant", "").toLowerCase()} is required`;
      }
    }
  }

  if (values.reachOutType === "AGENCY" && !values.agencyId) {
    return "Agency is required for agency-sourced cases";
  }

  return null;
}

export const inquiryResponseSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  treatmentCostEstimate: z.string().optional(),
  currency: z.enum(["USD", "INR"]).optional(),
  notes: z.string().max(1000).optional(),
});

export type InquiryResponseFormValues = z.infer<typeof inquiryResponseSchema>;
```

- [ ] **Step 4: Create `aster/services/cases.ts`**

```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Case, CaseListItem, CasesListResult } from "@/types/case";
import type { Patient } from "@/types/patient";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type ListCasesParams = {
  page?: number;
  limit?: number;
  status?: string;
  reachOutType?: string;
  assignedToId?: string;
  q?: string;
};

export async function listCases(
  params: ListCasesParams = {},
): Promise<CasesListResult> {
  const response = await api.get<ApiSuccess<CasesListResult>>("/cases", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status || undefined,
      reachOutType: params.reachOutType || undefined,
      assignedToId: params.assignedToId || undefined,
      q: params.q || undefined,
    },
  });
  return unwrap(response);
}

export async function getCaseById(id: string): Promise<Case> {
  const response = await api.get<ApiSuccess<Case>>(`/cases/${id}`);
  return unwrap(response);
}

export async function searchPatients(passportNumber: string): Promise<Patient[]> {
  const response = await api.get<ApiSuccess<{ patients: Patient[] }>>(
    "/cases/patients/search",
    { params: { passportNumber } },
  );
  return unwrap(response).patients;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCase(payload: Record<string, any>): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>("/cases", payload);
  return unwrap(response);
}

export async function updateCase(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<Case> {
  const response = await api.put<ApiSuccess<Case>>(`/cases/${id}`, payload);
  return unwrap(response);
}

export async function cancelCase(id: string): Promise<Case> {
  const response = await api.patch<ApiSuccess<Case>>(`/cases/${id}/cancel`);
  return unwrap(response);
}

export async function sendInquiry(
  caseId: string,
  payload: { hospitalId: string; notes?: string },
): Promise<Case> {
  const response = await api.post<ApiSuccess<Case>>(
    `/cases/${caseId}/inquiries`,
    payload,
  );
  return unwrap(response);
}

export async function respondToInquiry(
  caseId: string,
  inquiryId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<Case> {
  const response = await api.patch<ApiSuccess<Case>>(
    `/cases/${caseId}/inquiries/${inquiryId}`,
    payload,
  );
  return unwrap(response);
}

export { getErrorMessage };
export type { CaseListItem };
```

The `createCase`/`updateCase`/`respondToInquiry` payloads are typed as
`Record<string, any>` rather than a named payload type — the flat form values map
directly to the flat backend body (see Task 4's `buildCaseCreatePayload`/
`buildCaseUpdatePayload` helpers), and a fully-named payload type would just duplicate
`CaseFormValues` with no added safety, since the backend itself does the real
validation.

- [ ] **Step 5: Create `aster/hooks/use-case-detail.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCaseById } from "@/services/cases";
import { getErrorMessage } from "@/utils/api";
import type { Case } from "@/types/case";

export function useCaseDetail(id: string) {
  const router = useRouter();
  const [kase, setKase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    if (!id) return;
    setLoading(true);
    getCaseById(id)
      .then((data) => setKase(data))
      .catch((error) => {
        toast.error(getErrorMessage(error, "Case could not be loaded"));
        router.push("/dashboard/cases");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getCaseById(id);
        if (!cancelled) setKase(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Case could not be loaded"));
          router.push("/dashboard/cases");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { case: kase, setCase: setKase, loading, refetch };
}
```

- [ ] **Step 6: Create `aster/components/cases/cases-table.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import type { CaseListItem, CaseStatus } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_VARIANT: Record<CaseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "secondary",
  HOSPITAL_MATCHING: "outline",
  HOSPITAL_ACCEPTED: "default",
  HOSPITAL_DECLINED: "destructive",
  VISA_PROCESSING: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{status.replace(/_/g, " ")}</Badge>
  );
}

type CasesTableProps = {
  cases: CaseListItem[];
  loading?: boolean;
};

export function CasesTable({ cases, loading }: CasesTableProps) {
  const { hasPermission } = useRBAC();

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">No cases found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting filters or create a new case.
        </p>
        {hasPermission("CREATE_CASES") && (
          <Button className="mt-4" asChild>
            <Link href="/dashboard/cases/new">Add case</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case #</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((kase) => (
            <TableRow key={kase.id}>
              <TableCell>
                <Link
                  href={`/dashboard/cases/${kase.id}`}
                  className="font-medium hover:underline"
                >
                  {kase.caseNumber}
                </Link>
              </TableCell>
              <TableCell>
                {kase.patient.firstName} {kase.patient.lastName}
                <p className="text-xs text-muted-foreground">
                  {kase.patient.passportNumber}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge status={kase.status} />
              </TableCell>
              <TableCell>
                {kase.reachOutType === "AGENCY" && kase.agency
                  ? `Agency: ${kase.agency.name}`
                  : "Direct"}
              </TableCell>
              <TableCell>
                {kase.assignedTo
                  ? `${kase.assignedTo.firstName} ${kase.assignedTo.lastName}`
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(kase.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 7: Create `aster/app/dashboard/cases/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { CasesTable } from "@/components/cases/cases-table";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { listCases } from "@/services/cases";
import type { CaseListItem } from "@/types/case";

export default function CasesPage() {
  const allowed = usePermissionGuard("VIEW_CASES");
  const { hasPermission } = useRBAC();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCases({ page, limit });
      setCases(result.cases);
      setTotal(result.total);
    } catch (error) {
      console.error(error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Cases"
        description="Track patient referral cases end to end."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchCases} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("CREATE_CASES") && (
              <Button asChild>
                <Link href="/dashboard/cases/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add case
                </Link>
              </Button>
            )}
          </>
        }
      />

      <CasesTable cases={cases} loading={loading} />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="cases"
      />
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors beyond the known pre-existing ones in `calendar.tsx`/
`rich-text-editor.tsx`.

- [ ] **Step 9: Commit**

```bash
git add aster/types/patient.ts aster/types/case.ts aster/lib/validations/case.ts aster/services/cases.ts aster/hooks/use-case-detail.ts aster/components/cases/cases-table.tsx aster/app/dashboard/cases/page.tsx
git commit -m "Add Cases list page with types, validations, and service layer"
```

---

### Task 4: Frontend — New Case form and Edit Case form

**Files:**
- Modify: `aster/lib/validations/case.ts` — add payload builders
- Create: `aster/components/cases/patient-fields.tsx`,
  `aster/components/cases/attendant-fields.tsx`,
  `aster/components/cases/patient-search.tsx`,
  `aster/components/cases/case-form.tsx`
- Create: `aster/app/dashboard/cases/new/page.tsx`,
  `aster/app/dashboard/cases/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: Task 3's `caseFormSchema`/`validateCaseForm`/types/`searchPatients`/
  `createCase`/`updateCase`/`useCaseDetail`; pre-existing `listAgencies`
  (`@/services/agencies`), `listUsers` (`@/services/users`, requires `VIEW_USERS` —
  handled gracefully if the caller lacks it, see Step 4), `useAuthStore`,
  `usePermissionGuard`, `Checkbox`/`Textarea`/`Select` UI primitives.
- Produces: `<CaseForm mode="create" | "edit" ...>` — used by both new pages in this
  task; no other task depends on this component.

- [ ] **Step 1: Add payload builders to `aster/lib/validations/case.ts`**

Append to the end of the file (after `InquiryResponseFormValues`):

```ts

/**
 * Backend contract: patient fields are bare (`firstName`, `lastName`, ...); attendant
 * fields are sent with an `attendant` prefix (`attendantFirstName`, ...) since both
 * sit flat in the same JSON body — see `Server/Src/Services/Cases/casesService.js`'s
 * `ATTENDANT_FIELD_MAP`.
 */
export function buildCaseCreatePayload(
  values: CaseFormValues,
  selectedPatientId: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    reachOutType: values.reachOutType,
    agencyId: values.reachOutType === "AGENCY" ? values.agencyId : undefined,
    assignedToId: values.assignedToId || undefined,
    notes: values.notes?.trim() || undefined,
    hasAttendant: values.hasAttendant,
  };

  if (selectedPatientId) {
    payload.patientId = selectedPatientId;
  } else {
    payload.firstName = values.patientFirstName;
    payload.lastName = values.patientLastName;
    payload.gender = values.patientGender;
    payload.dateOfBirth = values.patientDateOfBirth;
    payload.nationality = values.patientNationality;
    payload.passportNumber = values.patientPassportNumber;
    payload.passportExpiry = values.patientPassportExpiry;
    payload.phone = values.patientPhone;
    payload.email = values.patientEmail?.trim() || undefined;
    payload.address = values.patientAddress?.trim() || undefined;
  }

  if (values.hasAttendant) {
    payload.attendantFirstName = values.attendantFirstName;
    payload.attendantLastName = values.attendantLastName;
    payload.attendantGender = values.attendantGender;
    payload.attendantDateOfBirth = values.attendantDateOfBirth;
    payload.attendantNationality = values.attendantNationality;
    payload.attendantPassportNumber = values.attendantPassportNumber;
    payload.attendantPassportExpiry = values.attendantPassportExpiry;
    payload.attendantPhone = values.attendantPhone;
    payload.attendantRelationToPatient = values.attendantRelationToPatient;
  }

  return payload;
}

export function buildCaseUpdatePayload(values: CaseFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    agencyId: values.reachOutType === "AGENCY" ? values.agencyId : undefined,
    assignedToId: values.assignedToId || undefined,
    notes: values.notes?.trim() || undefined,
    hasAttendant: values.hasAttendant,
    firstName: values.patientFirstName,
    lastName: values.patientLastName,
    gender: values.patientGender,
    dateOfBirth: values.patientDateOfBirth,
    nationality: values.patientNationality,
    passportNumber: values.patientPassportNumber,
    passportExpiry: values.patientPassportExpiry,
    phone: values.patientPhone,
    email: values.patientEmail?.trim() || undefined,
    address: values.patientAddress?.trim() || undefined,
  };

  if (values.hasAttendant) {
    payload.attendantFirstName = values.attendantFirstName;
    payload.attendantLastName = values.attendantLastName;
    payload.attendantGender = values.attendantGender;
    payload.attendantDateOfBirth = values.attendantDateOfBirth;
    payload.attendantNationality = values.attendantNationality;
    payload.attendantPassportNumber = values.attendantPassportNumber;
    payload.attendantPassportExpiry = values.attendantPassportExpiry;
    payload.attendantPhone = values.attendantPhone;
    payload.attendantRelationToPatient = values.attendantRelationToPatient;
  }

  return payload;
}
```

- [ ] **Step 2: Create `aster/components/cases/patient-fields.tsx`**

```tsx
"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseFormValues } from "@/lib/validations/case";

type FieldProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
};

function TextField({
  form,
  name,
  label,
  type = "text",
}: FieldProps & { name: keyof CaseFormValues; label: string; type?: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} value={(field.value as string) ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function PatientFields({ form }: FieldProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Patient details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="patientFirstName" label="First name" />
        <TextField form={form} name="patientLastName" label="Last name" />
        <FormField
          control={form.control}
          name="patientGender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select onValueChange={field.onChange} value={field.value as string}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <TextField form={form} name="patientDateOfBirth" label="Date of birth" type="date" />
        <TextField form={form} name="patientNationality" label="Nationality" />
        <TextField form={form} name="patientPassportNumber" label="Passport number" />
        <TextField
          form={form}
          name="patientPassportExpiry"
          label="Passport expiry"
          type="date"
        />
        <TextField form={form} name="patientPhone" label="Phone" />
        <TextField form={form} name="patientEmail" label="Email (optional)" type="email" />
        <TextField form={form} name="patientAddress" label="Address (optional)" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `aster/components/cases/attendant-fields.tsx`**

```tsx
"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseFormValues } from "@/lib/validations/case";

type FieldProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
};

function TextField({
  form,
  name,
  label,
  type = "text",
}: FieldProps & { name: keyof CaseFormValues; label: string; type?: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} value={(field.value as string) ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function AttendantFields({ form }: FieldProps) {
  const hasAttendant = form.watch("hasAttendant");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="hasAttendant"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">Traveling with an attendant</FormLabel>
            </FormItem>
          )}
        />

        {hasAttendant && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="attendantFirstName" label="First name" />
            <TextField form={form} name="attendantLastName" label="Last name" />
            <FormField
              control={form.control}
              name="attendantGender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value as string}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextField
              form={form}
              name="attendantDateOfBirth"
              label="Date of birth"
              type="date"
            />
            <TextField form={form} name="attendantNationality" label="Nationality" />
            <TextField form={form} name="attendantPassportNumber" label="Passport number" />
            <TextField
              form={form}
              name="attendantPassportExpiry"
              label="Passport expiry"
              type="date"
            />
            <TextField form={form} name="attendantPhone" label="Phone" />
            <TextField
              form={form}
              name="attendantRelationToPatient"
              label="Relation to patient"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `aster/components/cases/patient-search.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { searchPatients, getErrorMessage } from "@/services/cases";
import type { Patient } from "@/types/patient";

type PatientSearchProps = {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient | null) => void;
};

export function PatientSearch({ selectedPatient, onSelect }: PatientSearchProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await searchPatients(query.trim());
      setResults(found);
      setSearched(true);
    } catch (error) {
      toast.error("Search failed", getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  if (selectedPatient) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              Passport {selectedPatient.passportNumber} · Reusing existing patient record
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
            <X className="mr-2 h-4 w-4" />
            Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">Returning patient?</p>
        <div className="flex gap-2">
          <Input
            placeholder="Search by passport number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
        {searched && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No match — fill in the new patient&apos;s details below.
          </p>
        )}
        {results.length > 0 && (
          <div className="space-y-1 rounded-md border p-2">
            {results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelect(patient)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>
                  {patient.firstName} {patient.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {patient.passportNumber}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `aster/components/cases/case-form.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientSearch } from "@/components/cases/patient-search";
import { PatientFields } from "@/components/cases/patient-fields";
import { AttendantFields } from "@/components/cases/attendant-fields";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import {
  caseFormSchema,
  validateCaseForm,
  buildCaseCreatePayload,
  buildCaseUpdatePayload,
  type CaseFormValues,
} from "@/lib/validations/case";
import { listAgencies } from "@/services/agencies";
import { listUsers } from "@/services/users";
import type { Agency } from "@/types/agency";
import type { Case } from "@/types/case";
import type { Patient } from "@/types/patient";

const EMPTY_VALUES: CaseFormValues = {
  patientFirstName: "",
  patientLastName: "",
  patientGender: undefined,
  patientDateOfBirth: "",
  patientNationality: "",
  patientPassportNumber: "",
  patientPassportExpiry: "",
  patientPhone: "",
  patientEmail: "",
  patientAddress: "",
  hasAttendant: false,
  attendantFirstName: "",
  attendantLastName: "",
  attendantGender: undefined,
  attendantDateOfBirth: "",
  attendantNationality: "",
  attendantPassportNumber: "",
  attendantPassportExpiry: "",
  attendantPhone: "",
  attendantRelationToPatient: "",
  reachOutType: "DIRECT",
  agencyId: "",
  assignedToId: "",
  notes: "",
};

function caseToFormValues(kase: Case): CaseFormValues {
  return {
    patientFirstName: kase.patient.firstName,
    patientLastName: kase.patient.lastName,
    patientGender: kase.patient.gender,
    patientDateOfBirth: kase.patient.dateOfBirth.slice(0, 10),
    patientNationality: kase.patient.nationality,
    patientPassportNumber: kase.patient.passportNumber,
    patientPassportExpiry: kase.patient.passportExpiry.slice(0, 10),
    patientPhone: kase.patient.phone,
    patientEmail: kase.patient.email ?? "",
    patientAddress: kase.patient.address ?? "",
    hasAttendant: !!kase.attendant,
    attendantFirstName: kase.attendant?.firstName ?? "",
    attendantLastName: kase.attendant?.lastName ?? "",
    attendantGender: kase.attendant?.gender,
    attendantDateOfBirth: kase.attendant?.dateOfBirth?.slice(0, 10) ?? "",
    attendantNationality: kase.attendant?.nationality ?? "",
    attendantPassportNumber: kase.attendant?.passportNumber ?? "",
    attendantPassportExpiry: kase.attendant?.passportExpiry?.slice(0, 10) ?? "",
    attendantPhone: kase.attendant?.phone ?? "",
    attendantRelationToPatient: kase.attendant?.relationToPatient ?? "",
    reachOutType: kase.reachOutType,
    agencyId: kase.agency?.id ?? "",
    assignedToId: kase.assignedTo?.id ?? "",
    notes: kase.notes ?? "",
  };
}

type CaseFormProps =
  | { mode: "create"; onSubmit: (payload: Record<string, unknown>) => Promise<void> }
  | {
      mode: "edit";
      initialCase: Case;
      onSubmit: (payload: Record<string, unknown>) => Promise<void>;
    };

export function CaseForm(props: CaseFormProps) {
  const { mode, onSubmit } = props;
  const toast = useToast();
  const { user: currentUser } = useAuthStore();
  const form = useForm<CaseFormValues>({
    defaultValues: mode === "edit" ? caseToFormValues(props.initialCase) : EMPTY_VALUES,
  });
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    mode === "edit" ? props.initialCase.patient : null,
  );
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<
    { id: string; firstName: string; lastName: string }[]
  >([]);

  const reachOutType = form.watch("reachOutType");

  useEffect(() => {
    listAgencies()
      .then(setAgencies)
      .catch(() => setAgencies([]));

    // Best-effort: staff without VIEW_USERS simply won't see an assignee picker
    // (the case auto-assigns to them on create instead — see below).
    listUsers({ limit: 100 })
      .then((result) => setAssignableUsers(result.users))
      .catch(() => setAssignableUsers([]));

    if (mode === "create" && currentUser?.id) {
      form.setValue("assignedToId", currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = form.handleSubmit(async (values) => {
    const validationError = validateCaseForm(values, {
      selectedPatientId: selectedPatient?.id ?? null,
    });
    if (validationError) {
      toast.error("Validation error", validationError);
      return;
    }

    const parsed = caseFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(
        "Validation error",
        parsed.error.issues[0]?.message ?? "Fix form errors",
      );
      return;
    }

    const payload =
      mode === "create"
        ? buildCaseCreatePayload(parsed.data, selectedPatient?.id ?? null)
        : buildCaseUpdatePayload(parsed.data);

    await onSubmit(payload);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "create" && (
          <PatientSearch selectedPatient={selectedPatient} onSelect={setSelectedPatient} />
        )}

        {!selectedPatient && <PatientFields form={form} />}

        <AttendantFields form={form} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Case details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="reachOutType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reach-out type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DIRECT">Direct</SelectItem>
                      <SelectItem value="AGENCY">Agency</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {reachOutType === "AGENCY" && (
              <FormField
                control={form.control}
                name="agencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select agency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {assignableUsers.length > 0 && (
              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned to</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={(field.value as string) ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === "create" ? "Create case" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 6: Create `aster/app/dashboard/cases/new/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/users/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { createCase, getErrorMessage } from "@/services/cases";

export default function NewCasePage() {
  const router = useRouter();
  const allowed = usePermissionGuard("CREATE_CASES");
  if (!allowed) return null;

  const handleCreate = async (payload: Record<string, unknown>) => {
    try {
      const kase = await createCase(payload);
      toast.success("Case created.");
      router.push(`/dashboard/cases/${kase.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create case"));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="New case"
        description="Register a new patient referral case."
        backHref="/dashboard/cases"
      />
      <CaseForm mode="create" onSubmit={handleCreate} />
    </div>
  );
}
```

- [ ] **Step 7: Create `aster/app/dashboard/cases/[id]/edit/page.tsx`**

```tsx
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/users/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { updateCase, getErrorMessage } from "@/services/cases";

type PageProps = { params: Promise<{ id: string }> };

export default function EditCasePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const allowed = usePermissionGuard("UPDATE_CASES");
  const { case: kase, loading } = useCaseDetail(id);

  if (!allowed) return null;

  const handleUpdate = async (payload: Record<string, unknown>) => {
    try {
      await updateCase(id, payload);
      toast.success("Case updated.");
      router.push(`/dashboard/cases/${id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update case"));
      throw error;
    }
  };

  if (loading || !kase) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={`Edit ${kase.caseNumber}`}
        description="Update case, patient, and attendant details."
        backHref={`/dashboard/cases/${id}`}
      />
      <CaseForm mode="edit" initialCase={kase} onSubmit={handleUpdate} />
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors beyond the known pre-existing ones in `calendar.tsx`/
`rich-text-editor.tsx`. If `listUsers({ limit: 100 })` doesn't type-check against
`ListUsersParams`, check `aster/services/users.ts` — it should already accept a
`limit` field; if the type errors, use `listUsers({ page: 1, limit: 100 })` instead.

- [ ] **Step 9: Commit**

```bash
git add aster/lib/validations/case.ts aster/components/cases/patient-fields.tsx aster/components/cases/attendant-fields.tsx aster/components/cases/patient-search.tsx aster/components/cases/case-form.tsx aster/app/dashboard/cases/new aster/app/dashboard/cases/[id]/edit
git commit -m "Add Case create/edit forms with patient search and attendant toggle"
```

---

### Task 5: Frontend — Case detail page with hospital-inquiry actions and cancel

**Files:**
- Create: `aster/components/cases/case-detail-view.tsx`
- Create: `aster/components/cases/send-inquiry-dialog.tsx`,
  `aster/components/cases/respond-inquiry-dialog.tsx`,
  `aster/components/cases/hospital-inquiry-panel.tsx`
- Create: `aster/app/dashboard/cases/[id]/page.tsx`

**Interfaces:**
- Consumes: `useCaseDetail` (Task 3), `sendInquiry`/`respondToInquiry`/`cancelCase`
  (Task 3's `services/cases.ts`), pre-existing `listHospitals` (`@/services/hospitals`),
  `AlertDialog` primitives (`@/components/ui/alert-dialog`).
- Produces: the `/dashboard/cases/[id]` page — the last piece of the module's own UI;
  Task 6 only adds sidebar links pointing at pages already built by this point.

- [ ] **Step 1: Create `aster/components/cases/case-detail-view.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Case, CaseStatus } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_VARIANT: Record<CaseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "secondary",
  HOSPITAL_MATCHING: "outline",
  HOSPITAL_ACCEPTED: "default",
  HOSPITAL_DECLINED: "destructive",
  VISA_PROCESSING: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export function CaseDetailView({ kase }: { kase: Case }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Case</CardTitle>
          <Badge variant={STATUS_VARIANT[kase.status]}>
            {kase.status.replace(/_/g, " ")}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Case number" value={kase.caseNumber} />
          <Field
            label="Reach-out type"
            value={
              kase.reachOutType === "AGENCY"
                ? `Agency: ${kase.agency?.name ?? ""}`
                : "Direct"
            }
          />
          <Field
            label="Assigned to"
            value={
              kase.assignedTo
                ? `${kase.assignedTo.firstName} ${kase.assignedTo.lastName}`
                : "Unassigned"
            }
          />
          <Field label="Created" value={formatDate(kase.createdAt)} />
          {kase.notes && <Field label="Notes" value={kase.notes} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" value={`${kase.patient.firstName} ${kase.patient.lastName}`} />
          <Field label="Gender" value={kase.patient.gender} />
          <Field label="Date of birth" value={formatDate(kase.patient.dateOfBirth)} />
          <Field label="Nationality" value={kase.patient.nationality} />
          <Field label="Passport number" value={kase.patient.passportNumber} />
          <Field label="Passport expiry" value={formatDate(kase.patient.passportExpiry)} />
          <Field label="Phone" value={kase.patient.phone} />
          <Field label="Email" value={kase.patient.email} />
          <Field label="Address" value={kase.patient.address} />
        </CardContent>
      </Card>

      {kase.attendant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Name"
              value={`${kase.attendant.firstName} ${kase.attendant.lastName}`}
            />
            <Field label="Relation to patient" value={kase.attendant.relationToPatient} />
            <Field label="Gender" value={kase.attendant.gender} />
            <Field label="Date of birth" value={formatDate(kase.attendant.dateOfBirth)} />
            <Field label="Nationality" value={kase.attendant.nationality} />
            <Field label="Passport number" value={kase.attendant.passportNumber} />
            <Field
              label="Passport expiry"
              value={formatDate(kase.attendant.passportExpiry)}
            />
            <Field label="Phone" value={kase.attendant.phone} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `aster/components/cases/send-inquiry-dialog.tsx`**

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
import { listHospitals } from "@/services/hospitals";
import type { Hospital } from "@/types/hospital";

type SendInquiryFormValues = { hospitalId: string; notes: string };

type SendInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { hospitalId: string; notes?: string }) => Promise<void>;
};

export function SendInquiryDialog({
  open,
  onOpenChange,
  onSubmit,
}: SendInquiryDialogProps) {
  const form = useForm<SendInquiryFormValues>({
    defaultValues: { hospitalId: "", notes: "" },
  });
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    if (open) {
      form.reset({ hospitalId: "", notes: "" });
      listHospitals()
        .then(setHospitals)
        .catch(() => setHospitals([]));
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to hospital</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!values.hospitalId) {
                form.setError("hospitalId", { message: "Select a hospital" });
                return;
              }
              await onSubmit({
                hospitalId: values.hospitalId,
                notes: values.notes.trim() || undefined,
              });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="hospitalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select hospital" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} — {h.city}
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
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `aster/components/cases/respond-inquiry-dialog.tsx`**

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
import type { HospitalInquiry } from "@/types/case";

type RespondInquiryFormValues = {
  status: "ACCEPTED" | "DECLINED";
  treatmentCostEstimate: string;
  currency: "USD" | "INR";
  notes: string;
};

type RespondInquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: HospitalInquiry | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
};

export function RespondInquiryDialog({
  open,
  onOpenChange,
  inquiry,
  onSubmit,
}: RespondInquiryDialogProps) {
  const form = useForm<RespondInquiryFormValues>({
    defaultValues: {
      status: "ACCEPTED",
      treatmentCostEstimate: "",
      currency: "USD",
      notes: "",
    },
  });
  const status = form.watch("status");

  useEffect(() => {
    if (open) {
      form.reset({ status: "ACCEPTED", treatmentCostEstimate: "", currency: "USD", notes: "" });
    }
  }, [open, form]);

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record {inquiry.hospital.name}&apos;s response</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (values.treatmentCostEstimate && !values.currency) {
                form.setError("currency", {
                  message: "Currency is required with a cost estimate",
                });
                return;
              }
              await onSubmit({
                status: values.status,
                treatmentCostEstimate: values.treatmentCostEstimate || undefined,
                currency: values.treatmentCostEstimate ? values.currency : undefined,
                notes: values.notes.trim() || undefined,
              });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Response</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="DECLINED">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {status === "ACCEPTED" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="treatmentCostEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment cost estimate</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

- [ ] **Step 4: Create `aster/components/cases/hospital-inquiry-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendInquiryDialog } from "@/components/cases/send-inquiry-dialog";
import { RespondInquiryDialog } from "@/components/cases/respond-inquiry-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { sendInquiry, respondToInquiry, getErrorMessage } from "@/services/cases";
import type { Case, HospitalInquiry } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

const INQUIRY_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
};

type HospitalInquiryPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function HospitalInquiryPanel({ kase, onChanged }: HospitalInquiryPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [sendOpen, setSendOpen] = useState(false);
  const [respondingInquiry, setRespondingInquiry] = useState<HospitalInquiry | null>(null);

  const hasPending = kase.inquiries.some((i) => i.status === "PENDING");
  const canSend = hasPermission("UPDATE_CASES") && !hasPending && kase.status !== "CANCELLED";

  const handleSend = async (values: { hospitalId: string; notes?: string }) => {
    try {
      await sendInquiry(kase.id, values);
      toast.success("Inquiry sent");
      setSendOpen(false);
      onChanged();
    } catch (error) {
      toast.error("Could not send inquiry", getErrorMessage(error));
      throw error;
    }
  };

  const handleRespond = async (values: Record<string, unknown>) => {
    if (!respondingInquiry) return;
    try {
      await respondToInquiry(kase.id, respondingInquiry.id, values);
      toast.success("Response recorded");
      setRespondingInquiry(null);
      onChanged();
    } catch (error) {
      toast.error("Could not record response", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Hospital matching</CardTitle>
        {canSend && (
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send to hospital
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {kase.inquiries.length === 0 && (
          <p className="text-sm text-muted-foreground">No inquiries sent yet.</p>
        )}
        {kase.inquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className="flex items-start justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">
                {inquiry.hospital.name} — {inquiry.hospital.city}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {formatDate(inquiry.sentAt)}
                {inquiry.respondedAt && ` · Responded ${formatDate(inquiry.respondedAt)}`}
              </p>
              {inquiry.treatmentCostEstimate && (
                <p className="text-xs text-muted-foreground">
                  Estimate: {inquiry.treatmentCostEstimate} {inquiry.currency}
                </p>
              )}
              {inquiry.notes && <p className="mt-1 text-xs">{inquiry.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={INQUIRY_STATUS_VARIANT[inquiry.status]}>
                {inquiry.status}
              </Badge>
              {inquiry.status === "PENDING" && hasPermission("UPDATE_CASES") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRespondingInquiry(inquiry)}
                >
                  Record response
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <SendInquiryDialog open={sendOpen} onOpenChange={setSendOpen} onSubmit={handleSend} />
      <RespondInquiryDialog
        open={!!respondingInquiry}
        onOpenChange={(open) => !open && setRespondingInquiry(null)}
        inquiry={respondingInquiry}
        onSubmit={handleRespond}
      />
    </Card>
  );
}
```

- [ ] **Step 5: Create `aster/app/dashboard/cases/[id]/page.tsx`**

```tsx
"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/users/page-header";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { HospitalInquiryPanel } from "@/components/cases/hospital-inquiry-panel";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { cancelCase, getErrorMessage } from "@/services/cases";

type PageProps = { params: Promise<{ id: string }> };

export default function CaseDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const { case: kase, loading, refetch } = useCaseDetail(id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelCase(id);
      toast.success("Case cancelled");
      setCancelOpen(false);
      refetch();
    } catch (error) {
      toast.error("Could not cancel case", getErrorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !kase) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title={kase.caseNumber}
        description={`${kase.patient.firstName} ${kase.patient.lastName}`}
        backHref="/dashboard/cases"
        actions={
          <>
            {hasPermission("UPDATE_CASES") && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/cases/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {hasPermission("UPDATE_CASES") && kase.status !== "CANCELLED" && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancel case
              </Button>
            )}
          </>
        }
      />

      <CaseDetailView kase={kase} />
      <HospitalInquiryPanel kase={kase} onChanged={refetch} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel case {kase.caseNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the case as cancelled. It cannot be reopened from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep case</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling..." : "Cancel case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors beyond the known pre-existing ones.

- [ ] **Step 7: Commit**

```bash
git add aster/components/cases/case-detail-view.tsx aster/components/cases/send-inquiry-dialog.tsx aster/components/cases/respond-inquiry-dialog.tsx aster/components/cases/hospital-inquiry-panel.tsx "aster/app/dashboard/cases/[id]/page.tsx"
git commit -m "Add Case detail page with hospital-inquiry actions and cancel"
```

---

### Task 6: Sidebar wiring + end-to-end verification

**Files:**
- Modify: `aster/components/Layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `/dashboard/cases`, `/dashboard/cases/new` (Tasks 3-4's pages); the
  existing `NavigationItem` type and permission-based filtering logic (unchanged — same
  pattern as the existing "Users" dropdown).

- [ ] **Step 1: Add a "Cases" dropdown to `aster/components/Layout/Sidebar.tsx`**

Find:
```tsx
  List,
  UserPlus,
  Building2,
  Handshake,
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
} from "lucide-react";
```

Find:
```tsx
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    children: [
      { name: "All Users", href: "/dashboard/users", icon: List, permission: "VIEW_USERS" },
      { name: "Add New User", href: "/dashboard/users/new", icon: UserPlus, permission: "CREATE_USERS" },
    ],
  },
```

Replace with:
```tsx
  {
    name: "Cases",
    href: "/dashboard/cases",
    icon: ClipboardList,
    children: [
      { name: "All Cases", href: "/dashboard/cases", icon: List, permission: "VIEW_CASES" },
      { name: "Add New Case", href: "/dashboard/cases/new", icon: FilePlus2, permission: "CREATE_CASES" },
    ],
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    children: [
      { name: "All Users", href: "/dashboard/users", icon: List, permission: "VIEW_USERS" },
      { name: "Add New User", href: "/dashboard/users/new", icon: UserPlus, permission: "CREATE_USERS" },
    ],
  },
```

- [ ] **Step 2: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual end-to-end verification**

With the backend running (`npm run dev` in `Server/`, adjusting `PORT` if needed) and
the frontend running (`npm run dev` in `aster/`):

1. Log in as the seeded ADMIN.
2. Confirm "Cases" appears as a new sidebar dropdown with "All Cases"/"Add New Case".
3. Visit `/dashboard/cases/new`: create a direct case with a brand-new patient and an
   attendant. Confirm redirect to the new case's detail page, showing a `caseNumber`
   like `ASR-CASE-26-08-0001`, status `NEW`, patient and attendant sections populated.
4. On that case's detail page, click "Send to hospital", pick a hospital (create one
   first via `/dashboard/hospitals` if none exist), submit. Confirm the inquiry appears
   with status `PENDING` and the case's status badge updates to `HOSPITAL MATCHING`.
5. Try "Send to hospital" again while the inquiry is still pending — confirm the button
   is hidden (or, if clicked via a stale render, the request 409s and shows an error
   toast).
6. Click "Record response" on the pending inquiry, choose "Accepted" with a cost
   estimate and currency, submit. Confirm the inquiry shows `ACCEPTED` and the case
   status badge updates to `HOSPITAL ACCEPTED`, and "Send to hospital" reappears.
7. Visit `/dashboard/cases`, confirm the new case appears in the list with the right
   status badge; try the passport-number search box on `/dashboard/cases/new` (a second
   time) to confirm the existing patient is found and can be reused for a second case.
8. On the case detail page, click "Cancel case", confirm it in the dialog, confirm the
   status badge updates to `CANCELLED` and the Cancel button disappears.
9. Log out, log in as a non-admin test user without `VIEW_CASES` (reuse one from prior
   manual testing if one exists — otherwise skip this check and note it as a gap,
   consistent with the same accepted gap from the Hospitals & Agencies plan), and
   confirm the "Cases" sidebar item doesn't appear and direct navigation to
   `/dashboard/cases` redirects to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add aster/components/Layout/Sidebar.tsx
git commit -m "Add Cases dropdown to the sidebar"
```

## Self-Review

**Spec coverage:** Every part of the design spec's Sections 2-4 (patient reuse via
passport search, attendant collected inline, immutable `patientId`/`reachOutType`/
`caseNumber`, one-pending-inquiry-at-a-time, auto status transitions on inquiry
send/response, manual cancellation independent of those transitions, the full API
surface, and the file structure) is implemented across the 6 tasks. Visa/documents/
finance remain correctly out of scope. The spec's "no DELETE endpoint" gap (an
inconsistency between the earlier-seeded `DELETE_CASES` permission and this spec) is
called out explicitly in Global Constraints rather than silently resolved either way.

**Placeholder scan:** No TBD/TODO markers; every step has literal, complete code.

**Type consistency:** The backend/frontend field-name contract is the trickiest part of
this plan and was corrected during authoring — patient fields are bare
(`firstName`/`lastName`/...) while attendant fields carry an `attendant` prefix
(`attendantFirstName`/...) in every request body, service function, and payload
builder, consistently: `casesService.js`'s `ATTENDANT_FIELD_MAP` (Task 1/2),
`buildCaseCreatePayload`/`buildCaseUpdatePayload` (Task 4), and the curl verification
bodies (Task 1/2) all agree. `CaseFormValues`'s field names (Task 3) match what
`patient-fields.tsx`/`attendant-fields.tsx` (Task 4) render `FormField`s for. Service
function names/signatures (`listCases`, `getCaseById`, `createCase`, `updateCase`,
`cancelCase`, `sendInquiry`, `respondToInquiry`, `searchPatients`) are consistent
between Task 1/2's backend and Task 3's frontend service wrappers, and match what
Tasks 4-5's components import.
