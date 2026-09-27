import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button, Icon, showToast } from "@/components/ui";
import { formatDate, formatTime, isSameDay } from "@/lib/format";
import { showRewardedAd } from "@/lib/rewarded-ads";
import { useAuth } from "@/stores/auth";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "Reklam izle, Plus kazan" — Mentol almayan kullanıcı için isteğe bağlı.
 *
 * Süre, günlük hak ve reklam birimi SUNUCUDAN gelir (root paneli); satışları
 * korumak için gelire göre ayarlanabilsin diye uygulamaya gömülmedi. Uç yoksa
 * (sunucu henüz güncellenmedi) kart hiç görünmez.
 *
 * Sözleşme (ciklet-web-65, 2026-09-27): `reason` varsa `enabled` false;
 * öncelik disabled > mentol > limit. "Günlük" hak takvim günü DEĞİL, kayan
 * 24 saat; `nextAvailableAt` penceredeki en eski ödülün düştüğü an. Yeni ödül
 * kalan sürenin üstüne eklenir, bu yüzden ödül açıkken de izlenebilir.
 */

interface RewardedStatus {
  enabled: boolean;
  reason?: "mentol" | "disabled" | "limit";
  rewardPlan: "PLUS";
  rewardMinutes: number;
  dailyLimit: number;
  remainingToday: number;
  activeUntil: string | null;
  nextAvailableAt: string | null;
  adUnitIds: { android: string | null; ios: string | null };
}

/** Ödülün sunucuya düşmesi için beklenen en uzun süre (SSV birkaç saniye sürebilir). */
const CONFIRM_TIMEOUT_MS = 15_000;
const CONFIRM_INTERVAL_MS = 1_500;

const REWARDED_KEY = ["rewarded-ads"] as const;

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} dakika`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} saat` : `${hours.toFixed(1).replace(".", ",")} saat`;
}

function isFuture(iso: string | null): iso is string {
  return Boolean(iso && Date.parse(iso) > Date.now());
}

/** "14:30" bugünse, değilse "28 Eylül 2026 14:30" (kayan pencere ertesi güne taşabilir). */
function whenLabel(iso: string): string {
  const time = formatTime(iso);
  return isSameDay(new Date(iso), new Date()) ? time : `${formatDate(iso)} ${time}`;
}

export function RewardedCard() {
  const queryClient = useQueryClient();
  const userId = useAuth((s) => s.profile?.id);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: REWARDED_KEY,
    queryFn: async () => {
      try {
        return await api<RewardedStatus>(endpoints.rewardedAds);
      } catch (err) {
        // Sunucu henüz bu özelliği bilmiyor: kartı gizle, hata gösterme.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const data = status.data;
  if (!data || !userId || data.reason === "mentol" || data.reason === "disabled") return null;

  const duration = durationLabel(data.rewardMinutes);
  const active = isFuture(data.activeUntil);

  /** Ödül SSV ile sunucuya düşene kadar yokla; plan kartı da tazelensin. */
  const confirmReward = async (): Promise<boolean> => {
    const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_INTERVAL_MS));
      const fresh = await api<RewardedStatus>(endpoints.rewardedAds).catch(() => null);
      if (fresh && isFuture(fresh.activeUntil) && fresh.activeUntil !== data.activeUntil) {
        queryClient.setQueryData(REWARDED_KEY, fresh);
        return true;
      }
    }
    return false;
  };

  const watch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const session = await api<{ nonce: string }>(endpoints.rewardedAdsSession, { method: "POST" });
      const adUnitId = Platform.OS === "ios" ? data.adUnitIds.ios : data.adUnitIds.android;
      const outcome = await showRewardedAd({ adUnitId, userId, customData: session.nonce });

      if (outcome === "unavailable") {
        showToast("Şu an gösterilecek reklam yok. Biraz sonra tekrar dene.", "error");
      } else if (outcome === "earned") {
        const confirmed = await confirmReward();
        showToast(
          confirmed
            ? `${duration} Mentol Plus açıldı`
            : "Ödülün işleniyor; birkaç dakika içinde açılacak."
        );
      }
    } catch (err) {
      showToast(err instanceof ApiError && err.message ? err.message : "Reklam başlatılamadı.", "error");
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: REWARDED_KEY });
      void queryClient.invalidateQueries({ queryKey: ["mentol-plan"] });
    }
  };

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        gap: spacing.md,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: authBrand.limeBorder,
        backgroundColor: colors.panel,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: authBrand.limeSoft,
          }}
        >
          <Icon name="play" size={18} color={authBrand.lime} filled />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Reklam izle, {duration} Plus kazan</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {data.reason === "limit"
              ? `${active ? `Ödülün ${whenLabel(data.activeUntil!)} saatine kadar açık. ` : ""}${
                  isFuture(data.nextAvailableAt)
                    ? `Ödül hakkını kullandın; ${whenLabel(data.nextAvailableAt)} sonrasında yeniden izleyebilirsin.`
                    : "Ödül hakkını kullandın."
                }`
              : active
                ? `Ödülün ${whenLabel(data.activeUntil!)} saatine kadar açık. Bir reklam daha izlersen süre ${duration} uzar.`
                : `Kısa bir reklamdan sonra Mentol Plus ${duration} boyunca açılır. Kalan hak: ${data.remainingToday}.`}
          </Text>
        </View>
      </View>
      {data.enabled ? (
        <Button label="Reklam izle" variant="lime" fullWidth onPress={watch} loading={busy} />
      ) : null}
    </View>
  );
}
