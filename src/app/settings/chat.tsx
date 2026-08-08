import { ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { Divider, ListGroup, Screen, SectionHeader, SegmentedTabs } from "@/components/ui";
import { usePreferences, type ChatDensity } from "@/stores/preferences";
import { colors, spacing, typography } from "@/theme/tokens";

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
      </ScrollView>
    </Screen>
  );
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
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{title}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.deep, true: colors.brand }}
        thumbColor={colors.bright}
      />
    </View>
  );
}
