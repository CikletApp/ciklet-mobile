import { create } from "zustand";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import type { PresenceEntry, RichPresence } from "@/api/types";

/**
 * Presence deposu — soket-güdümlü, sunucudan gelen tek doğruluk kaynağı.
 *
 * TanStack Query'de tutulmaz: bu veri istekle değil yayınla gelir, sık
 * değişir ve önbelleğe alınması anlamsızdır.
 */
interface PresenceState {
  entries: Record<string, PresenceEntry>;
  /** Kendi görünür durumun — `INVISIBLE` yalnızca burada görünür. */
  selfStatus: PresenceStatus;

  /** `statuses` sunucudan DİZİ olarak gelir — bkz. realtime/events.ts. */
  applyBatch: (
    statuses: { userId: string; status: PresenceStatus }[],
    activities: Record<string, RichPresence>
  ) => void;
  setStatus: (userId: string, status: PresenceStatus) => void;
  setActivity: (userId: string, activity: RichPresence | null) => void;
  setSelfStatus: (status: PresenceStatus) => void;
  reset: () => void;
}

const EMPTY: PresenceEntry = { status: PresenceStatus.OFFLINE, activity: null };

export const usePresenceStore = create<PresenceState>((set) => ({
  entries: {},
  selfStatus: PresenceStatus.ONLINE,

  applyBatch: (statuses, activities) =>
    set((state) => {
      const entries = { ...state.entries };
      for (const { userId, status } of statuses) {
        if (!userId) continue;
        entries[userId] = { status, activity: activities[userId] ?? null };
      }
      // Toplu yayında olmayan ama ayrıca gelen aktiviteler de yazılır.
      for (const [userId, activity] of Object.entries(activities)) {
        const current = entries[userId];
        if (current) current.activity = activity;
      }
      return { entries };
    }),

  setStatus: (userId, status) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [userId]: { ...(state.entries[userId] ?? EMPTY), status },
      },
    })),

  setActivity: (userId, activity) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [userId]: { ...(state.entries[userId] ?? EMPTY), activity },
      },
    })),

  setSelfStatus: (selfStatus) => set({ selfStatus }),

  reset: () => set({ entries: {}, selfStatus: PresenceStatus.ONLINE }),
}));

/**
 * Tek kullanıcı seçicisi. Bileşenler `usePresenceStore(s => s.entries)`
 * kullanmamalı — o, HERHANGİ bir kullanıcının durumu değiştiğinde tüm
 * listeyi yeniden render eder.
 */
export function usePresence(userId: string | undefined): PresenceEntry {
  return usePresenceStore((state) =>
    userId ? (state.entries[userId] ?? EMPTY) : EMPTY
  );
}

export function usePresenceStatus(userId: string | undefined): PresenceStatus {
  return usePresenceStore((state) =>
    userId ? (state.entries[userId]?.status ?? PresenceStatus.OFFLINE) : PresenceStatus.OFFLINE
  );
}
