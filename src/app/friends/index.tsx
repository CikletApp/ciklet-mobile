import { useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { router, Stack } from "expo-router";

import {
  useAcceptFriendRequest,
  useFriends,
  useOpenDirect,
  useRemoveFriend,
  type FriendEntry,
} from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  ListRow,
  ListSkeleton,
  Pressable,
  Screen,
  SegmentedTabs,
} from "@/components/ui";
import { displayNameOf, initialOf } from "@/lib/format";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Arkadaş listesi.
 *
 * Üç sekme: Arkadaşlar / Bekleyen / Gönderilen. Bekleyen istekler ayrı bir
 * sekmede çünkü liste içinde karıştırıldığında kabul/reddet düğmeleri
 * yanlışlıkla dokunulabilecek kadar yakın duruyor.
 *
 * Kabul edilmiş arkadaşlar baş harfe göre bölümlenir; sıralama Türkçe
 * yerel ayarıyla yapılır (aksi halde ı/i, ö/o, ş/s yanlış yere düşer).
 */
type Tab = "friends" | "incoming" | "outgoing";

export default function FriendsScreen() {
  const [tab, setTab] = useState<Tab>("friends");
  const { accepted, incoming, outgoing, isLoading } = useFriends();
  const openDirect = useOpenDirect();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();

  const sections = useMemo(() => {
    if (tab === "incoming") {
      return incoming.length ? [{ title: "SENİ EKLEMEK İSTEYENLER", data: incoming }] : [];
    }
    if (tab === "outgoing") {
      return outgoing.length ? [{ title: "YANIT BEKLEYENLER", data: outgoing }] : [];
    }

    const buckets = new Map<string, FriendEntry[]>();
    for (const entry of accepted) {
      const letter = initialOf(displayNameOf(entry.profile));
      const bucket = buckets.get(letter);
      if (bucket) bucket.push(entry);
      else buckets.set(letter, [entry]);
    }

    return [...buckets]
      .sort(([a], [b]) => a.localeCompare(b, "tr"))
      .map(([title, data]) => ({ title, data }));
  }, [tab, accepted, incoming, outgoing]);

  const onOpenChat = (profileId: string) =>
    openDirect.mutate(profileId, {
      onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
    });

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/friends/add")}
              haptic="light"
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

      <SegmentedTabs
        items={[
          { id: "friends" as const, label: "Arkadaşlar", count: accepted.length },
          { id: "incoming" as const, label: "Bekleyen", count: incoming.length },
          { id: "outgoing" as const, label: "Gönderilen", count: outgoing.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <ListSkeleton />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="users"
          title={EMPTY_TITLE[tab]}
          description={EMPTY_DESCRIPTION[tab]}
          action={
            tab === "friends" ? (
              <Button
                label="Arkadaş Ekle"
                icon="user-plus"
                onPress={() => router.push("/friends/add")}
              />
            ) : undefined
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
                paddingBottom: spacing.xs,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ListRow
              title={displayNameOf(item.profile)}
              subtitle={`@${item.profile.username}`}
              onPress={() => router.push(`/profile/${item.profile.id}`)}
              chevron={false}
              leading={
                <Avatar
                  profileId={item.profile.id}
                  imageUrl={item.profile.imageUrl}
                  fallbackText={item.profile.username}
                  size={44}
                  showPresence
                />
              }
              trailing={
                <RowActions
                  tab={tab}
                  onMessage={() => onOpenChat(item.profile.id)}
                  onAccept={() => acceptRequest.mutate(item.id)}
                  onRemove={() => removeFriend.mutate(item.id)}
                />
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function RowActions({
  tab,
  onMessage,
  onAccept,
  onRemove,
}: {
  tab: Tab;
  onMessage: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  if (tab === "incoming") {
    return (
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <IconButton
          icon="check"
          label="Kabul et"
          tint={colors.success}
          onPress={onAccept}
          haptic="success"
        />
        <IconButton
          icon="close"
          label="Reddet"
          tint={colors.danger}
          onPress={onRemove}
          haptic="warning"
        />
      </View>
    );
  }

  if (tab === "outgoing") {
    return (
      <IconButton
        icon="close"
        label="İsteği geri al"
        tint={colors.muted}
        onPress={onRemove}
        haptic="warning"
      />
    );
  }

  return (
    <IconButton
      icon="message"
      label="Mesaj gönder"
      tint={colors.muted}
      onPress={onMessage}
    />
  );
}

const EMPTY_TITLE: Record<Tab, string> = {
  friends: "Henüz arkadaşın yok",
  incoming: "Bekleyen istek yok",
  outgoing: "Gönderilmiş istek yok",
};

const EMPTY_DESCRIPTION: Record<Tab, string> = {
  friends: "Kullanıcı adıyla arama yaparak arkadaş ekleyebilirsin.",
  incoming: "Sana arkadaşlık isteği geldiğinde burada görünecek.",
  outgoing: "Gönderdiğin istekler yanıtlanana kadar burada bekler.",
};
