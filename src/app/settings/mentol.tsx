import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useCheckout, useMentolPlan } from "@/api/hooks";
import { Button, Pressable, Screen, SectionHeader, TextField, showDialog } from "@/components/ui";
import { RewardedCard } from "@/features/mentol/rewarded-card";
import { formatTime } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

export default function MentolSettingsScreen() {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const plan = useMentolPlan();
  const redeem = useMutation({
    mutationFn: () => api<{ plan: string; expiresAt: string | null }>(endpoints.mentolRedeem, { method: "POST", body: { code } }),
    onSuccess: () => { setCode(""); void queryClient.invalidateQueries({ queryKey: ["mentol-plan"] }); showDialog("Mentol etkin", "Kod hesabına uygulandı."); },
    onError: (error) => showDialog("Kod kullanılamadı", error instanceof ApiError ? error.message : "Tekrar dene."),
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: "Mentol" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="MEVCUT PLANIN" />
        <View style={{ marginHorizontal: spacing.lg, padding: spacing.xl, gap: spacing.sm, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, borderWidth: 1, borderColor: plan.data?.plan === "FREE" ? colors.border : colors.brand }}>
          <Text style={{ ...typography.display, color: colors.bright }}>{plan.data?.features.label ?? "Yükleniyor…"}</Text>
          {plan.data?.expiresAt ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {plan.data.source === "reward"
                ? `Reklam ödülü · ${formatTime(plan.data.expiresAt)}'e kadar`
                : `Bitiş: ${new Date(plan.data.expiresAt).toLocaleDateString("tr-TR")}`}
            </Text>
          ) : null}
          <Text style={{ ...typography.body, color: colors.text }}>• {plan.data?.features.maxUploadMb ?? 8} MB dosya yükleme</Text>
          <Text style={{ ...typography.body, color: colors.text }}>• {plan.data?.features.maxServers ?? 100} sunucu</Text>
          <Text style={{ ...typography.body, color: colors.text }}>• {plan.data?.features.customThemes ? "Özel temalar açık" : "Standart temalar"}</Text>
        </View>

        {plan.data?.plan === "FREE" || plan.data?.source === "reward" ? (
          <>
            <SectionHeader title="ÜCRETSİZ DENE" />
            <RewardedCard />
          </>
        ) : null}

        <SectionHeader title="HEDİYE VEYA PROMOSYON KODU" />
        <View style={{ marginHorizontal: spacing.lg, padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
          <TextField label="KOD" value={code} onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20))} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" />
          <Button label="Kodu Kullan" onPress={() => redeem.mutate()} loading={redeem.isPending} disabled={!code.trim()} fullWidth />
        </View>

        <SectionHeader title="HEDİYE ET YA DA SATIN AL" />
        <MentolGiftCard />

        <SectionHeader title="MAĞAZA" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Button label="Mağazaya git" icon="sparkles" variant="secondary" onPress={() => router.push("/store")} fullWidth />
        </View>

        <SectionHeader title="PLANLAR" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {PLAN_ROWS.map((row) => (
            <View key={row.name} style={{ padding: spacing.lg, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.panel, borderWidth: plan.data?.plan === row.id ? 1 : 0, borderColor: colors.brand, gap: 3 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{row.name}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{row.detail}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Mentol hediye etme (web `MentolGift`): kullanıcı adı + plan + dönem →
 * ödeme kaydı → web ödeme sayfası tarayıcıda. Ad boşsa plan kendine alınır.
 * Ödeme uygulama içinde yapılmaz (mağaza kuralları; bkz. `use-store.ts`).
 */
function MentolGiftCard() {
  const checkout = useCheckout();
  const [username, setUsername] = useState("");
  const [plan, setPlan] = useState<"PLUS" | "PRO">("PLUS");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const giftTo = username.trim().replace(/^@/, "");

  const submit = () =>
    checkout.mutate(
      { kind: "mentol", plan, period, giftTo: giftTo || undefined },
      { onError: (error) => showDialog("Ödeme başlatılamadı", error instanceof ApiError ? error.message : "Tekrar dene.") }
    );

  return (
    <View style={{ marginHorizontal: spacing.lg, padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
      <Text style={{ ...typography.caption, color: colors.muted }}>
        Kullanıcı adını yaz, planı seç; ödeme tamamlanınca Mentol doğrudan o kişiye işlenir. Boş bırakırsan plan sana alınır.
      </Text>
      <TextField label="KİME?" value={username} onChangeText={setUsername} placeholder="@kullaniciadi" autoCapitalize="none" autoCorrect={false} />
      <ChoiceRow
        value={plan}
        onChange={setPlan}
        options={[
          { value: "PLUS", label: "Mentol Plus" },
          { value: "PRO", label: "Mentol Pro" },
        ]}
      />
      <ChoiceRow
        value={period}
        onChange={setPeriod}
        options={[
          { value: "monthly", label: "1 ay" },
          { value: "yearly", label: "1 yıl" },
        ]}
      />
      <Button label={giftTo ? "Hediye et" : "Satın al"} icon={giftTo ? "heart" : "sparkles"} onPress={submit} loading={checkout.isPending} fullWidth />
      <Text style={{ ...typography.caption, color: colors.muted }}>
        Ödeme web ödeme sayfasında, tarayıcıda tamamlanır. Botlara ve kendine hediye gönderilemez.
      </Text>
    </View>
  );
}

function ChoiceRow<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="light"
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.border,
              backgroundColor: active ? colors.brandSoft : "transparent",
            }}
          >
            <Text style={{ ...typography.caption, fontSize: 14, ...fw(active ? 700 : 600), color: active ? colors.brand : colors.text }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PLAN_ROWS = [
  { id: "FREE", name: "Ücretsiz", detail: "8 MB yükleme · 100 sunucu" },
  { id: "PLUS", name: "Mentol Plus", detail: "128 MB yükleme · 200 sunucu · özel temalar" },
  { id: "PRO", name: "Mentol Pro", detail: "512 MB yükleme · 500 sunucu · özel temalar" },
] as const;
