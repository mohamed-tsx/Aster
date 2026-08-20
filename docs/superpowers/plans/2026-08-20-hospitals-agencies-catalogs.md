# Hospitals & Agencies Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Hospital and Agency admin catalogs (backend CRUD APIs + frontend
management pages), the first pieces of application logic on top of the domain schema
foundation, and the prerequisite the Cases module (next plan) depends on for its
hospital/agency pickers.

**Architecture:** Two near-identical CRUD modules, each following the exact
Route → Controller → Service pattern already established by Roles/Permissions in this
repo (Express + `asyncHandler` + `sendSuccess`/`sendCreated` + `AppError`, gated by
`RequirePermission`/`RequireAnyPermission`), with matching frontend table + form-dialog
pages mirroring `permissions-tab.tsx`/`permission-form-dialog.tsx`.

**Tech Stack:** Express 5, Prisma Client (already generated with `Hospital`/`Agency`
models from the schema foundation), Next.js (App Router) + react-hook-form + zod +
shadcn/ui on the frontend.

**Spec:** `docs/superpowers/specs/2026-08-20-cases-hospitals-agencies-design.md`
(Section 1 and the "Hospitals"/"Agencies" parts of "API surface"/"File structure")

## Global Constraints

- Response envelope: every success response is `sendSuccess(res, message, data)` /
  `sendCreated(res, message, data)` → `{ success: true, message, data }`. List
  endpoints wrap the array under a named key (`{ hospitals: [...] }` /
  `{ agencies: [...] }`), matching `listRolesCtrl`'s `{ roles }` shape.
- Permission gating: `GET` routes use
  `RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_HOSPITALS"])` (Hospitals)
  / `RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_AGENCIES"])`
  (Agencies) — case intake needs to read these lists even without the manage
  permission. `POST`/`PUT`/`DELETE` use `RequirePermission("MANAGE_HOSPITALS")` /
  `RequirePermission("MANAGE_AGENCIES")`. All 9 case-management permissions
  (including these two) are already seeded and granted to ADMIN — no seed changes in
  this plan.
- `Hospital.name` has **no** uniqueness constraint in the schema (multiple hospitals
  can share a name across different cities) — do **not** add a duplicate-name check
  for Hospital create/update. `Agency.name` **is** `@unique` in the schema — Agency
  create/update **must** check for duplicates and return 409, mirroring
  `createRole`/`updateRole`'s pattern exactly.
- Delete guards: both `Hospital` and `Agency` deletes must pre-check for dependent
  records and return a friendly 409 (mirroring `deleteRole`'s "N user(s) are still
  assigned" message) even though the database's `RESTRICT` foreign keys
  (`HospitalInquiry.hospital`, `Case.agency`) already prevent the delete — this avoids
  surfacing a raw Postgres FK-violation error to the user.
- Frontend validation: use the existing manual pattern — `useForm({ defaultValues })`
  with no `zodResolver`, and `schema.safeParse(values)` inside `form.handleSubmit`
  (see `role-form-dialog.tsx`/`permission-form-dialog.tsx`). Do **not** introduce
  `zodResolver` — it's used nowhere else in this codebase except the login form.
- No test framework exists in this codebase. Verification is: manual `curl` pass
  against a running server (login as seeded ADMIN, exercise every endpoint including
  guardrail rejections), `npx tsc --noEmit` clean on the frontend, then a manual
  browser pass.

---

## File Structure

- Create: `Server/Src/Services/Hospitals/hospitalsService.js`
- Create: `Server/Src/Controllers/Hospitals/hospitalsController.js`
- Create: `Server/Src/Routes/Hospitals/hospitalsRoute.js`
- Create: `Server/Src/Services/Agencies/agenciesService.js`
- Create: `Server/Src/Controllers/Agencies/agenciesController.js`
- Create: `Server/Src/Routes/Agencies/agenciesRoute.js`
- Modify: `Server/cmd/Server/Server.js` — mount the two new routers
- Create: `aster/types/hospital.ts`, `aster/types/agency.ts`
- Create: `aster/services/hospitals.ts`, `aster/services/agencies.ts`
- Create: `aster/lib/validations/hospital.ts`, `aster/lib/validations/agency.ts`
- Create: `aster/components/hospitals/hospitals-table.tsx`,
  `aster/components/hospitals/hospital-form-dialog.tsx`
- Create: `aster/components/agencies/agencies-table.tsx`,
  `aster/components/agencies/agency-form-dialog.tsx`
- Create: `aster/app/dashboard/hospitals/page.tsx`,
  `aster/app/dashboard/agencies/page.tsx`
- Modify: `aster/components/Layout/Sidebar.tsx` — two new nav items

---

### Task 1: Backend — Hospitals & Agencies CRUD APIs

**Files:**
- Create: `Server/Src/Services/Hospitals/hospitalsService.js`
- Create: `Server/Src/Controllers/Hospitals/hospitalsController.js`
- Create: `Server/Src/Routes/Hospitals/hospitalsRoute.js`
- Create: `Server/Src/Services/Agencies/agenciesService.js`
- Create: `Server/Src/Controllers/Agencies/agenciesController.js`
- Create: `Server/Src/Routes/Agencies/agenciesRoute.js`
- Modify: `Server/cmd/Server/Server.js`

**Interfaces:**
- Consumes: `Prisma.hospital`, `Prisma.agency` client accessors (from the schema
  foundation), `AppError` (`Server/Src/Utils/ErrorHandler/errorHandler.js`),
  `sendSuccess`/`sendCreated` (`Server/Src/Utils/Response/apiResponse.js`), `Verify`,
  `RequirePermission`, `RequireAnyPermission` middleware (all pre-existing).
- Produces: `GET/POST/PUT/DELETE /api/v1/hospitals[/:id]` and
  `GET/POST/PUT/DELETE /api/v1/agencies[/:id]`, mounted in `Server.js` — Task 2's
  frontend services call these exact paths.

- [ ] **Step 1: Create `Server/Src/Services/Hospitals/hospitalsService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const HOSPITAL_INCLUDE = {
  _count: { select: { inquiries: true } },
};

export const listHospitals = async () => {
  return Prisma.hospital.findMany({
    include: HOSPITAL_INCLUDE,
    orderBy: { name: "asc" },
  });
};

/**
 * @param {{ name: string, city: string, specialties?: string, contactPerson?: string, phone?: string, email?: string }} data
 */
export const createHospital = async (data) => {
  const { name, city, specialties, contactPerson, phone, email } = data;

  if (!name?.trim()) {
    throw new AppError("Hospital name is required", 400, "VALIDATION_ERROR");
  }
  if (!city?.trim()) {
    throw new AppError("City is required", 400, "VALIDATION_ERROR");
  }

  return Prisma.hospital.create({
    data: {
      name: name.trim(),
      city: city.trim(),
      specialties: specialties?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    },
    include: HOSPITAL_INCLUDE,
  });
};

/**
 * @param {string} hospitalId
 * @param {{ name?: string, city?: string, specialties?: string, contactPerson?: string, phone?: string, email?: string }} data
 */
export const updateHospital = async (hospitalId, data) => {
  const hospital = await Prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (!data.name?.trim()) {
      throw new AppError("Hospital name is required", 400, "VALIDATION_ERROR");
    }
    updateData.name = data.name.trim();
  }

  if (data.city !== undefined) {
    if (!data.city?.trim()) {
      throw new AppError("City is required", 400, "VALIDATION_ERROR");
    }
    updateData.city = data.city.trim();
  }

  if (data.specialties !== undefined) updateData.specialties = data.specialties?.trim() || null;
  if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;

  return Prisma.hospital.update({
    where: { id: hospitalId },
    data: updateData,
    include: HOSPITAL_INCLUDE,
  });
};

export const deleteHospital = async (hospitalId) => {
  const hospital = await Prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { _count: { select: { inquiries: true } } },
  });

  if (!hospital) {
    throw new AppError("Hospital not found", 404, "NOT_FOUND");
  }

  if (hospital._count.inquiries > 0) {
    throw new AppError(
      `Cannot delete hospital: it has ${hospital._count.inquiries} inquiry/inquiries on record. Remove or reassign them first.`,
      409,
      "CONFLICT",
    );
  }

  await Prisma.hospital.delete({ where: { id: hospitalId } });
  return true;
};
```

- [ ] **Step 2: Create `Server/Src/Controllers/Hospitals/hospitalsController.js`**

```js
import asyncHandler from "express-async-handler";
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
} from "../../Services/Hospitals/hospitalsService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listHospitalsCtrl = asyncHandler(async (req, res) => {
  const hospitals = await listHospitals();
  return sendSuccess(res, "Hospitals retrieved successfully", { hospitals });
});

export const createHospitalCtrl = asyncHandler(async (req, res) => {
  const hospital = await createHospital(req.body);
  return sendCreated(res, "Hospital created successfully", hospital);
});

export const updateHospitalCtrl = asyncHandler(async (req, res) => {
  const hospital = await updateHospital(req.params.id, req.body);
  return sendSuccess(res, "Hospital updated successfully", hospital);
});

export const deleteHospitalCtrl = asyncHandler(async (req, res) => {
  await deleteHospital(req.params.id);
  return sendSuccess(res, "Hospital deleted successfully");
});
```

- [ ] **Step 3: Create `Server/Src/Routes/Hospitals/hospitalsRoute.js`**

```js
import express from "express";
import {
  listHospitalsCtrl,
  createHospitalCtrl,
  updateHospitalCtrl,
  deleteHospitalCtrl,
} from "../../Controllers/Hospitals/hospitalsController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_HOSPITALS"]),
  listHospitalsCtrl,
);
router.post("/", RequirePermission("MANAGE_HOSPITALS"), createHospitalCtrl);
router.put("/:id", RequirePermission("MANAGE_HOSPITALS"), updateHospitalCtrl);
router.delete("/:id", RequirePermission("MANAGE_HOSPITALS"), deleteHospitalCtrl);

export default router;
```

- [ ] **Step 4: Create `Server/Src/Services/Agencies/agenciesService.js`**

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

const AGENCY_INCLUDE = {
  _count: { select: { cases: true } },
};

export const listAgencies = async () => {
  return Prisma.agency.findMany({
    include: AGENCY_INCLUDE,
    orderBy: { name: "asc" },
  });
};

/**
 * @param {{ name: string, contactPerson?: string, phone?: string, email?: string, address?: string }} data
 */
export const createAgency = async (data) => {
  const { name, contactPerson, phone, email, address } = data;

  if (!name?.trim()) {
    throw new AppError("Agency name is required", 400, "VALIDATION_ERROR");
  }

  const existing = await Prisma.agency.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new AppError("Agency name already exists", 409, "CONFLICT");
  }

  return Prisma.agency.create({
    data: {
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
    },
    include: AGENCY_INCLUDE,
  });
};

/**
 * @param {string} agencyId
 * @param {{ name?: string, contactPerson?: string, phone?: string, email?: string, address?: string }} data
 */
export const updateAgency = async (agencyId, data) => {
  const agency = await Prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    throw new AppError("Agency not found", 404, "NOT_FOUND");
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (!data.name?.trim()) {
      throw new AppError("Agency name is required", 400, "VALIDATION_ERROR");
    }
    const dup = await Prisma.agency.findFirst({
      where: { name: data.name.trim(), id: { not: agencyId } },
    });
    if (dup) {
      throw new AppError("Agency name already exists", 409, "CONFLICT");
    }
    updateData.name = data.name.trim();
  }

  if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;

  return Prisma.agency.update({
    where: { id: agencyId },
    data: updateData,
    include: AGENCY_INCLUDE,
  });
};

export const deleteAgency = async (agencyId) => {
  const agency = await Prisma.agency.findUnique({
    where: { id: agencyId },
    include: { _count: { select: { cases: true } } },
  });

  if (!agency) {
    throw new AppError("Agency not found", 404, "NOT_FOUND");
  }

  if (agency._count.cases > 0) {
    throw new AppError(
      `Cannot delete agency: ${agency._count.cases} case(s) are still linked to it. Reassign them first.`,
      409,
      "CONFLICT",
    );
  }

  await Prisma.agency.delete({ where: { id: agencyId } });
  return true;
};
```

- [ ] **Step 5: Create `Server/Src/Controllers/Agencies/agenciesController.js`**

```js
import asyncHandler from "express-async-handler";
import {
  listAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
} from "../../Services/Agencies/agenciesService.js";
import { sendSuccess, sendCreated } from "../../Utils/Response/apiResponse.js";

export const listAgenciesCtrl = asyncHandler(async (req, res) => {
  const agencies = await listAgencies();
  return sendSuccess(res, "Agencies retrieved successfully", { agencies });
});

export const createAgencyCtrl = asyncHandler(async (req, res) => {
  const agency = await createAgency(req.body);
  return sendCreated(res, "Agency created successfully", agency);
});

export const updateAgencyCtrl = asyncHandler(async (req, res) => {
  const agency = await updateAgency(req.params.id, req.body);
  return sendSuccess(res, "Agency updated successfully", agency);
});

export const deleteAgencyCtrl = asyncHandler(async (req, res) => {
  await deleteAgency(req.params.id);
  return sendSuccess(res, "Agency deleted successfully");
});
```

- [ ] **Step 6: Create `Server/Src/Routes/Agencies/agenciesRoute.js`**

```js
import express from "express";
import {
  listAgenciesCtrl,
  createAgencyCtrl,
  updateAgencyCtrl,
  deleteAgencyCtrl,
} from "../../Controllers/Agencies/agenciesController.js";
import Verify from "../../Middlewares/Auth/Verify.js";
import RequirePermission from "../../Middlewares/Auth/RequirePermission.js";
import RequireAnyPermission from "../../Middlewares/Auth/RequireAnyPermission.js";

const router = express.Router();

router.use(Verify);

router.get(
  "/",
  RequireAnyPermission(["CREATE_CASES", "UPDATE_CASES", "MANAGE_AGENCIES"]),
  listAgenciesCtrl,
);
router.post("/", RequirePermission("MANAGE_AGENCIES"), createAgencyCtrl);
router.put("/:id", RequirePermission("MANAGE_AGENCIES"), updateAgencyCtrl);
router.delete("/:id", RequirePermission("MANAGE_AGENCIES"), deleteAgencyCtrl);

export default router;
```

- [ ] **Step 7: Mount both routers in `Server/cmd/Server/Server.js`**

Find:
```js
import authRoutes from "../../Src/Routes/Auth/authRoute.js";
import usersRoutes from "../../Src/Routes/Users/usersRoute.js";
import rolesRoutes from "../../Src/Routes/Roles/rolesRoute.js";
import permissionsRoutes from "../../Src/Routes/Permissions/permissionsRoute.js";
```

Replace with:
```js
import authRoutes from "../../Src/Routes/Auth/authRoute.js";
import usersRoutes from "../../Src/Routes/Users/usersRoute.js";
import rolesRoutes from "../../Src/Routes/Roles/rolesRoute.js";
import permissionsRoutes from "../../Src/Routes/Permissions/permissionsRoute.js";
import hospitalsRoutes from "../../Src/Routes/Hospitals/hospitalsRoute.js";
import agenciesRoutes from "../../Src/Routes/Agencies/agenciesRoute.js";
```

Find:
```js
Server.use("/api/v1/auth", authRoutes);
Server.use("/api/v1/users", usersRoutes);
Server.use("/api/v1/roles", rolesRoutes);
Server.use("/api/v1/permissions", permissionsRoutes);
```

Replace with:
```js
Server.use("/api/v1/auth", authRoutes);
Server.use("/api/v1/users", usersRoutes);
Server.use("/api/v1/roles", rolesRoutes);
Server.use("/api/v1/permissions", permissionsRoutes);
Server.use("/api/v1/hospitals", hospitalsRoutes);
Server.use("/api/v1/agencies", agenciesRoutes);
```

- [ ] **Step 8: Manual verification**

Start the server (from `Server/`): `npm run dev`

In another terminal, log in as the seeded ADMIN and save cookies (replace
`<ADMIN_PASSWORD>` with the value from `Server/.env`, default `admin123`):

```bash
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```
Expected: `"success":true` with a user object.

Exercise the Hospitals API:
```bash
# Create
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/hospitals \
  -H "Content-Type: application/json" \
  -d '{"name":"Aster Medcity","city":"Kochi","specialties":"Cardiology, Oncology"}'
# Expect 201, success:true, hospital object with id

# List
curl -s -b cookies.txt http://localhost:5000/api/v1/hospitals
# Expect success:true, data.hospitals array containing the created hospital with _count.inquiries: 0

# Update (replace <ID> with the created hospital's id)
curl -s -b cookies.txt -X PUT http://localhost:5000/api/v1/hospitals/<ID> \
  -H "Content-Type: application/json" \
  -d '{"city":"Ernakulam"}'
# Expect success:true, city updated, other fields unchanged

# Delete
curl -s -b cookies.txt -X DELETE http://localhost:5000/api/v1/hospitals/<ID>
# Expect success:true

# Delete a non-existent id
curl -s -b cookies.txt -X DELETE http://localhost:5000/api/v1/hospitals/nonexistent-id
# Expect 404, success:false, "Hospital not found"
```

Exercise the Agencies API the same way, plus the duplicate-name guard:
```bash
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/agencies \
  -H "Content-Type: application/json" \
  -d '{"name":"Global Health Partners","contactPerson":"Jane Doe"}'
# Expect 201

curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/agencies \
  -H "Content-Type: application/json" \
  -d '{"name":"Global Health Partners"}'
# Expect 409, "Agency name already exists"
```

Confirm permission gating rejects an unauthorized request: log in as a non-admin user
lacking `MANAGE_HOSPITALS`/`MANAGE_AGENCIES` (create one via the existing Users UI with
a role that has only `VIEW_USERS`, or skip this check if no such test user exists yet
and note it as a concern) and confirm `POST /api/v1/hospitals` returns 403.

- [ ] **Step 9: Commit**

```bash
git add Server/Src/Services/Hospitals Server/Src/Controllers/Hospitals Server/Src/Routes/Hospitals Server/Src/Services/Agencies Server/Src/Controllers/Agencies Server/Src/Routes/Agencies Server/cmd/Server/Server.js
git commit -m "Add Hospitals and Agencies CRUD APIs"
```

---

### Task 2: Frontend — Hospitals & Agencies management pages

**Files:**
- Create: `aster/types/hospital.ts`, `aster/types/agency.ts`
- Create: `aster/services/hospitals.ts`, `aster/services/agencies.ts`
- Create: `aster/lib/validations/hospital.ts`, `aster/lib/validations/agency.ts`
- Create: `aster/components/hospitals/hospitals-table.tsx`,
  `aster/components/hospitals/hospital-form-dialog.tsx`
- Create: `aster/components/agencies/agencies-table.tsx`,
  `aster/components/agencies/agency-form-dialog.tsx`
- Create: `aster/app/dashboard/hospitals/page.tsx`,
  `aster/app/dashboard/agencies/page.tsx`

**Interfaces:**
- Consumes: Task 1's `/api/v1/hospitals` and `/api/v1/agencies` endpoints; the
  existing `api`/`getErrorMessage` utility (`@/utils/api`), `useToast`
  (`@/hooks/use-toast`), `useDeleteConfirmation` (`@/hooks/use-delete-confirmation`),
  `usePermissionGuard` (`@/hooks/use-permission-guard`), `PageHeader`
  (`@/components/users/page-header`), `DeleteConfirmationDialog`
  (`@/components/ui/delete-confirmation-dialog`) — all pre-existing.
- Produces: `Hospital`/`Agency` types, `listHospitals`/`createHospital`/
  `updateHospital`/`deleteHospital` and the `Agency` equivalents (all in
  `aster/services/{hospitals,agencies}.ts`) — the next plan (Cases module) imports
  these directly for its hospital/agency pickers.

- [ ] **Step 1: Create `aster/types/hospital.ts`**

```ts
export type Hospital = {
  id: string;
  name: string;
  city: string;
  specialties: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  _count: { inquiries: number };
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Create `aster/types/agency.ts`**

```ts
export type Agency = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  _count: { cases: number };
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 3: Create `aster/lib/validations/hospital.ts`**

```ts
import { z } from "zod";

export const hospitalSchema = z.object({
  name: z.string().min(1, "Hospital name is required").max(150),
  city: z.string().min(1, "City is required").max(100),
  specialties: z.string().max(300).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export type HospitalFormValues = z.infer<typeof hospitalSchema>;
```

- [ ] **Step 4: Create `aster/lib/validations/agency.ts`**

```ts
import { z } from "zod";

export const agencySchema = z.object({
  name: z.string().min(1, "Agency name is required").max(150),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(300).optional(),
});

export type AgencyFormValues = z.infer<typeof agencySchema>;
```

- [ ] **Step 5: Create `aster/services/hospitals.ts`**

```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Hospital } from "@/types/hospital";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type HospitalPayload = {
  name: string;
  city: string;
  specialties?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
};

export async function listHospitals(): Promise<Hospital[]> {
  const response = await api.get<ApiSuccess<{ hospitals: Hospital[] }>>("/hospitals");
  return unwrap(response).hospitals;
}

export async function createHospital(payload: HospitalPayload): Promise<Hospital> {
  const response = await api.post<ApiSuccess<Hospital>>("/hospitals", payload);
  return unwrap(response);
}

export async function updateHospital(
  id: string,
  payload: HospitalPayload,
): Promise<Hospital> {
  const response = await api.put<ApiSuccess<Hospital>>(`/hospitals/${id}`, payload);
  return unwrap(response);
}

export async function deleteHospital(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/hospitals/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
```

- [ ] **Step 6: Create `aster/services/agencies.ts`**

```ts
import api, { getErrorMessage } from "@/utils/api";
import type { Agency } from "@/types/agency";

type ApiSuccess<T> = { success: boolean; message: string; data: T };

function unwrap<T>(response: { data: ApiSuccess<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export type AgencyPayload = {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export async function listAgencies(): Promise<Agency[]> {
  const response = await api.get<ApiSuccess<{ agencies: Agency[] }>>("/agencies");
  return unwrap(response).agencies;
}

export async function createAgency(payload: AgencyPayload): Promise<Agency> {
  const response = await api.post<ApiSuccess<Agency>>("/agencies", payload);
  return unwrap(response);
}

export async function updateAgency(
  id: string,
  payload: AgencyPayload,
): Promise<Agency> {
  const response = await api.put<ApiSuccess<Agency>>(`/agencies/${id}`, payload);
  return unwrap(response);
}

export async function deleteAgency(id: string): Promise<void> {
  const response = await api.delete<ApiSuccess<null>>(`/agencies/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
}

export { getErrorMessage };
```

- [ ] **Step 7: Create `aster/components/hospitals/hospital-form-dialog.tsx`**

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { hospitalSchema, type HospitalFormValues } from "@/lib/validations/hospital";
import type { Hospital } from "@/types/hospital";

type HospitalFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital: Hospital | null;
  onSubmit: (values: HospitalFormValues) => Promise<void>;
};

const EMPTY_VALUES: HospitalFormValues = {
  name: "",
  city: "",
  specialties: "",
  contactPerson: "",
  phone: "",
  email: "",
};

export function HospitalFormDialog({
  open,
  onOpenChange,
  hospital,
  onSubmit,
}: HospitalFormDialogProps) {
  const form = useForm<HospitalFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (open) {
      form.reset(
        hospital
          ? {
              name: hospital.name,
              city: hospital.city,
              specialties: hospital.specialties ?? "",
              contactPerson: hospital.contactPerson ?? "",
              phone: hospital.phone ?? "",
              email: hospital.email ?? "",
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, hospital, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hospital ? "Edit hospital" : "Add hospital"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = hospitalSchema.safeParse(values);
              if (!parsed.success) return;
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Aster Medcity" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Kochi" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialties</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Cardiology, Oncology" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
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

- [ ] **Step 8: Create `aster/components/hospitals/hospitals-table.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { HospitalFormDialog } from "@/components/hospitals/hospital-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  getErrorMessage,
} from "@/services/hospitals";
import type { Hospital } from "@/types/hospital";
import type { HospitalFormValues } from "@/lib/validations/hospital";

export function HospitalsTable() {
  const toast = useToast();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setHospitals(await listHospitals());
    } catch (error) {
      toast.error("Failed to load hospitals", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Hospital",
    onDelete: async (id) => {
      await deleteHospital(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingHospital(null);
    setDialogOpen(true);
  };

  const openEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: HospitalFormValues) => {
    try {
      if (editingHospital) {
        await updateHospital(editingHospital.id, values);
        toast.success("Hospital updated");
      } else {
        await createHospital(values);
        toast.success("Hospital created");
      }
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
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add hospital
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hospitals.map((hospital) => (
              <TableRow key={hospital.id}>
                <TableCell className="font-medium">{hospital.name}</TableCell>
                <TableCell>{hospital.city}</TableCell>
                <TableCell>
                  {hospital.contactPerson || hospital.phone || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(hospital)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDeleteClick({ id: hospital.id, name: hospital.name })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <HospitalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hospital={editingHospital}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete hospital"
        description="This cannot be undone. Hospitals with inquiry history cannot be deleted."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
```

- [ ] **Step 9: Create `aster/app/dashboard/hospitals/page.tsx`**

```tsx
"use client";

import { PageHeader } from "@/components/users/page-header";
import { HospitalsTable } from "@/components/hospitals/hospitals-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function HospitalsPage() {
  const allowed = usePermissionGuard("MANAGE_HOSPITALS");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Hospitals"
        description="Manage the partner hospitals cases can be matched to."
      />
      <HospitalsTable />
    </div>
  );
}
```

- [ ] **Step 10: Create `aster/components/agencies/agency-form-dialog.tsx`**

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { agencySchema, type AgencyFormValues } from "@/lib/validations/agency";
import type { Agency } from "@/types/agency";

type AgencyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agency: Agency | null;
  onSubmit: (values: AgencyFormValues) => Promise<void>;
};

const EMPTY_VALUES: AgencyFormValues = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

export function AgencyFormDialog({
  open,
  onOpenChange,
  agency,
  onSubmit,
}: AgencyFormDialogProps) {
  const form = useForm<AgencyFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (open) {
      form.reset(
        agency
          ? {
              name: agency.name,
              contactPerson: agency.contactPerson ?? "",
              phone: agency.phone ?? "",
              email: agency.email ?? "",
              address: agency.address ?? "",
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, agency, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{agency ? "Edit agency" : "Add agency"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = agencySchema.safeParse(values);
              if (!parsed.success) return;
              await onSubmit(parsed.data);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Global Health Partners" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
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

- [ ] **Step 11: Create `aster/components/agencies/agencies-table.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { AgencyFormDialog } from "@/components/agencies/agency-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
  getErrorMessage,
} from "@/services/agencies";
import type { Agency } from "@/types/agency";
import type { AgencyFormValues } from "@/lib/validations/agency";

export function AgenciesTable() {
  const toast = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setAgencies(await listAgencies());
    } catch (error) {
      toast.error("Failed to load agencies", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Agency",
    onDelete: async (id) => {
      await deleteAgency(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingAgency(null);
    setDialogOpen(true);
  };

  const openEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: AgencyFormValues) => {
    try {
      if (editingAgency) {
        await updateAgency(editingAgency.id, values);
        toast.success("Agency updated");
      } else {
        await createAgency(values);
        toast.success("Agency created");
      }
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
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add agency
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map((agency) => (
              <TableRow key={agency.id}>
                <TableCell className="font-medium">{agency.name}</TableCell>
                <TableCell>{agency.contactPerson || "—"}</TableCell>
                <TableCell>{agency.phone || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(agency)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDeleteClick({ id: agency.id, name: agency.name })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AgencyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agency={editingAgency}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete agency"
        description="This cannot be undone. Agencies with linked cases cannot be deleted."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
```

- [ ] **Step 12: Create `aster/app/dashboard/agencies/page.tsx`**

```tsx
"use client";

import { PageHeader } from "@/components/users/page-header";
import { AgenciesTable } from "@/components/agencies/agencies-table";
import { usePermissionGuard } from "@/hooks/use-permission-guard";

export default function AgenciesPage() {
  const allowed = usePermissionGuard("MANAGE_AGENCIES");
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Agencies"
        description="Manage the referral agencies that bring in agency-sourced cases."
      />
      <AgenciesTable />
    </div>
  );
}
```

- [ ] **Step 13: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add aster/types/hospital.ts aster/types/agency.ts aster/services/hospitals.ts aster/services/agencies.ts aster/lib/validations/hospital.ts aster/lib/validations/agency.ts aster/components/hospitals aster/components/agencies aster/app/dashboard/hospitals aster/app/dashboard/agencies
git commit -m "Add Hospitals and Agencies management pages"
```

---

### Task 3: Sidebar wiring + end-to-end verification

**Files:**
- Modify: `aster/components/Layout/Sidebar.tsx`

**Interfaces:**
- Consumes: Task 2's `/dashboard/hospitals` and `/dashboard/agencies` routes; the
  existing `NavigationItem` type and `permission`-based filtering logic already in
  `Sidebar.tsx` (no changes to the filtering logic itself — just two new entries).

- [ ] **Step 1: Add two nav items to `aster/components/Layout/Sidebar.tsx`**

Find:
```tsx
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  User as UserIcon,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronsUpDown,
  List,
  UserPlus,
} from "lucide-react";
```

Replace with:
```tsx
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  User as UserIcon,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronsUpDown,
  List,
  UserPlus,
  Building2,
  Handshake,
} from "lucide-react";
```

Find:
```tsx
  {
    name: "Roles & Permissions",
    href: "/dashboard/roles",
    icon: ShieldCheck,
    children: null,
    permission: "MANAGE_ROLES",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    children: null,
  },
];
```

Replace with:
```tsx
  {
    name: "Roles & Permissions",
    href: "/dashboard/roles",
    icon: ShieldCheck,
    children: null,
    permission: "MANAGE_ROLES",
  },
  {
    name: "Hospitals",
    href: "/dashboard/hospitals",
    icon: Building2,
    children: null,
    permission: "MANAGE_HOSPITALS",
  },
  {
    name: "Agencies",
    href: "/dashboard/agencies",
    icon: Handshake,
    children: null,
    permission: "MANAGE_AGENCIES",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    children: null,
  },
];
```

- [ ] **Step 2: Type-check**

Run (from `aster/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification**

With the backend running (`npm run dev` in `Server/`) and the frontend running
(`npm run dev` in `aster/`):

1. Log in as the seeded ADMIN in the browser.
2. Confirm "Hospitals" and "Agencies" appear as new sidebar links.
3. Visit `/dashboard/hospitals`: add a hospital, edit it, confirm the table updates,
   delete it, confirm it disappears.
4. Visit `/dashboard/agencies`: same pass, plus try creating two agencies with the
   same name and confirm the second attempt shows a "Agency name already exists"
   toast.
5. Create a hospital, then attempt to delete it after (in a later plan, once
   inquiries exist) — not testable yet in this plan since `HospitalInquiry` creation
   doesn't exist until the Cases module lands; skip this specific check for now and
   note it as a follow-up manual check once Task-equivalent work in the next plan is
   done.
6. Log out, log in as a non-admin test user without `MANAGE_HOSPITALS`/
   `MANAGE_AGENCIES` (reuse one from the RBAC feature's manual testing if one exists),
   and confirm neither sidebar link appears and direct navigation to
   `/dashboard/hospitals` redirects to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add aster/components/Layout/Sidebar.tsx
git commit -m "Add Hospitals and Agencies links to the sidebar"
```

## Self-Review

**Spec coverage:** Every part of the design spec's Section 1 ("Hospitals & Agencies
catalogs") and the corresponding "API surface"/"File structure" entries for Hospitals
and Agencies are implemented: full CRUD for both, permission gating matching the
spec exactly (`RequireAnyPermission` for GET, `RequirePermission` for mutations), the
friendly `_count`-based delete guards, and the Agency uniqueness check. Case/Patient/
Attendant/inquiry work is correctly left out — that's the next plan.

**Placeholder scan:** No TBD/TODO markers; every step has literal, complete code.

**Type consistency:** `Hospital`/`Agency` type shapes match the Prisma `_count`
selections used in the services exactly (`_count: { inquiries: number }` /
`_count: { cases: number }`). Service function names/signatures
(`listHospitals`, `createHospital(payload)`, `updateHospital(id, payload)`,
`deleteHospital(id)` and the Agency equivalents) are consistent between Task 1's
backend and Task 2's frontend service wrappers, and match what the next plan (Cases
module) will import.
