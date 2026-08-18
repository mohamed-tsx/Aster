import Prisma from "../../Config/Prisma/db.js";
import { AppError } from "../ErrorHandler/errorHandler.js";

export const ADMIN_ROLE_NAME = "ADMIN";

/**
 * Rejects if requestingUser is granting permissions they don't hold themselves.
 * ADMIN is exempt — without a superuser bypass, a brand-new permission could
 * never be assigned to anyone, since nobody would hold it yet to "pass on".
 * @param {string[]} permissionIds
 * @param {{ role?: { name?: string, permissions?: {name: string}[] } }} requestingUser
 */
export async function assertNoSelfEscalation(permissionIds, requestingUser) {
  if (requestingUser?.role?.name === ADMIN_ROLE_NAME) return;
  if (!permissionIds || permissionIds.length === 0) return;

  const own = new Set(
    (requestingUser?.role?.permissions ?? []).map((p) => p.name),
  );
  const requested = await Prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });
  const notOwned = requested.filter((p) => !own.has(p.name));

  if (notOwned.length > 0) {
    throw new AppError(
      `You cannot grant permissions you do not have: ${notOwned.map((p) => p.name).join(", ")}`,
      403,
      "FORBIDDEN",
    );
  }
}
