"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUserById } from "@/services/users";
import { getErrorMessage } from "@/utils/api";
import type { AdminUser } from "@/types/user";

export function useUserDetail(id: string) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getUserById(id);
        if (!cancelled) setUser(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "User could not be loaded"));
          router.push("/dashboard/users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return { user, setUser, loading };
}
