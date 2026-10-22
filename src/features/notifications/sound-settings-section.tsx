import { useMemo } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { Icon, ListGroup, SectionHeader } from "@/components/ui";
import {
  PREVIEWABLE_SOUNDS,
  SOUNDS,
  SOUND_CATEGORY_LABELS,
  SOUND_CATEGORY_ORDER,
  type SoundCategory,
  type SoundId,
} from "@/lib/sound-catalog";
import { previewSound } from "@/lib/sounds";
import { useSoundSettings } from "@/stores/sound-settings";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const LEVELS = [25, 50, 75, 100] as const;

/**
 * Bildirim sesleri — web Ayarlar › Bildirimler › "Bildirim Sesleri"
 * (components/settings/notification-sounds-section).
 *
 * Liste elle yazılmaz, ses kataloğundan türetilir: ana anahtar, seviye,
 * kategori anahtarları ve her sesi tek tek dinleme.
 */
export function SoundSettingsSection() {
  const enabled = useSoundSettings((s) => s.enabled);
  const masterVolume = useSoundSettings((s) => s.masterVolume);
  const mutedCategories = useSoundSettings((s) => s.mutedCategories);
  const setEnabled = useSoundSettings((s) => s.setEnabled);
  const setMasterVolume = useSoundSettings((s) => s.setMasterVolume);
  const setCategoryMuted = useSoundSettings((s) => s.setCategoryMuted);

  const grouped = useMemo(() => {
    const map = new Map<SoundCategory, SoundId[]>();
    for (const id of PREVIEWABLE_SOUNDS) {
      const list = map.get(SOUNDS[id].category);
      if (list) list.push(id);
      else map.set(SOUNDS[id].category, [id]);
    }
    return map;
  }, []);

  const level = Math.round(masterVolume * 100);

  return (
    <>
      <SectionHeader title="Bildirim Sesleri" />
      <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        Hangi seslerin çalacağını seç, seviyesini ayarla ve tek tek dinle.
      </Text>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <ListGroup>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typography.body, color: colors.text }}>Sesleri çal</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Kapatıldığında Ciklet hiçbir bildirim sesi çalmaz.
              </Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
        </ListGroup>

        <View style={{ gap: spacing.sm, opacity: enabled ? 1 : 0.45 }} pointerEvents={enabled ? "auto" : "none"}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>BİLDİRİM SEVİYESİ</Text>
            <Text style={{ ...typography.overline, color: colors.muted }}>%{level}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {LEVELS.map((value) => {
              const selected = level === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setMasterVolume(value / 100)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: spacing.md,
                    borderRadius: radii.lg,
                    borderCurve: "continuous",
                    backgroundColor: selected ? colors.brand : pressed ? colors.raised : colors.panel,
                  })}
                >
                  <Text style={{ ...typography.bodyStrong, color: selected ? colors.onBrand : colors.text }}>%{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {SOUND_CATEGORY_ORDER.map((category) => {
          const ids = grouped.get(category);
          if (!ids?.length) return null;
          const muted = mutedCategories.includes(category);
          return (
            <View
              key={category}
              pointerEvents={enabled ? "auto" : "none"}
              style={{
                opacity: enabled ? 1 : 0.45,
                padding: spacing.lg,
                gap: spacing.md,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                backgroundColor: colors.panel,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.text }}>{SOUND_CATEGORY_LABELS[category].label}</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>{SOUND_CATEGORY_LABELS[category].hint}</Text>
                </View>
                <Switch
                  value={!muted}
                  onValueChange={(on) => setCategoryMuted(category, !on)}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#ffffff"
                />
              </View>
              <View
                pointerEvents={muted ? "none" : "auto"}
                style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, opacity: muted ? 0.45 : 1 }}
              >
                {ids.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => previewSound(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${SOUNDS[id].label} sesini dinle`}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 6,
                      borderRadius: radii.full,
                      backgroundColor: pressed ? colors.brand : colors.raised,
                    })}
                  >
                    {({ pressed }) => (
                      <>
                        <Icon name="play" size={12} color={pressed ? colors.onBrand : colors.text} />
                        <Text style={{ ...typography.caption, ...fw(600), color: pressed ? colors.onBrand : colors.text }}>
                          {SOUNDS[id].label}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}
