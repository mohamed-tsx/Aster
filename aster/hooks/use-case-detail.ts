"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCaseById } from "@/services/cases";
import { getErrorMessage } from "@/utils/api";
import type { Case } from "@/types/case";

export function useCaseDetail(id: string) {
  const router = useRouter();
  const [kase, setKase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    if (!id) return;
    setLoading(true);
    getCaseById(id)
      .then((data) => setKase(data))
      .catch((error) => {
        toast.error(getErrorMessage(error, "Case could not be loaded"));
        router.push("/dashboard/cases");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getCaseById(id);
        if (!cancelled) setKase(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Case could not be loaded"));
          router.push("/dashboard/cases");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { case: kase, setCase: setKase, loading, refetch };
}
