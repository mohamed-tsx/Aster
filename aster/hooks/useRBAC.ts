import { useAuthStore } from "@/stores/auth-store";

/**
 * Simple role-based access control hook
 * Uses single role field like backend
 */
export const useRBAC = () => {
    const { user } = useAuthStore();

    /**
     * Check if the user has a specific role
     */
    const hasRole = (role: string) => {
        if (!user || !user.role) return false;
        return user.role.name === role;
    };

    /**
     * Check if the user has any of the specified roles
     */
    const hasAnyRole = (roles: string[]) => {
        if (!user || !user.role) return false;
        return roles.includes(user.role.name);
    };

    /**
     * Check if user is admin (ADMIN or CRD_STAFF)
     */
    const isAdmin = () => {
        if (!user || !user.role) return false;
        return user.role.name === "ADMIN" || user.role.name === "CRD_STAFF";
    };

    /**
     * Check if user is unit coordinator
     */
    const isUnitCoordinator = () => {
        if (!user || !user.role) return false;
        return user.role.name === "UNIT_COORDINATOR";
    };

    /**
     * Check if user is researcher
     */
    const isResearcher = () => {
        if (!user || !user.role) return false;
        return user.role.name === "RESEARCHER";
    };

    return {
        hasRole,
        hasAnyRole,
        isAdmin,
        isUnitCoordinator,
        isResearcher,
        user,
        role: user?.role?.name || null,
    };
};
