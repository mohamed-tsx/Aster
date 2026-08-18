# RBAC Management Design

## Overview

Two changes, bundled because the second depends on the first:

1. **Sidebar:** "Users" becomes a dropdown with "All Users" and "Add New User".
2. **RBAC management module:** a new `/dashboard/roles` screen for managing `Role`s and `Permission`s, backed by new API endpoints, with strict guardrails on both ends. This also fixes a real gap found while investigating: the frontend never receives the current user's permission list at all (login/`/auth/me` only fetch `role: true`, no `permissions`), so today's `useRBAC.ts` fakes it with hardcoded role-name string checks instead of checking real permissions.

## Current state (for reference)

`Server/prisma/schema.prisma` already has the shape needed — no migration required:

```prisma
model User {
  id, username, email, password, firstName, lastName, avatar
  roleId, role
}
model Role {
  id, name
  users, permissions   // many-to-many with Permission
}
model Permission {
  id, name
  roles                 // many-to-many with Role
}
```

`Server/Src/Middlewares/Auth/Verify.js` already attaches `req.user.role.permissions` (full permission objects) on every request. `RequirePermission(name)` (`Server/Src/Middlewares/Auth/RequirePermission.js`) already checks membership in that array. This machinery is solid — it's just never been given a management API, and the frontend never asked for the data.

Seeded today (`Server/cmd/Seed/adminSeed.js`): one role `ADMIN` holding `VIEW_USERS`, `CREATE_USERS`, `UPDATE_USERS`, `DELETE_USERS`.

## Discovered issue: role-assignment escalation hole

While designing the self-escalation guardrail for role management, I found the same hole already exists in `usersService.js`: `createUser`/`updateUser` accept an arbitrary `roleId` and call `resolveRole` with **no check that the requester is allowed to hand out that role**. Today, anyone holding `CREATE_USERS` or `UPDATE_USERS` (not necessarily an admin) can set any user's `roleId` to the `ADMIN` role's id and silently create a second admin. This spec closes that hole using the same mechanism as the roles-management escalation guard (see "Shared escalation guard" below), since it's the same class of bug the user explicitly asked to prevent.

## Backend

### New permission

`MANAGE_ROLES` — added to `adminSeed.js`'s permission list, granted to `ADMIN` like the existing four. Gates all role/permission-catalog mutations.

### Shared escalation guard

New `Server/Src/Utils/Rbac/assertNoSelfEscalation.js`:

```js
import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../ErrorHandler/errorHandler.js";

export const ADMIN_ROLE_NAME = "ADMIN";

/**
 * Rejects if requestingUser is granting permissions they don't hold themselves.
 * ADMIN is exempt — without a superuser bypass, a brand-new permission could
 * never be assigned to anyone, since nobody would hold it yet to "pass on".
 */
export async function assertNoSelfEscalation(permissionIds, requestingUser) {
  if (requestingUser?.role?.name === ADMIN_ROLE_NAME) return;
  if (!permissionIds || permissionIds.length === 0) return;

  const own = new Set((requestingUser?.role?.permissions ?? []).map((p) => p.name));
  const requested = await Prisma.permission.findMany({ where: { id: { in: permissionIds } } });
  const notOwned = requested.filter((p) => !own.has(p.name));

  if (notOwned.length > 0) {
    throw new AppError(
      `You cannot grant permissions you do not have: ${notOwned.map((p) => p.name).join(", ")}`,
      403,
      "FORBIDDEN",
    );
  }
}
```

Used by:
- `rolesService.createRole` / `updateRole` — with the `permissionIds` being assigned to the role.
- `usersService.createUser` / `updateUser` — with the **target role's own permission ids** (`resolvedRole.permissions.map(p => p.id)`), whenever a `roleId`/`role` is supplied. This requires `resolveRole` to `include: { permissions: true }`, and `createUser`/`updateUser` to receive the requesting user (controllers already have `req.user`; `deleteUser` already threads `requestingUserId` today, so this follows the existing pattern).

### `Server/Src/Middlewares/Auth/RequireAnyPermission.js` (new)

Same shape as `RequirePermission` but passes if the user holds **any** of a list — needed because the role picker (for assigning a user's role) must be readable by anyone who can create/edit users, not just RBAC admins:

```js
const RequireAnyPermission = (permissionNames) => (req, res, next) => {
  const permissions = req.user?.role?.permissions ?? [];
  const hasAny = permissions.some((p) => permissionNames.includes(p.name));
  if (!hasAny) {
    throw new AppError("You do not have permission to perform this action", 403, "FORBIDDEN");
  }
  next();
};
export default RequireAnyPermission;
```

### Roles: `Server/Src/{Routes,Controllers,Services}/Roles`

Route (`rolesRoute.js`), mounted at `/api/v1/roles` in `Server.js`:
```js
router.use(Verify);
router.get("/", RequireAnyPermission(["VIEW_USERS", "CREATE_USERS", "UPDATE_USERS", "MANAGE_ROLES"]), listRolesCtrl);
router.post("/", RequirePermission("MANAGE_ROLES"), createRoleCtrl);
router.put("/:id", RequirePermission("MANAGE_ROLES"), updateRoleCtrl);
router.delete("/:id", RequirePermission("MANAGE_ROLES"), deleteRoleCtrl);
```

Service (`rolesService.js`) — key behaviors:
- `listRoles()`: `Prisma.role.findMany({ include: { permissions: true, _count: { select: { users: true } } }, orderBy: { name: "asc" } })`.
- `createRole({ name, permissionIds }, requestingUser)`: validates non-empty unique `name`, calls `assertNoSelfEscalation(permissionIds, requestingUser)`, creates with `permissions: { connect: permissionIds.map(id => ({id})) } }`.
- `updateRole(id, { name?, permissionIds? }, requestingUser)`:
  - Renaming the role named `ADMIN` → 400 `"The ADMIN role cannot be renamed"`.
  - Changing `permissionIds` on the `ADMIN` role → 400 if the `MANAGE_ROLES` permission id is not included (`"The ADMIN role must always keep MANAGE_ROLES"`).
  - Otherwise: uniqueness check on rename, `assertNoSelfEscalation` on the new `permissionIds`, then `permissions: { set: permissionIds.map(id => ({id})) } }` (replace, not merge).
- `deleteRole(id)`:
  - Role named `ADMIN` → 400 `"The ADMIN role cannot be deleted"`.
  - `_count.users > 0` → 409 `"Cannot delete role: N user(s) are still assigned to it. Reassign them first."`
  - Else `Prisma.role.delete`.

Response envelope matches the existing `usersController` convention: `sendSuccess(res, "...", { roles })` / single `Role` object for create/update.

### Permissions: `Server/Src/{Routes,Controllers,Services}/Permissions`

Route mounted at `/api/v1/permissions`, all four verbs behind `RequirePermission("MANAGE_ROLES")` (the catalog itself is only useful to someone building roles).

Service (`permissionsService.js`):
- `listPermissions()`: `Prisma.permission.findMany({ include: { _count: { select: { roles: true } } }, orderBy: { name: "asc" } })`.
- `createPermission({ name })`: normalizes to `UPPER_SNAKE_CASE` (`name.trim().toUpperCase().replace(/\s+/g, "_")`), rejects duplicates.
- `updatePermission(id, { name })`: same normalization; rejects if the permission is `MANAGE_ROLES` (`"MANAGE_ROLES cannot be renamed"` — system-protected, same tier as the `ADMIN` role).
- `deletePermission(id)`: rejects if the permission is `MANAGE_ROLES` (`"MANAGE_ROLES is a system permission and cannot be deleted"`). Otherwise deletes — Prisma automatically drops the join rows from any roles holding it; no explicit disconnect needed.

### Auth fix

`Server/Src/Services/Auth/authService.js`:
- `loginUser`: `include: { role: true }` → `include: { role: { include: { permissions: true } } }`.
- `refreshAccessToken`: same change to its `role` select.
- `getCurrentUser`: `role: true` → `role: { include: { permissions: true } }`.

This is the fix that makes frontend permission-based gating possible at all — today the browser has no idea what the logged-in user can do.

### Seed

`adminSeed.js`: add `"MANAGE_ROLES"` to `userManagementPermissions`. No other change — the rest of the seed already upserts every listed permission and connects them all to `ADMIN`.

## Frontend

### Types & data

- `aster/types/role.ts` (new): mirrors the backend shape directly (same pattern as `AdminUser`):
  ```ts
  export type Permission = { id: string; name: string; _count: { roles: number }; createdAt: string; updatedAt: string };
  export type Role = { id: string; name: string; permissions: { id: string; name: string }[]; _count: { users: number }; createdAt: string; updatedAt: string };
  ```
- `aster/services/roles.ts`, `aster/services/permissions.ts` (new): thin wrappers, same `unwrap`/`ApiSuccess` pattern as `services/users.ts` — `listRoles`, `createRole`, `updateRole`, `deleteRole`; `listPermissions`, `createPermission`, `updatePermission`, `deletePermission`.
- `aster/lib/validations/role.ts` (new): `roleSchema { name, permissionIds: string[] }`, `permissionSchema { name }` (zod).
- `aster/stores/auth-store.ts`: `Role` interface gains `permissions: { id: string; name: string }[]`.

### `useRBAC.ts` rewrite

Replaces the hardcoded role-name checks (`isAdmin`/`isUnitCoordinator`/`isResearcher` — unused anywhere else in the app, confirmed by grep, safe to drop) with real permission checks:

```ts
export const useRBAC = () => {
  const { user } = useAuthStore();
  const permissionNames = user?.role?.permissions?.map((p) => p.name) ?? [];
  const hasPermission = (permission: string) => permissionNames.includes(permission);
  const hasAnyPermission = (permissions: string[]) => permissions.some((p) => permissionNames.includes(p));
  const hasRole = (role: string) => user?.role?.name === role;
  return { hasPermission, hasAnyPermission, hasRole, permissions: permissionNames, role: user?.role?.name ?? null, user };
};
```

### Route guard

`aster/hooks/use-permission-guard.ts` (new) — used by the three pages that need to hard-block access, not just hide a button:

```ts
export function usePermissionGuard(permission: string) {
  const router = useRouter();
  const { hasPermission, user } = useRBAC();
  const allowed = !user || hasPermission(permission);
  useEffect(() => {
    if (user && !hasPermission(permission)) router.replace("/dashboard");
  }, [user, permission, hasPermission, router]);
  return allowed;
}
```
Applied in `/dashboard/roles` (`MANAGE_ROLES`), `/dashboard/users/new` (`CREATE_USERS`), `/dashboard/users/[id]/edit` (`UPDATE_USERS`).

### Sidebar (`components/Layout/Sidebar.tsx`)

`NavigationItem` gains an optional `permission?: string` (checked on the item itself, and independently on each child). New nav shape:
```ts
{ name: "Users", href: "/dashboard/users", icon: Users, children: [
    { name: "All Users", href: "/dashboard/users", icon: List, permission: "VIEW_USERS" },
    { name: "Add New User", href: "/dashboard/users/new", icon: UserPlus, permission: "CREATE_USERS" },
] },
{ name: "Roles & Permissions", href: "/dashboard/roles", icon: ShieldCheck, children: null, permission: "MANAGE_ROLES" },
```
Filtering replaces the current (dead) `item.roles`/`hasAnyRole` block with permission-based filtering: children are filtered by their own `permission`; a parent with children is dropped if none survive; a childless parent is dropped if its own `permission` fails. This is a real behavior change from today's Sidebar (which shows everything unconditionally) — deliberate, since "Users" already renders as a plain link today and the ask is to gate it.

### `/dashboard/roles` page (new)

`aster/app/dashboard/roles/page.tsx` — guarded by `usePermissionGuard("MANAGE_ROLES")`, renders a `Tabs` (`components/ui/tabs.tsx`) with two panels:
- **Roles** (`components/roles/roles-tab.tsx`): table (name, permission count badges, user count, actions). "Add role" opens `role-form-dialog.tsx` (name input + checkbox list of all permissions, from `listPermissions()`). Edit reuses the same dialog pre-filled. Delete uses the existing `DeleteConfirmationDialog` pattern; a role with `_count.users > 0` shows a disabled delete with a tooltip explaining why (backend would 409 anyway — this just avoids a round trip).
- **Permissions** (`components/roles/permissions-tab.tsx`): simple table (name, role count, actions), `permission-form-dialog.tsx` (single name input) for add/rename, `DeleteConfirmationDialog` for delete. The `MANAGE_ROLES` row's delete/rename actions are disabled client-side (backend also rejects — belt and suspenders).

One page with tabs rather than separate routes, since roles and permissions are edited together in practice.

### User forms: role field becomes a real picker

Last session's `user-form-fields.tsx` used a plain text input for role (no roles endpoint existed yet). Now that one exists:
- `lib/validations/user.ts`: form field renamed `role` → `roleId` (`z.string().min(1, "Role is required")`).
- `types/user.ts`: `CreateUserPayload.role` / `UpdateUserPayload.role` → `roleId` (matches `resolveRole(roleId, role)` on the backend, which already accepts either).
- `user-form-fields.tsx`: role becomes a `<Select>` bound to `roleId`, options from a new `roles: Role[]` prop.
- `create-user-form.tsx` / `edit-user-form.tsx`: fetch `listRoles()` on mount, pass down. `edit-user-form.tsx`'s `mapUserToForm` sets `roleId: user.role.id`.
- **Grantable-roles filtering, not a blanket lock:** an earlier draft of this spec gated the whole `<Select>` behind `hasPermission("MANAGE_ROLES")` — wrong, since that would leave a plain `CREATE_USERS`-only user unable to pick *any* role and thus unable to create a user at all, defeating their permission. Corrected rule, mirroring the backend's `assertNoSelfEscalation` client-side for UX (the backend check is still the real enforcement):
  ```ts
  const canGrantRole = (role: Role) =>
    hasRole("ADMIN") || role.permissions.every((p) => permissions.includes(p.name));
  ```
  - **Create:** dropdown options = `roles.filter(canGrantRole)`. If empty (edge case — e.g. a brand-new permission not yet on the requester's own role), show "No roles available to assign" instead of an empty select.
  - **Edit:** dropdown options = `roles.filter(canGrantRole)`, with the user's *current* role always included even if not independently grantable (so opening the form never implicitly proposes changing it). Selecting a different, non-grantable role is simply not offered as an option.

### Action-level gating on existing users pages

- `/dashboard/users/page.tsx`: "Add user" button wrapped in `hasPermission("CREATE_USERS")`.
- `components/users/users-table.tsx`: "Edit" dropdown item requires `UPDATE_USERS`, "Delete" requires `DELETE_USERS` (checked via `useRBAC()` inside the component).
- `/dashboard/users/[id]/page.tsx`: Edit/Delete buttons gated the same way.

These are UX-only (hide what you can't do) — the backend's existing `RequirePermission` on the users routes is the actual enforcement.

## Testing / verification

No test framework exists in either project (checked `package.json` — no test script; no Jest/Vitest config). Verification is:
- Backend: manual `curl`/Postman pass against a running server — login as seeded `ADMIN`, exercise every new endpoint including the guardrail rejection paths (rename `ADMIN`, delete `ADMIN`, delete a role with users, grant a permission you don't own, delete `MANAGE_ROLES`).
- Frontend: `npx tsc --noEmit` clean (as done for the prior users-sync work), then a manual pass in the browser: sidebar dropdown renders, roles/permissions CRUD works, a non-admin test user (once one exists) sees a correctly restricted sidebar and locked role field.

## Out of scope

- No UI for creating additional test users with different roles as part of this work (existing create-user flow already covers it once the role picker lands).
- No audit log of RBAC changes (not requested; flagging as a natural follow-up if wanted later).
- No per-field permission granularity (e.g. "can edit email but not role") — permissions stay at the route/action level, matching the existing `RequirePermission` model.
