import { useAuthStore } from "@/stores/auth-store";

/**
 * Permission-based access control — backed by the real permissions the
 * backend attaches to the logged-in user's role (see Verify.js / auth/me).
 */
export const useRBAC = () => {
  const { user } = useAuthStore();
  const permissionNames = user?.role?.permissions?.map((p) => p.name) ?? [];

  const hasPermission = (permission: string) => permissionNames.includes(permission);
  const hasAnyPermission = (permissions: string[]) =>
    permissions.some((p) => permissionNames.includes(p));
  const hasRole = (role: string) => user?.role?.name === role;

  return {
    hasPermission,
    hasAnyPermission,
    hasRole,
    permissions: permissionNames,
    role: user?.role?.name ?? null,
    user,
  };
};
