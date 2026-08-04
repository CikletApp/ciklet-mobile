import { useMemo } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { router, Stack } from "expo-router";

import {
  displayName,
  useAcceptFriendRequest,
  useFriends,
  useOpenDirect,
  useRemoveFriend,
  type FriendEntry,
} from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Arkadaş listesi.
 *
 * Bekleyen istekler en üstte ayrı bölümde; kabul edilmiş arkadaşlar
 * baş harfe göre bölümlenir (Türkçe sıralama — `localeCompare(…, "tr")`,
 * aksi halde ı/i, ö/o, ş/s yanlış yere düşer).
 */
export default function FriendsScreen() {
  const { accepted, incoming, isLoading } = useFriends();
  const openDirect = useOpenDirect();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();

  const sections = useMemo(() => {
    const result: { title: string; kind: "request" | "friend"; data: FriendEntry[] }[] =
      [];

    if (incoming.length > 0) {
      result.push({
        title: `ARKADAŞLIK İSTEKLERİ — ${incoming.length}`,
        kind: "request",
        data: incoming,
      });
    }

    const buckets = new Map<string, FriendEntry[]>();
    for (const entry of accepted) {
      const letter = displayName(entry.profile).charAt(0).toLocaleUpperCase("tr");
      const bucket = buckets.get(letter);
      if (bucket) bucket.push(entry);
      else buckets.set(letter, [entry]);
    }

    for (const [letter, data] of [...buckets].sort(([a], [b]) =>
      a.localeCompare(b, "tr")
    )) {
      result.push({ title: letter, kind: "friend", data });
    }

    return result;
  }, [accepted, incoming]);

  const onOpenChat = (profileId: string) => {
    openDirect.mutate(profileId, {
      onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
    });
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/friends/add")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Arkadaş ekle"
            >
              <Text style={{ ...typography.bodyStrong, color: colors.brand }}>
                Ekle
              </Text>
            </Pressable>
          ),
        }}
      />

      {sections.length === 0 ? (
        <EmptyState
          icon="users"
          title={isLoading ? "Yükleniyor…" : "Henüz arkadaşın yok"}
          description={
            isLoading ? undefined : "Kullanıcı adıyla arama yaparak arkadaş ekleyebilirsin."
          }
          action={
            isLoading ? undefined : (
              <Pressable
                onPress={() => router.push("/friends/add")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  borderRadius: radii.full,
                  backgroundColor: colors.brand,
                }}
              >
                <Icon name="user-plus" size={18} color={colors.onBrand} />
                <Text style={{ ...typography.bodyStrong, color: colors.onBrand }}>
                  Arkadaş Ekle
                </Text>
              </Pressable>
            )
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                ...typography.overline,
                color: colors.muted,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item, section }) => (
            <FriendRow
              entry={item}
              pending={section.kind === "request"}
              onPress={() => router.push(`/profile/${item.profile.id}`)}
              onMessage={() => onOpenChat(item.profile.id)}
              onAccept={() => acceptRequest.mutate(item.id)}
              onReject={() => removeFriend.mutate(item.id)}
            />
          )}
        />
      )}
    </Screen>
  );
}

function FriendRow({
  entry,
  pending,
  onPress,
  onMessage,
  onAccept,
  onReject,
}: {
  entry: FriendEntry;
  pending: boolean;
  onPress: () => void;
  onMessage: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { profile } = entry;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName(profile)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.panel : "transparent",
      })}
    >
      <Avatar
        profileId={profile.id}
        imageUrl={profile.imageUrl}
        fallbackText={profile.username}
        size={40}
        showPresence
      />

      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {displayName(profile)}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
          @{profile.username}
        </Text>
      </View>

      {pending ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton icon="check" tint={colors.success} onPress={onAccept} label="Kabul et" />
          <IconButton icon="close" tint={colors.danger} onPress={onReject} label="Reddet" />
        </View>
      ) : (
        <IconButton icon="message" tint={colors.muted} onPress={onMessage} label="Mesaj gönder" />
      )}
    </Pressable>
  );
}

function IconButton({
  icon,
  tint,
  onPress,
  label,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  tint: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.panel,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={18} color={tint} />
    </Pressable>
  );
}
