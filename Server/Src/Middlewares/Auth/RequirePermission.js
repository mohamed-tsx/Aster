import { AppError } from "../../Utils/ErrorHandler/errorHandler.js";

/**
 * Authorization middleware factory.
 * Must run after Verify (needs req.user.role.permissions).
 * @param {string} permissionName - Permission required, e.g. "VIEW_USERS"
 */
const RequirePermission = (permissionName) => (req, res, next) => {
  const permissions = req.user?.role?.permissions ?? [];
  const hasPermission = permissions.some((p) => p.name === permissionName);

  if (!hasPermission) {
    throw new AppError(
      "You do not have permission to perform this action",
      403,
      "FORBIDDEN",
    );
  }

  next();
};

export default RequirePermission;
