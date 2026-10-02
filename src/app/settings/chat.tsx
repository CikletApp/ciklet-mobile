import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Directory, File, Paths } from "expo-file-system";

import { useMentolPlan } from "@/api/hooks";
import { Button, Divider, Icon, ListGroup, ListRow, Screen, SectionHeader, SegmentedTabs, showDialog } from "@/components/ui";
import { pickFromGallery } from "@/lib/uploads";
import { usePreferences, type ChatDensity } from "@/stores/preferences";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/** Arka plan görseli bu klasörde yaşar; galeri adresi kalıcı olmadığı için kopyalanır. */
const BACKGROUND_DIR = "chat-background";

type DimLevel = "light" | "medium" | "dark";
const DIM_LEVELS: { id: DimLevel; label: string; value: number }[] = [
  { id: "light", label: "Açık", value: 0.15 },
  { id: "medium", label: "Orta", value: 0.35 },
  { id: "dark", label: "Koyu", value: 0.55 },
];

export default function ChatSettingsScreen() {
  const linkPreviews = usePreferences((state) => state.linkPreviews);
  const bigEmoji = usePreferences((state) => state.bigEmoji);
  const chatDensity = usePreferences((state) => state.chatDensity);
  const setPreference = usePreferences((state) => state.setPreference);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Sohbet" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="GÖRÜNÜM YOĞUNLUĞU" />
        <SegmentedTabs
          items={[
            { id: "comfortable" as ChatDensity, label: "Rahat" },
            { id: "compact" as ChatDensity, label: "Kompakt" },
          ]}
          value={chatDensity}
          onChange={(value) => setPreference("chatDensity", value)}
        />

        <SectionHeader title="MESAJ İÇERİĞİ" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title="Bağlantı önizlemeleri"
              description="URL’ler için başlık, görsel ve açıklama kartı göster."
              value={linkPreviews}
              onChange={(value) => setPreference("linkPreviews", value)}
            />
            <Divider inset={16} />
            <ToggleRow
              title="Büyük emoji"
              description="Yalnızca emoji içeren mesajları daha büyük göster."
              value={bigEmoji}
              disabled={chatDensity === "compact"}
              onChange={(value) => setPreference("bigEmoji", value)}
            />
          </ListGroup>
        </View>

        <ChatBackgroundSection />
      </ScrollView>
    </Screen>
  );
}

/**
 * Sohbet arka planı — Mentol (özel temalar hakkı) ile açılır.
 *
 * Görsel yalnızca bu cihazda saklanır: sunucu tarafında böyle bir profil
 * alanı yok ve kişisel bir süs için dosya yüklemek gereksiz. Plan FREE'ye
 * düştüğünde görsel silinmez ama çizilmez (bkz. chat-view); plan geri
 * gelince yeniden görünür.
 */
function ChatBackgroundSection() {
  const plan = useMentolPlan();
  const uri = usePreferences((state) => state.chatBackgroundUri);
  const dim = usePreferences((state) => state.chatBackgroundDim);
  const setPreference = usePreferences((state) => state.setPreference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlocked = plan.data?.features.customThemes === true;
  const dimLevel = DIM_LEVELS.reduce((best, level) =>
    Math.abs(level.value - dim) < Math.abs(best.value - dim) ? level : best
  ).id;

  const choose = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const picked = await pickFromGallery();
      if (!picked) return;
      const directory = new Directory(Paths.document, BACKGROUND_DIR);
      directory.create({ intermediates: true, idempotent: true });
      const extension = (picked.mimeType ?? "").includes("png") ? "png" : (picked.mimeType ?? "").includes("webp") ? "webp" : "jpg";
      const target = new File(directory, `background-${Date.now()}.${extension}`);
      await new File(picked.uri).copy(target);
      const previous = uri;
      setPreference("chatBackgroundUri", target.uri);
      if (previous) removeFile(previous);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Görsel alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    showDialog("Arka planı kaldır", "Sohbetler yeniden düz zeminde görünecek.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: () => {
          if (uri) removeFile(uri);
          setPreference("chatBackgroundUri", null);
        },
      },
    ]);
  };

  return (
    <>
      <SectionHeader title="SOHBET ARKA PLANI" />
      <View style={{ paddingHorizontal: spacing.lg }}>
        {!unlocked ? (
          <ListGroup>
            <ListRow
              icon="image"
              title="Özel arka plan görseli"
              subtitle={plan.isLoading ? "Plan bilgisi alınıyor…" : "Mentol ile açılır: sohbetlerin arkasına kendi görselini koy."}
              detail={plan.isLoading ? undefined : "Mentol"}
              onPress={() => router.push("/settings/mentol")}
            />
          </ListGroup>
        ) : (
          <View
            style={{
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.panel,
              borderWidth: 1,
              borderColor: colors.bentoBorder,
            }}
          >
            {/* Önizleme: gerçek sohbet zeminiyle aynı kararma katmanı. */}
            <View
              style={{
                height: 150,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: colors.chat,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {uri ? (
                <>
                  <Image source={{ uri }} contentFit="cover" style={{ position: "absolute", inset: 0 }} />
                  <View style={{ position: "absolute", inset: 0, backgroundColor: colors.chat, opacity: dim }} />
                  <View style={{ alignSelf: "flex-end", margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.bubbleOwn }}>
                    <Text style={{ ...typography.caption, color: colors.bright }}>Böyle görünecek 👋</Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: "center", gap: spacing.sm }}>
                  <Icon name="image" size={28} color={colors.muted} />
                  <Text style={{ ...typography.caption, color: colors.muted }}>Henüz bir görsel seçilmedi</Text>
                </View>
              )}
            </View>

            {uri ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>KARARTMA</Text>
                <SegmentedTabs
                  items={DIM_LEVELS.map((level) => ({ id: level.id, label: level.label }))}
                  value={dimLevel}
                  onChange={(id) => {
                    const level = DIM_LEVELS.find((entry) => entry.id === id);
                    if (level) setPreference("chatBackgroundDim", level.value);
                  }}
                />
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button label={uri ? "Görseli değiştir" : "Galeriden seç"} icon="image" onPress={() => void choose()} loading={busy} style={{ flex: 1 }} />
              {uri ? <Button label="Kaldır" variant="secondary" onPress={remove} disabled={busy} /> : null}
            </View>

            {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Görsel yalnızca bu cihazda saklanır; karşı taraf görmez.
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function removeFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* Eski dosya zaten yok. */
  }
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, ...fw(600), color: colors.bright }}>{title}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
