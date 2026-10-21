import { useState, type ReactNode } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, Stack } from "expo-router";

import { ApiError } from "@/api/client";
import { useCurrentProfile, useMentolPlan, useStoreCatalog, useUpdateProfile } from "@/api/hooks";
import { Avatar, Button, Icon, NameStyleText, Pressable, Screen, ScreenLoader, showToast } from "@/components/ui";
import {
  NAME_COLOR_PALETTE,
  NAME_EFFECTS,
  NAME_FONTS,
  changedNameStyleIds,
  findNameEffect,
  nameStyleItemAccess,
  parseNameStyle,
  sameNameStyle,
  type NameStyle,
  type NameStyleAccess,
  type NameStyleTier,
} from "@/lib/name-style";
import { PURCHASES_ENABLED } from "@/lib/purchases";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Ad stili seçici (web: Profili Düzenle → Ad Stili). Yazı tipi + efekt +
 * renkler taslakta; üstteki canlı önizleme (üye listesi satırı + büyük
 * başlık) taslağı çizer, "Kaydet" `PATCH /api/current-profile {nameStyle}`.
 *
 * Kilitli (Mentol / mağaza) seçenekler de denenebilir, yalnızca
 * kaydedilemez — Mentol'e ya da mağazaya yol gösterilir. Kilit yalnızca
 * DEĞİŞEN kimliklere uygulanır (sunucuyla aynı kural: Mentol'ü biten
 * kullanıcı eski gradyanını korur).
 */
const EMPTY: NameStyle = { font: null, effect: null, colors: [] };

export default function NameStyleScreen() {
  const { data: profile, isLoading } = useCurrentProfile();
  const plan = useMentolPlan();
  const store = useStoreCatalog();
  const update = useUpdateProfile();
  const { width } = useWindowDimensions();
  // undefined → taslak yok (kayıtlı stil gösterilir).
  const [draft, setDraft] = useState<NameStyle | null | undefined>(undefined);

  if (isLoading || !profile) return <ScreenLoader />;

  const mentol = (plan.data?.plan ?? "FREE") !== "FREE";
  const owned = store.data ? new Set(store.data.items.filter((i) => i.owned).map((i) => i.id)) : null;
  const saved = parseNameStyle(profile.nameStyle);
  const shown = draft !== undefined ? draft : saved;
  const style = shown ?? EMPTY;
  const effect = findNameEffect(style.effect);
  const name = profile.name?.trim() || profile.username;
  const dirty = !sameNameStyle(shown, saved);

  const access = (id: string): NameStyleAccess => nameStyleItemAccess(id, { mentol, owned: owned?.has(id) ?? false });
  const blocked = changedNameStyleIds(shown, saved).map(access).filter((a) => a !== "ok");
  const needsMentol = blocked.includes("mentol_required");
  const needsStore = blocked.includes("not_owned");

  const change = (next: Partial<NameStyle>) => setDraft(parseNameStyle({ ...style, ...next }));
  const setColor = (index: number, color: string) => {
    const next = [...style.colors];
    next[index] = color;
    change({ colors: next });
  };

  const save = () => {
    if (update.isPending || !dirty || blocked.length) return;
    update.mutate(
      { nameStyle: shown ? { font: shown.font, effect: shown.effect, colors: shown.colors } : null },
      {
        onSuccess: () => {
          setDraft(undefined);
          showToast(shown ? "Ad stili kaydedildi." : "Ad stili kaldırıldı.");
        },
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Ad stili kaydedilemedi.", "error"),
      }
    );
  };

  const tierLabel = (id: string, tier: NameStyleTier) => {
    if (tier === "free") return "Ücretsiz";
    if (tier === "mentol") return "Mentol";
    if (!owned) return "";
    return owned.has(id) ? "Sende" : "Mağaza";
  };

  const inner = width - spacing.lg * 2;
  const columns = inner >= 520 ? 3 : 2;
  const gap = spacing.sm;
  const cell = Math.floor((inner - gap * (columns - 1)) / columns);

  const fontTile = (fontId: string | null) => {
    const font = NAME_FONTS.find((f) => f.id === fontId) ?? null;
    const selected = style.font === fontId;
    const locked = font ? access(font.id) !== "ok" : false;
    return (
      <Pressable
        key={fontId ?? "none"}
        onPress={() => change({ font: fontId })}
        haptic="light"
        noHitSlop
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${font?.name ?? "Uygulama yazı tipi"}${locked ? ", kilitli" : ""}`}
        style={({ pressed }) => ({
          width: cell,
          minHeight: 64,
          justifyContent: "space-between",
          gap: 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: selected ? colors.brand : "transparent",
          backgroundColor: pressed ? colors.raised : colors.panel,
        })}
      >
        <NameStyleText
          style={font ? { font: font.id, effect: null, colors: [] } : null}
          name={name}
          textStyle={{ ...typography.bodyStrong, fontSize: 17, color: colors.bright }}
          numberOfLines={1}
        />
        <TileMeta label={font?.name ?? "Uygulama"} tier={font ? tierLabel(font.id, font.tier) : ""} locked={locked} />
      </Pressable>
    );
  };

  const effectChip = (effectId: string | null) => {
    const item = NAME_EFFECTS.find((e) => e.id === effectId) ?? null;
    const selected = style.effect === effectId;
    const locked = item ? access(item.id) !== "ok" : false;
    return (
      <Pressable
        key={effectId ?? "none"}
        onPress={() => change({ effect: effectId })}
        haptic="light"
        noHitSlop
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item?.name ?? "Efekt yok"}${locked ? ", kilitli" : ""}`}
        style={({ pressed }) => ({
          width: cell,
          minHeight: 64,
          justifyContent: "space-between",
          gap: 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: selected ? colors.brand : "transparent",
          backgroundColor: pressed ? colors.raised : colors.panel,
        })}
      >
        <NameStyleText
          style={item ? parseNameStyle({ font: style.font, effect: item.id, colors: style.colors }) : null}
          name={item?.name ?? "Rol rengi"}
          textStyle={{ ...typography.bodyStrong, fontSize: 16, color: colors.bright }}
          containerStyle={{ alignSelf: "flex-start" }}
          numberOfLines={1}
        />
        <TileMeta label={item ? "" : "Yok"} tier={item ? tierLabel(item.id, item.tier) : ""} locked={locked} />
      </Pressable>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ad Stili" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Görünen adın sohbette, üye listesinde ve profilinde bu yazı tipi ve renkle görünür. Renk efekti rol rengini ezer; yalnızca yazı tipi seçersen rol rengin kalır.
        </Text>

        {/* Canlı önizleme: üye listesi satırı + profil başlığı. */}
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl, backgroundColor: colors.panel }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar profileId={profile.id} imageUrl={profile.imageUrl} fallbackText={profile.username} size={36} backgroundColor={colors.panel} />
            <NameStyleText
              style={shown}
              name={name}
              textStyle={{ ...typography.body, ...fw(600), color: colors.bright }}
              numberOfLines={1}
            />
          </View>
          <NameStyleText
            style={shown}
            name={name}
            animate
            textStyle={{ ...typography.displayLg, color: colors.bright }}
            containerStyle={{ alignSelf: "flex-start" }}
            numberOfLines={1}
          />
        </View>

        <Section title="YAZI TİPİ">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {fontTile(null)}
            {NAME_FONTS.map((font) => fontTile(font.id))}
          </View>
        </Section>

        <Section title="EFEKT">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {effectChip(null)}
            {NAME_EFFECTS.map((item) => effectChip(item.id))}
          </View>
        </Section>

        {effect && effect.maxColors > 0 ? (
          <Section title="RENKLER">
            {style.colors.map((current, index) => (
              <View key={index} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{`Renk ${index + 1}`}</Text>
                  {index === style.colors.length - 1 && style.colors.length > effect.minColors ? (
                    <Pressable
                      onPress={() => change({ colors: style.colors.slice(0, -1) })}
                      accessibilityRole="button"
                      accessibilityLabel="Rengi kaldır"
                      hitSlop={8}
                    >
                      <Icon name="close" size={16} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {NAME_COLOR_PALETTE.map((swatch) => {
                    const active = swatch === current;
                    return (
                      <Pressable
                        key={swatch}
                        onPress={() => setColor(index, swatch)}
                        haptic="light"
                        noHitSlop
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Renk ${swatch}`}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: swatch,
                          borderWidth: active ? 3 : 1,
                          borderColor: active ? colors.brand : colors.border,
                        }}
                      >
                        {active ? <Icon name="check" size={14} color={swatch === "#ffffff" ? "#111111" : "#ffffff"} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {style.colors.length < effect.maxColors ? (
              <Button
                label="Renk ekle"
                icon="plus"
                variant="secondary"
                onPress={() => change({ colors: [...style.colors, NAME_COLOR_PALETTE[(style.colors.length * 5) % NAME_COLOR_PALETTE.length]] })}
                style={{ alignSelf: "flex-start" }}
              />
            ) : null}
          </Section>
        ) : null}

        {needsMentol ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>Seçtiğin stillerden bazıları Mentol Plus ile açılır.</Text>
        ) : null}
        {needsStore ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Seçtiğin stillerden bazıları sende yok{PURCHASES_ENABLED ? "; mağazadan alabilirsin." : "."}
            </Text>
            {PURCHASES_ENABLED ? (
              <Button label="Mağazaya git" icon="sparkles" variant="secondary" onPress={() => router.push("/store")} fullWidth />
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button label="Kaydet" onPress={save} disabled={!dirty || blocked.length > 0} loading={update.isPending} fullWidth />
          {dirty ? <Button label="Değişiklikleri geri al" variant="secondary" onPress={() => setDraft(undefined)} fullWidth /> : null}
          {!dirty && saved ? (
            <Button label="Stili kaldır" variant="secondary" onPress={() => setDraft(null)} fullWidth />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
      {children}
    </View>
  );
}

function TileMeta({ label, tier, locked }: { label: string; tier: string; locked: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 11, ...fw(600), color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 3 }}>
        {locked ? <Icon name="sparkles" size={11} color={colors.muted} /> : null}
        <Text style={{ fontSize: 11, color: locked ? colors.muted : colors.brand }}>{tier}</Text>
      </View>
    </View>
  );
}
