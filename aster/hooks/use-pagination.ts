"use client";

import { useCallback, useState } from "react";

export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);

  const setLimit = useCallback((next: number) => {
    setLimitState(next);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  return { page, limit, setPage, setLimit, resetPage };
}
