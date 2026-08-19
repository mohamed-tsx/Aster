import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../ErrorHandler/errorHandler.js";

export const ADMIN_ROLE_NAME = "ADMIN";

/**
 * Rejects if requestingUser is granting permissions they don't hold themselves.
 * ADMIN is exempt — without a superuser bypass, a brand-new permission could
 * never be assigned to anyone, since nobody would hold it yet to "pass on".
 * Also validates the shape of permissionIds and that every id actually exists,
 * so malformed/bogus input surfaces as a 400 instead of a Prisma 500.
 * @param {string[]} permissionIds
 * @param {{ role?: { name?: string, permissions?: {name: string}[] } }} requestingUser
 * @param {string} [action] - verb used in the error message ("grant" | "remove" | "delete")
 */
export async function assertNoSelfEscalation(
  permissionIds,
  requestingUser,
  action = "grant",
) {
  // `undefined` means "not supplied" (nothing to check). Anything else that
  // isn't an array of strings is malformed input and must be a clean 400
  // rather than a TypeError further down at the Prisma connect/set step.
  if (permissionIds !== undefined) {
    if (
      !Array.isArray(permissionIds) ||
      permissionIds.some((id) => typeof id !== "string")
    ) {
      throw new AppError(
        "permissionIds must be an array of permission ids",
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  if (!permissionIds || permissionIds.length === 0) return;

  // De-duplicate so the existence check compares like with like: findMany
  // returns one row per distinct id no matter how often it was requested.
  const uniqueIds = [...new Set(permissionIds)];

  const requested = await Prisma.permission.findMany({
    where: { id: { in: uniqueIds } },
  });

  if (requested.length !== uniqueIds.length) {
    throw new AppError(
      "One or more permission ids do not exist",
      400,
      "VALIDATION_ERROR",
    );
  }

  // Validation above runs for everyone; only the ownership check is bypassed
  // for ADMIN, so malformed input still gets a clean 400 rather than a 500.
  if (requestingUser?.role?.name === ADMIN_ROLE_NAME) return;

  const own = new Set(
    (requestingUser?.role?.permissions ?? []).map((p) => p.name),
  );
  const notOwned = requested.filter((p) => !own.has(p.name));

  if (notOwned.length > 0) {
    throw new AppError(
      `You cannot ${action} permissions you do not have: ${notOwned.map((p) => p.name).join(", ")}`,
      403,
      "FORBIDDEN",
    );
  }
}

/**
 * Rejects if requestingUser is trying to act on (update/delete) a user whose
 * role holds permissions the requester does not hold themselves. Mirrors the
 * escalation rule for granting roles: you may only manage a person whose role
 * you could have handed out yourself. ADMIN is exempt.
 * @param {{ role?: { permissions?: {name: string}[] } }} targetUser - loaded with role.permissions
 * @param {{ role?: { name?: string, permissions?: {name: string}[] } }} requestingUser
 */
export function assertCanManageUser(targetUser, requestingUser) {
  if (requestingUser?.role?.name === ADMIN_ROLE_NAME) return;

  const own = new Set(
    (requestingUser?.role?.permissions ?? []).map((p) => p.name),
  );
  const targetPermissions = targetUser?.role?.permissions ?? [];
  const notOwned = targetPermissions.filter((p) => !own.has(p.name));

  if (notOwned.length > 0) {
    throw new AppError(
      `You cannot manage a user whose role has permissions you do not have: ${notOwned.map((p) => p.name).join(", ")}`,
      403,
      "FORBIDDEN",
    );
  }
}
