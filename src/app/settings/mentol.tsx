import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useMentolPlan } from "@/api/hooks";
import { Button, Screen, SectionHeader, TextField, showDialog } from "@/components/ui";
import { RewardedCard } from "@/features/mentol/rewarded-card";
import { formatTime } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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

const PLAN_ROWS = [
  { id: "FREE", name: "Ücretsiz", detail: "8 MB yükleme · 100 sunucu" },
  { id: "PLUS", name: "Mentol Plus", detail: "128 MB yükleme · 200 sunucu · özel temalar" },
  { id: "PRO", name: "Mentol Pro", detail: "512 MB yükleme · 500 sunucu · özel temalar" },
] as const;
