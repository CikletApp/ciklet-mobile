import { create } from "zustand";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import type { PresenceEntry, RichPresence } from "@/api/types";
import { visibleActivity, type RecognizedSet } from "@/lib/recognized-games";

/**
 * Presence deposu — soket-güdümlü, sunucudan gelen tek doğruluk kaynağı.
 *
 * TanStack Query'de tutulmaz: bu veri istekle değil yayınla gelir, sık
 * değişir ve önbelleğe alınması anlamsızdır.
 *
 * Etkinlikler HAM tutulur; Ciklet'in tanımadığı oyun/program
 * (lib/recognized-games) seçicide süzülür — tanınan küme sonradan gelince
 * önceden alınmış etkinlikler de görünür. Bileşenler etkinliği
 * {@link usePresence} ile ya da `entries` okuyorsa {@link useRecognizedGames}
 * + `visibleActivity` ile okumalı.
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
  /**
   * Tanınan oyun/program ad anahtarları (`GET /api/games/recognized`,
   * realtime/recognized-games). Yüklenene dek null: oyun kovası gizli.
   */
  recognized: RecognizedSet | null;
  /**
   * Yoksaydığın kişiler (Discord "Ignore"): etkinlikleri sana çizilmez.
   * Ham etkinlik saklanır; yoksayma kalkınca geri görünür. Kaynak
   * profil kayıtları (api/hooks/use-annotations → useSyncIgnoredPresence).
   */
  hidden: ReadonlySet<string>;
  setHidden: (ids: ReadonlySet<string>) => void;

  /** `statuses` sunucudan DİZİ olarak gelir — bkz. realtime/events.ts. */
  applyBatch: (
    statuses: { userId: string; status: PresenceStatus }[],
    activities: Record<string, RichPresence>
  ) => void;
  setStatus: (userId: string, status: PresenceStatus) => void;
  setActivity: (userId: string, activity: RichPresence | null) => void;
  setSelfStatus: (status: PresenceStatus, manual?: PresenceStatus) => void;
  setRecognized: (keys: RecognizedSet) => void;
  reset: () => void;
}

const EMPTY: PresenceEntry = { status: PresenceStatus.OFFLINE, activity: null };

export const usePresenceStore = create<PresenceState>((set) => ({
  entries: {},
  selfStatus: PresenceStatus.ONLINE,
  selfManual: PresenceStatus.ONLINE,
  selfKnown: false,
  recognized: null,

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

  setRecognized: (recognized) => set({ recognized }),

  hidden: new Set(),
  setHidden: (hidden) => set({ hidden }),

  reset: () =>
    set({
      entries: {},
      selfStatus: PresenceStatus.ONLINE,
      selfManual: PresenceStatus.ONLINE,
      selfKnown: false,
      recognized: null,
    }),
}));

/**
 * Tek kullanıcı seçicisi. Bileşenler `usePresenceStore(s => s.entries)`
 * kullanmamalı — o, HERHANGİ bir kullanıcının durumu değiştiğinde tüm
 * listeyi yeniden render eder.
 */
export function usePresence(userId: string | undefined): PresenceEntry {
  const entry = usePresenceStore((state) =>
    userId ? (state.entries[userId] ?? EMPTY) : EMPTY
  );
  const recognized = usePresenceStore((state) => state.recognized);
  const hidden = usePresenceStore((state) => (userId ? state.hidden.has(userId) : false));
  // Ciklet'in tanımadığı oyun/program görünmez (lib/recognized-games);
  // yoksaydığın kişinin etkinliği hiç görünmez.
  const activity = hidden ? null : visibleActivity(entry.activity, recognized);
  return activity === entry.activity ? entry : { ...entry, activity };
}

/** Tanınan oyun kümesi — `entries`'i doğrudan okuyan listeler etkinliği bununla süzer. */
export function useRecognizedGames(): RecognizedSet | null {
  return usePresenceStore((state) => state.recognized);
}

export function usePresenceStatus(userId: string | undefined): PresenceStatus {
  return usePresenceStore((state) =>
    userId ? (state.entries[userId]?.status ?? PresenceStatus.OFFLINE) : PresenceStatus.OFFLINE
  );
}
