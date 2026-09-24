import { useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";

import { useMentolPlan } from "@/api/hooks";
import { Icon, Pressable, Screen } from "@/components/ui";
import { THEME_LABELS, useTheme } from "@/stores/theme";
import {
  THEMES,
  buildRegion,
  getTheme,
  type CustomColors,
  type ThemeMeta,
  type ThemeSource,
} from "@/theme/palette";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Görünüm — ciklet-web'deki "atmosfer" stüdyosunun mobil karşılığı
 * (`components/settings/appearance-palette-editor.tsx`).
 *
 * Seçim ANINDA uygulanır: telefonda önizleme ile kaydetme arasındaki ayrım
 * bir fayda getirmiyor, yalnızca "Kaydet"e basmayı unutturuyor. Canlı
 * önizleme kartı yine de duruyor, çünkü özel renk seçerken sonucu tüm
 * bölgelerde (menü, sohbet, panel) aynı anda görmek gerekiyor.
 */

const FIELDS: { id: keyof ThemeSource; label: string; description: string }[] = [
  { id: "canvas", label: "Ana zemin", description: "Uygulamanın arka planı" },
  { id: "menu", label: "Menüler", description: "Sohbet ve kanal listeleri" },
  { id: "chat", label: "Sohbet", description: "Mesajların bulunduğu alan" },
  { id: "panel", label: "Paneller", description: "Kartlar, başlıklar ve ayarlar" },
  { id: "accent", label: "Vurgu", description: "Seçimler ve renkli detaylar" },
];

const HEX = /^#[0-9a-f]{6}$/i;

export default function AppearanceScreen() {
  const preference = useTheme((s) => s.preference);
  const themeId = useTheme((s) => s.themeId);
  const customColors = useTheme((s) => s.customColors);
  const setTheme = useTheme((s) => s.setTheme);
  const setCustomColors = useTheme((s) => s.setCustomColors);
  const plan = useMentolPlan();
  const canCustomize = plan.data?.features.customThemes === true;

  const source: ThemeSource = { ...getTheme(themeId).source, ...customColors };
  const customEnabled = Object.keys(customColors).length > 0;

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}
      >
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="palette" size={14} color={colors.brand} />
            <Text style={{ ...typography.overline, color: colors.brand }}>KENDİ FREKANSINDA</Text>
          </View>
          <Text style={{ ...typography.display, color: colors.bright }}>
            Renkler de <Text style={{ color: colors.brand }}>senden yana.</Text>
          </Text>
          <Text style={{ ...typography.body, color: colors.muted }}>
            Bir atmosfer seç. Ciklet Web ile aynı paletler; seçimin bu cihazda saklanır.
          </Text>
        </View>

        <ThemePreview source={source} />

        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }}>Hazır atmosferler</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {preference === "system" ? "Sistemle eşleşiyor" : THEME_LABELS[themeId]}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={preference === theme.id}
              onPress={() => void setTheme(theme.id)}
            />
          ))}
          <SystemCard selected={preference === "system"} onPress={() => void setTheme("system")} />
        </View>

        <CustomPalette
          source={source}
          customColors={customColors}
          enabled={customEnabled}
          canCustomize={canCustomize}
          loading={plan.isLoading}
          onChange={(next) => void setCustomColors(next)}
        />
      </ScrollView>
    </Screen>
  );
}

/** Menü + sohbet bölgelerini seçilen paletle çizen küçük sahne. */
function ThemePreview({ source }: { source: ThemeSource }) {
  const menu = buildRegion(source.menu, source.accent);
  const chat = buildRegion(source.chat, source.accent);
  const panel = buildRegion(source.panel, source.accent);
  const onAccent = buildRegion(source.accent, source.accent).text;

  return (
    <View
      accessibilityLabel="Tema önizlemesi"
      style={{
        borderRadius: radii.xl,
        borderCurve: "continuous",
        backgroundColor: source.canvas,
        padding: 6,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.bentoBorder,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          height: 34,
          borderRadius: radii.md + 2,
          borderCurve: "continuous",
          backgroundColor: panel.bg,
        }}
      >
        <Text style={{ ...typography.caption, ...fw(700), color: panel.text }}>ciklet</Text>
        <Text style={{ ...typography.caption, color: panel.muted, flex: 1 }} numberOfLines={1}>/ senin köşen</Text>
        <Text style={{ fontSize: 9, ...fw(700), letterSpacing: 0.6, color: panel.accent }}>CANLI ÖNİZLEME</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 6, height: 176 }}>
        <View style={{ width: "40%", borderRadius: radii.md + 2, borderCurve: "continuous", backgroundColor: menu.bg, padding: spacing.sm, gap: 5 }}>
          <Text style={{ ...typography.caption, ...fw(700), color: menu.text }}>bizim köşe</Text>
          <Text style={{ fontSize: 8, ...fw(700), letterSpacing: 0.5, color: menu.muted, marginTop: 2 }}>METİN KANALLARI</Text>
          <PreviewChannel icon="hash" label="muhabbet" color={menu.accent} background={menu.raised} />
          <PreviewChannel icon="hash" label="paylaşımlar" color={menu.muted} />
          <Text style={{ fontSize: 8, ...fw(700), letterSpacing: 0.5, color: menu.muted, marginTop: 2 }}>SES ODALARI</Text>
          <PreviewChannel icon="volume" label="salon" color={menu.muted} />
        </View>

        <View style={{ flex: 1, borderRadius: radii.md + 2, borderCurve: "continuous", backgroundColor: chat.bg, padding: spacing.sm, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="hash" size={12} color={chat.muted} />
            <Text style={{ ...typography.caption, ...fw(700), color: chat.text }}>muhabbet</Text>
          </View>
          <PreviewMessage initial="e" name="Ece" time="Şimdi" text="Yeni renkler tam senlik olmuş! ✨" avatarBg={chat.raised} avatarText={chat.text} textColor={chat.text} muted={chat.muted} />
          <PreviewMessage initial="s" name="Sen" text="Burası artık benim köşem." avatarBg={source.accent} avatarText={onAccent} textColor={chat.text} muted={chat.muted} />
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center", height: 26, paddingHorizontal: spacing.sm, borderRadius: radii.full, backgroundColor: chat.raised, borderWidth: 1, borderColor: chat.border }}>
            <Text style={{ fontSize: 10, color: chat.muted, flex: 1 }} numberOfLines={1}>Bir selam bırak…</Text>
            <Icon name="send" size={11} color={chat.accent} />
          </View>
        </View>
      </View>
    </View>
  );
}

function PreviewChannel({ icon, label, color, background }: { icon: "hash" | "volume"; label: string; color: string; background?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: background }}>
      <Icon name={icon} size={10} color={color} />
      <Text style={{ fontSize: 10, ...fw(background ? 700 : 500), color }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function PreviewMessage(props: { initial: string; name: string; time?: string; text: string; avatarBg: string; avatarText: string; textColor: string; muted: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: props.avatarBg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 9, ...fw(700), color: props.avatarText }}>{props.initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, ...fw(700), color: props.textColor }}>
          {props.name}
          {props.time ? <Text style={{ ...fw(400), color: props.muted }}>  {props.time}</Text> : null}
        </Text>
        <Text style={{ fontSize: 10, lineHeight: 13, color: props.textColor }}>{props.text}</Text>
      </View>
    </View>
  );
}

/** Web'deki tema kartıyla aynı swatch dili: zemin, menü şeridi, sohbet + panel + vurgu. */
function ThemeCard({ theme, selected, onPress }: { theme: ThemeMeta; selected: boolean; onPress: () => void }) {
  const { canvas, menu, chat, panel, accent } = theme.source;
  return (
    <CardShell selected={selected} onPress={onPress} label={`${theme.label} teması`}>
      <View style={{ height: 64, borderRadius: radii.md, borderCurve: "continuous", backgroundColor: canvas, padding: 5, flexDirection: "row", gap: 4 }}>
        <View style={{ width: "30%", borderRadius: 6, backgroundColor: menu }} />
        <View style={{ flex: 1, borderRadius: 6, backgroundColor: chat, padding: 6, gap: 5, justifyContent: "flex-end" }}>
          <View style={{ height: 6, width: "80%", borderRadius: 3, backgroundColor: panel }} />
          <View style={{ height: 6, width: "45%", borderRadius: 3, backgroundColor: accent }} />
        </View>
        {selected ? <SelectedBadge /> : null}
      </View>
      <View style={{ gap: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{theme.label}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{theme.kind}</Text>
      </View>
    </CardShell>
  );
}

function SystemCard({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const dark = getTheme("amethyst").source;
  const light = getTheme("light").source;
  return (
    <CardShell selected={selected} onPress={onPress} label="Sistem teması">
      <View style={{ height: 64, borderRadius: radii.md, borderCurve: "continuous", overflow: "hidden", flexDirection: "row" }}>
        <View style={{ flex: 1, backgroundColor: light.chat }} />
        <View style={{ flex: 1, backgroundColor: dark.chat }} />
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <Icon name="monitor" size={18} color={colors.bright} />
          </View>
        </View>
        {selected ? <SelectedBadge /> : null}
      </View>
      <View style={{ gap: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Sistem</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>Otomatik</Text>
      </View>
    </CardShell>
  );
}

function CardShell({ selected, onPress, label, children }: { selected: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      noHitSlop
      haptic="light"
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        width: "47.8%",
        flexGrow: 1,
        padding: spacing.sm,
        gap: spacing.sm,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: selected ? 2 : 1,
        // Seçili olmayan kartta da 2px'lik yer tutulur ki seçim düzeni kaydırmasın.
        margin: selected ? 0 : 1,
        borderColor: selected ? colors.brand : colors.bentoBorder,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      {children}
    </Pressable>
  );
}

function SelectedBadge() {
  return (
    <View style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
      <Icon name="check" size={12} color={colors.onBrand} />
    </View>
  );
}

function CustomPalette({
  source,
  customColors,
  enabled,
  canCustomize,
  loading,
  onChange,
}: {
  source: ThemeSource;
  customColors: CustomColors;
  enabled: boolean;
  canCustomize: boolean;
  loading: boolean;
  onChange: (next: CustomColors) => void;
}) {
  const editable = enabled && canCustomize;
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.bentoBorder }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Senin paletin</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.brandSoft }}>
              <Icon name="sparkles" size={10} color={colors.brand} />
              <Text style={{ fontSize: 9, ...fw(800), letterSpacing: 0.5, color: colors.brand }}>MENTOL</Text>
            </View>
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }}>Menü başka, sohbet başka. Her alanı ayrı seç.</Text>
        </View>
        <Switch
          value={enabled}
          disabled={!canCustomize}
          accessibilityLabel="Özel renkleri kullan"
          onValueChange={(on) => onChange(on ? { ...source } : {})}
          trackColor={{ false: colors.border, true: colors.brand }}
          thumbColor="#ffffff"
        />
      </View>

      {!canCustomize && !loading ? (
        <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.deep }}>
          Kişisel renkler Mentol Plus ve Pro ile kullanılabilir. Hazır atmosferleri her planda seçebilirsin.
        </Text>
      ) : null}

      <View style={{ gap: spacing.md, opacity: editable ? 1 : 0.5 }} pointerEvents={editable ? "auto" : "none"}>
        {FIELDS.map((field) => (
          <ColorField
            key={field.id}
            field={field}
            value={source[field.id]}
            onChange={(color) => onChange({ ...source, ...customColors, [field.id]: color })}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>Yazı kontrastı otomatik dengelenir.</Text>
        <Pressable
          onPress={() => onChange({})}
          disabled={!enabled}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: enabled ? 1 : 0.4 }}
        >
          <Icon name="rotate-ccw" size={13} color={colors.brand} />
          <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Paleti sıfırla</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Tek bir renk alanı: HEX girişi + hazır temalardaki aynı alanın renkleri.
 * React Native'de yerleşik renk seçici yok; öneri şeridi, HEX bilmeyen
 * kullanıcıya da uyumlu bir başlangıç noktası veriyor.
 */
function ColorField({ field, value, onChange }: { field: (typeof FIELDS)[number]; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft !== null && !HEX.test(draft);
  const suggestions = [...new Set(THEMES.map((theme) => theme.source[field.id]))];

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 34, height: 34, borderRadius: radii.md, backgroundColor: value, borderWidth: 1, borderColor: colors.border }} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{field.label}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{field.description}</Text>
        </View>
        <TextInput
          value={shown}
          maxLength={7}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel={`${field.label} HEX rengi`}
          onFocus={() => setDraft(value)}
          onBlur={() => setDraft(null)}
          onChangeText={(next) => {
            const normalized = next.startsWith("#") ? next : `#${next}`;
            setDraft(normalized);
            if (HEX.test(normalized)) onChange(normalized.toLowerCase());
          }}
          style={{
            width: 92,
            height: 38,
            paddingHorizontal: spacing.sm,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: invalid ? colors.danger : colors.border,
            backgroundColor: colors.deep,
            color: colors.bright,
            fontFamily: "monospace",
            fontSize: 13,
            textAlign: "center",
          }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingLeft: 46 }}>
        {suggestions.map((color) => (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            noHitSlop
            accessibilityRole="button"
            accessibilityLabel={`${field.label}: ${color}`}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: color === value ? colors.brand : colors.border,
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
