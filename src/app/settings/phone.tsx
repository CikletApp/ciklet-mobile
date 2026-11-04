import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useCurrentProfile } from "@/api/hooks";
import { Button, Icon, Screen, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Ayarlar › Hesap › Telefon doğrulama (web `settings/phone-verify-modal.tsx`).
 * Doğrulanmışsa maskeli numara + "Bağlantıyı kaldır"; değilse Telegram
 * bağlantısı (tek kullanımlık, 15 dk) ve doğrulanana kadar profil yoklaması.
 * Kayıt akışındaki kapıdan (`(auth)/verify-phone`) farklı olarak oturum tam;
 * doğrulama bitince ekran kendiliğinden güncellenir.
 */

const POLL_INTERVAL_MS = 3_000;
const STEPS = [
  "Aşağıdaki düğmeyle Telegram'ı aç.",
  "Sohbeti başlat ve numaranı paylaşmayı onayla.",
  "Doğrulama tamamlanınca bu pencere kendiliğinden güncellenir.",
];
const PHONE_TELEGRAM = "/api/phone/telegram";

async function openTelegram(url: string) {
  const match = /^https:\/\/t\.me\/(\w+)\?start=([\w-]+)$/.exec(url);
  if (match) {
    try {
      await Linking.openURL(`tg://resolve?domain=${match[1]}&start=${match[2]}`);
      return;
    } catch {
      /* Telegram yüklü değil — web bağlantısı. */
    }
  }
  await Linking.openURL(url);
}

export default function PhoneSettingsScreen() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const verified = Boolean(profile?.isPhoneVerified);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: qk.currentProfile }), [queryClient]);

  // Doğrulandı bildirimi: yoklama sırasında false → true geçişinde bir kez.
  const wasVerified = useRef(verified);
  useEffect(() => {
    if (verified && !wasVerified.current && link) showToast("Numaran doğrulandı.");
    wasVerified.current = verified;
  }, [verified, link]);

  const requestLink = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ url: string; expiresAt: string }>(endpoints.phoneTelegramStart, { method: "POST" });
      const next = { url: data.url, expiresAt: Date.parse(data.expiresAt) };
      setLink(next);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) void refresh();
      else setError(err instanceof ApiError && err.message ? err.message : "Bağlantı alınamadı.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  // Bağlantı istendiyse doğrulanana kadar profil yoklanır; Telegram'dan dönünce hemen bakılır.
  useEffect(() => {
    if (verified || !link) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [verified, link, refresh]);

  const onVerify = async () => {
    let current = link;
    if (!current || Date.now() >= current.expiresAt) current = await requestLink();
    if (!current) return;
    try {
      await openTelegram(current.url);
    } catch {
      setError("Telegram açılamadı.");
    }
  };

  const onUnlink = async () => {
    setUnlinking(true);
    setError(null);
    try {
      await api(PHONE_TELEGRAM, { method: "DELETE" });
      await refresh();
      setLink(null);
      showToast("Numara bağlantısı kaldırıldı.");
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : "Bir şeyler ters gitti.");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Telefon doğrulama" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.body, color: colors.muted }}>
          {verified ? "Telefon numaran başarıyla doğrulandı." : "Hesabının güvenliğini artırmak için telefon numaranı doğrula."}
        </Text>

        {verified ? (
          <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
                <Icon name="shield" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.success }}>Doğrulandı</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>{profile?.phoneMasked ?? "Numaran kayıtlı"}</Text>
              </View>
            </View>
            <Button
              label={unlinking ? "Kaldırılıyor..." : "Bağlantıyı kaldır"}
              variant="secondary"
              onPress={() => void onUnlink()}
              loading={unlinking}
              fullWidth
            />
          </View>
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
            {STEPS.map((step, index) => (
              <View key={step} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
                <View style={{ width: 22, height: 22, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
                  <Text style={{ fontSize: 12, ...fw(700), color: colors.brand }}>{index + 1}</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{step}</Text>
              </View>
            ))}
            <Button label="Telegram'da doğrula" icon="phone" onPress={() => void onVerify()} loading={loading} fullWidth />
            {link ? (
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>Doğrulama bekleniyor...</Text>
            ) : null}
          </View>
        )}

        {error ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
            {!verified ? <Button label="Yeniden dene" variant="secondary" onPress={() => void requestLink()} fullWidth /> : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
