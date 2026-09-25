import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";

import {
  parseSearchQuery,
  useOpenDirect,
  useSearch,
  MIN_SEARCH_LENGTH,
} from "@/api/hooks";
import type {
  SearchChannel,
  SearchGroup,
  SearchPerson,
  SearchScope,
  SearchServer,
} from "@/api/types";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { SegmentedTabs, Tag, type TabItem } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Genel arama — web'deki Ctrl/Cmd+K hızlı geçişin mobil karşılığı.
 *
 * Kapsam çiplerle seçilir; web'in önekleri de çalışır (@ kişi, # metin,
 * ! ses, * sunucu). Kapsam bilinçli olarak dar: sunucu yalnızca oturum
 * sahibinin eriştiği kayıtları döner (üye olduğu sunucular, arkadaşları,
 * DM geçmişi). Bu bir kullanıcı dizini değildir — boş sonuç metni bunu
 * ima etmemeli.
 */

const SCOPE_TABS: TabItem<SearchScope>[] = [
  { id: "all", label: "Tümü" },
  { id: "people", label: "Kişiler" },
  { id: "text", label: "Kanallar" },
  { id: "voice", label: "Ses" },
  { id: "servers", label: "Sunucular" },
];

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const [chipScope, setChipScope] = useState<SearchScope>("all");

  // Önek çipten güçlüdür: "@ali" yazan biri kişileri istiyordur, çip ne
  // olursa olsun. Önek yoksa çip geçerlidir.
  const parsed = parseSearchQuery(input);
  const scope = parsed.scope !== "all" ? parsed.scope : chipScope;
  const { data, isFetching } = useSearch(parsed.query, scope);
  const openDirect = useOpenDirect();

  const tooShort = parsed.query.length < MIN_SEARCH_LENGTH;
  const isEmpty = !tooShort && !isFetching && (data?.items.length ?? 0) === 0;

  const sections = useMemo(() => {
    const items = data?.items ?? [];
    const people = items.filter((item): item is SearchPerson => item.kind === "person");
    const groups = items.filter((item): item is SearchGroup => item.kind === "group");
    const channels = items.filter((item): item is SearchChannel => item.kind === "channel");
    const servers = items.filter((item): item is SearchServer => item.kind === "server");
    return { people, groups, channels, servers };
  }, [data]);

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
                value={input}
                onChangeText={setInput}
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

      <SegmentedTabs
        variant="pill"
        items={SCOPE_TABS}
        value={scope}
        onChange={(next) => {
          setChipScope(next);
          // Yazılmış önek çip seçimini ezmesin diye temizlenir.
          if (parsed.scope !== "all") setInput(parsed.query);
        }}
      />

      {tooShort ? (
        <EmptyState
          icon="search"
          title="Aramaya başla"
          description={`En az ${MIN_SEARCH_LENGTH} karakter yaz. Kısayollar: @ kişi, # kanal, ! ses, * sunucu.`}
        />
      ) : isEmpty ? (
        <EmptyState
          icon="search"
          title="Sonuç yok"
          description="Arama; sunucuların, arkadaşların ve sohbet geçmişinle sınırlıdır."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="KİŞİLER" count={sections.people.length}>
            {sections.people.map((person) => (
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                      {person.name?.trim() || person.username}
                    </Text>
                    {person.isOfficial ? (
                      <Tag label="RESMÎ" tint={colors.onBrand} background={colors.brand} />
                    ) : person.isBot ? (
                      <Tag label="UYG" tint={colors.onBrand} background={colors.brand} />
                    ) : null}
                  </View>
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    @{person.username}
                    {person.relation === "friend"
                      ? " · arkadaş"
                      : person.relation === "member"
                        ? " · ortak sunucu"
                        : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Section>

          <Section title="GRUPLAR" count={sections.groups.length}>
            {sections.groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/chat/direct/${group.id}`)}
                style={rowStyle}
                accessibilityRole="button"
              >
                {group.imageUrl ? (
                  <Avatar imageUrl={group.imageUrl} fallbackText={group.name} size={40} />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.brandSoft,
                    }}
                  >
                    <Icon name="users" size={19} color={colors.brand} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {group.members.length} üye
                  </Text>
                </View>
              </Pressable>
            ))}
          </Section>

          <Section title="SUNUCULAR" count={sections.servers.length}>
            {sections.servers.map((server) => (
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

          <Section title="KANALLAR" count={sections.channels.length}>
            {sections.channels.map((channel) => (
              <Pressable
                key={channel.id}
                onPress={() =>
                  channel.type === "TEXT"
                    ? router.push(
                        `/chat/channel/${channel.id}?serverId=${channel.server.id}`
                      )
                    : router.push(`/voice/${channel.id}?serverId=${channel.server.id}`)
                }
                style={rowStyle}
                accessibilityRole="button"
              >
                <Icon
                  name={channel.type === "TEXT" ? "hash" : "volume"}
                  size={20}
                  color={colors.muted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.text }} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                    {channel.server.name}
                  </Text>
                </View>
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
