import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

/**
 * Authorization middleware factory — passes if the user holds ANY of the
 * given permissions. Must run after Verify (needs req.user.role.permissions).
 * @param {string[]} permissionNames
 */
const RequireAnyPermission = (permissionNames) => (req, res, next) => {
  const permissions = req.user?.role?.permissions ?? [];
  const hasAny = permissions.some((p) => permissionNames.includes(p.name));

  if (!hasAny) {
    throw new AppError(
      "You do not have permission to perform this action",
      403,
      "FORBIDDEN",
    );
  }

  next();
};

export default RequireAnyPermission;
