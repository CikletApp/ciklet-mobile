import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";

import { displayName, useOpenDirect, useSearch, MIN_SEARCH_LENGTH } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Genel arama.
 *
 * Kapsam bilinçli olarak dar: sunucu yalnızca oturum sahibinin eriştiği
 * kayıtları döner (üye olduğu sunucular, arkadaşları, DM geçmişi). Bu bir
 * kullanıcı dizini değildir — boş sonuç metni bunu ima etmemeli.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const { data, isFetching } = useSearch(query);
  const openDirect = useOpenDirect();

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_SEARCH_LENGTH;
  const isEmpty =
    !tooShort &&
    !isFetching &&
    (data?.people.length ?? 0) === 0 &&
    (data?.servers.length ?? 0) === 0 &&
    (data?.channels.length ?? 0) === 0;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
                minWidth: 220,
              }}
            >
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ara"
                placeholderTextColor={colors.muted}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  color: colors.bright,
                  ...typography.body,
                }}
                accessibilityLabel="Arama"
              />
            </View>
          ),
        }}
      />

      {tooShort ? (
        <EmptyState
          icon="search"
          title="Aramaya başla"
          description={`En az ${MIN_SEARCH_LENGTH} karakter yaz.`}
        />
      ) : isEmpty ? (
        <EmptyState
          icon="search"
          title="Sonuç yok"
          description="Arama; sunucuların, arkadaşların ve sohbet geçmişinle sınırlıdır."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }}>
          <Section title="KİŞİLER" count={data?.people.length}>
            {data?.people.map((person) => (
              <Pressable
                key={person.id}
                onPress={() =>
                  openDirect.mutate(person.id, {
                    onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
                  })
                }
                style={rowStyle}
                accessibilityRole="button"
              >
                <Avatar
                  profileId={person.id}
                  imageUrl={person.imageUrl}
                  fallbackText={person.username}
                  size={40}
                  showPresence
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                    {displayName(person)}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    @{person.username}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Section>

          <Section title="SUNUCULAR" count={data?.servers.length}>
            {data?.servers.map((server) => (
              <Pressable
                key={server.id}
                onPress={() => router.push(`/servers/${server.id}`)}
                style={rowStyle}
                accessibilityRole="button"
              >
                <Avatar
                  imageUrl={server.imageUrl}
                  fallbackText={server.name}
                  size={40}
                  shape="squircle"
                />
                <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }}>
                  {server.name}
                </Text>
              </Pressable>
            ))}
          </Section>

          <Section title="KANALLAR" count={data?.channels.length}>
            {data?.channels.map((channel) => (
              <Pressable
                key={channel.id}
                onPress={() =>
                  router.push(
                    `/chat/channel/${channel.id}?serverId=${channel.serverId}`
                  )
                }
                style={rowStyle}
                accessibilityRole="button"
              >
                <Icon name="hash" size={20} color={colors.muted} />
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>
                  {channel.name}
                </Text>
              </Pressable>
            ))}
          </Section>
        </ScrollView>
      )}
    </Screen>
  );
}

const rowStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
} as const;

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number | undefined;
  children: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <View>
      <Text
        style={{
          ...typography.overline,
          color: colors.muted,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
