import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { CallHistoryPage } from "../types";

/**
 * Arama geçmişi (ciklet-web `GET /api/calls/history`). Sunucu satırı
 * bakanın gözünden sınıflandırıp gönderiyor (gelen / giden / cevapsız /
 * reddedilen); mobil yalnızca çizer.
 */
export function useCallHistory() {
  return useInfiniteQuery({
    queryKey: qk.callHistory,
    initialPageParam: "",
    queryFn: ({ pageParam }) => api<CallHistoryPage>(endpoints.callsHistory(pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}
