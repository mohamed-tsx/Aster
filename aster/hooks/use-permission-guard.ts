"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRBAC } from "@/hooks/useRBAC";

/**
 * Hard-blocks a page for users missing `permission` — redirects to
 * /dashboard. Returns whether the caller should render its real content.
 */
export function usePermissionGuard(permission: string): boolean {
  const router = useRouter();
  const { hasPermission, user } = useRBAC();
  const allowed = !user || hasPermission(permission);

  useEffect(() => {
    if (user && !hasPermission(permission)) {
      router.replace("/dashboard");
    }
  }, [user, permission, hasPermission, router]);

  return allowed;
}
