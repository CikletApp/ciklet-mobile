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
  /**
   * Kendi ETKİN durumun — bütün cihazların özetinden (ör. hepsi boştaysa
   * IDLE). `INVISIBLE` yalnızca burada görünür. Kendi durum noktası bunu çizer.
   */
  selfStatus: PresenceStatus;
  /**
   * Elle SEÇTİĞİN durum — seçicideki ✓ bunu gösterir. Etkin durumdan ayrı:
   * otomatik boşta seni "Boşta" gösterir ama seçimin "Çevrimiçi" kalır
   * (Discord davranışı). Ağ geçidi `manual` göndermiyorsa etkinle aynı.
   */
  selfManual: PresenceStatus;
  /**
   * Ağ geçidinden `presence.self` geldi mi? Gelmeden önceki `selfStatus` /
   * `selfManual` yalnızca varsayılan (ONLINE); soğuk açılışta DND'deki
   * kullanıcıya bir an "Çevrimiçi ✓" göstermemek için seçici bunu bekler.
   */
  selfKnown: boolean;

  /** `statuses` sunucudan DİZİ olarak gelir — bkz. realtime/events.ts. */
  applyBatch: (
    statuses: { userId: string; status: PresenceStatus }[],
    activities: Record<string, RichPresence>
  ) => void;
  setStatus: (userId: string, status: PresenceStatus) => void;
  setActivity: (userId: string, activity: RichPresence | null) => void;
  setSelfStatus: (status: PresenceStatus, manual?: PresenceStatus) => void;
  reset: () => void;
}

const EMPTY: PresenceEntry = { status: PresenceStatus.OFFLINE, activity: null };

export const usePresenceStore = create<PresenceState>((set) => ({
  entries: {},
  selfStatus: PresenceStatus.ONLINE,
  selfManual: PresenceStatus.ONLINE,
  selfKnown: false,

  applyBatch: (statuses, activities) =>
    set((state) => {
      const entries = { ...state.entries };
      for (const { userId, status } of statuses) {
        if (!userId) continue;
        // Web istemcisi gibi batch'te activity alanı yoksa mevcut rich
        // presence'ı koru. Presence sync yalnız durum taşıdığında aktiviteyi
        // null'lamak, "Şimdi Aktif" kartının anlık aktiviteyi kaybetmesine
        // neden oluyordu.
        const hasActivity = Object.prototype.hasOwnProperty.call(activities, userId);
        entries[userId] = {
          status,
          activity: hasActivity
            ? activities[userId]
            : entries[userId]?.activity ?? null,
        };
      }
      // Toplu yayında olmayan ama ayrıca gelen aktiviteler de yazılır.
      for (const [userId, activity] of Object.entries(activities)) {
        const current = entries[userId];
        entries[userId] = current
          ? { ...current, activity }
          : { status: PresenceStatus.OFFLINE, activity };
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

  setSelfStatus: (selfStatus, manual) => set({ selfStatus, selfManual: manual ?? selfStatus, selfKnown: true }),

  reset: () => set({ entries: {}, selfStatus: PresenceStatus.ONLINE, selfManual: PresenceStatus.ONLINE, selfKnown: false }),
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
