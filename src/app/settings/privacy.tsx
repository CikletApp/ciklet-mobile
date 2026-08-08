import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ApiError, api } from "@/api/client";
import {
  useBlockedUsers,
  useAccountSessions,
  useCurrentProfile,
  useMyServers,
  useRevokeSession,
  useUnblockUser,
  useUpdateProfile,
} from "@/api/hooks";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CurrentProfile } from "@/api/types";
import { Avatar, Button, Divider, EmptyState, ListGroup, ListRow, Screen, SectionHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getDeviceId } from "@/lib/device";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type DmPermission = NonNullable<CurrentProfile["dmPermission"]>;
type SpamFilter = NonNullable<CurrentProfile["spamFilter"]>;

export default function PrivacySettingsScreen() {
  const { data: profile } = useCurrentProfile();
  const update = useUpdateProfile();
  const { data: sessions, isLoading: sessionsLoading } = useAccountSessions();
  const revoke = useRevokeSession();
  const memberships = useMyServers();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  const queryClient = useQueryClient();
  const updateServerDm = useMutation({
    mutationFn: ({ memberId, value }: { memberId: string; value: boolean }) =>
      api(endpoints.member(memberId), { method: "PATCH", body: { allowServerDMs: value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.memberships }),
  });
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const [dmPermission, setDmPermission] = useState<DmPermission>("EVERYONE");
  const [spamFilter, setSpamFilter] = useState<SpamFilter>("NON_FRIENDS");
  const [friendReqEveryone, setFriendReqEveryone] = useState(true);
  const [friendReqFriendsOfFriends, setFriendReqFriendsOfFriends] = useState(true);
  const [friendReqServerMembers, setFriendReqServerMembers] = useState(true);

  useEffect(() => {
    void getDeviceId().then(setDeviceToken);
  }, []);

  useEffect(() => {
    if (!profile) return;
    // Uzak profil tercihlerini düzenleme taslağına profil değiştiğinde al.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDmPermission(profile.dmPermission ?? "EVERYONE");
    setSpamFilter(profile.spamFilter ?? "NON_FRIENDS");
    setFriendReqEveryone(profile.friendReqEveryone ?? true);
    setFriendReqFriendsOfFriends(profile.friendReqFriendsOfFriends ?? true);
    setFriendReqServerMembers(profile.friendReqServerMembers ?? true);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = Boolean(
    profile &&
      (dmPermission !== (profile.dmPermission ?? "EVERYONE") ||
        spamFilter !== (profile.spamFilter ?? "NON_FRIENDS") ||
        friendReqEveryone !== (profile.friendReqEveryone ?? true) ||
        friendReqFriendsOfFriends !== (profile.friendReqFriendsOfFriends ?? true) ||
        friendReqServerMembers !== (profile.friendReqServerMembers ?? true))
  );

  const save = () => {
    if (!dirty || update.isPending) return;
    update.mutate({
      dmPermission,
      spamFilter,
      friendReqEveryone,
      friendReqFriendsOfFriends,
      friendReqServerMembers,
    });
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Gizlilik ve Sosyal",
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={!dirty || update.isPending}
              accessibilityRole="button"
              accessibilityLabel="Gizlilik ayarlarını kaydet"
            >
              {update.isPending ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text style={{ ...typography.bodyStrong, color: dirty ? colors.brand : colors.muted }}>
                  Kaydet
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="SANA KİM MESAJ GÖNDEREBİLİR?" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <RadioOption
            title="Herkes"
            description="Tüm kullanıcılar sana doğrudan mesaj gönderebilir."
            selected={dmPermission === "EVERYONE"}
            onPress={() => setDmPermission("EVERYONE")}
          />
          <RadioOption
            title="Sadece arkadaşlar"
            description="Yalnızca arkadaşların doğrudan mesaj gönderebilir."
            selected={dmPermission === "FRIENDS_ONLY"}
            onPress={() => setDmPermission("FRIENDS_ONLY")}
          />
          <RadioOption
            title="Hiç kimse"
            description="Yeni doğrudan mesaj isteklerini kapatır."
            selected={dmPermission === "NOBODY"}
            onPress={() => setDmPermission("NOBODY")}
          />
        </View>

        <SectionHeader title="DM SPAM FİLTRESİ" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {([
            ["ALL", "Tümünü filtrele", "Bütün yeni DM'leri denetler."],
            ["NON_FRIENDS", "Arkadaş olmayanları filtrele", "Tanımadığın kişilerden gelenleri denetler."],
            ["NONE", "Filtreleme", "Otomatik spam denetimini kapatır."],
          ] as const).map(([value, title, description]) => (
            <RadioOption
              key={value}
              title={title}
              description={description}
              selected={spamFilter === value}
              onPress={() => setSpamFilter(value)}
            />
          ))}
        </View>

        <SectionHeader title="ARKADAŞLIK İSTEKLERİ" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow title="Herkes" value={friendReqEveryone} onChange={setFriendReqEveryone} />
            <Divider inset={16} />
            <ToggleRow
              title="Arkadaşların arkadaşları"
              value={friendReqFriendsOfFriends}
              onChange={setFriendReqFriendsOfFriends}
            />
            <Divider inset={16} />
            <ToggleRow
              title="Aynı sunucudaki üyeler"
              value={friendReqServerMembers}
              onChange={setFriendReqServerMembers}
            />
          </ListGroup>
        </View>

        {update.isError ? (
          <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>
            {update.error instanceof ApiError ? update.error.message : "Ayarlar kaydedilemedi."}
          </Text>
        ) : null}

        <SectionHeader title="SUNUCU MESAJLARI" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {memberships.data?.length ? (
            <ListGroup>
              {memberships.data.map((membership, index) => (
                <View key={membership.id}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: spacing.lg, gap: spacing.md }}>
                    <Avatar imageUrl={membership.server.imageUrl} fallbackText={membership.server.name} size={34} shape="squircle" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.text }}>{membership.server.name}</Text>
                      <Text style={{ ...typography.caption, color: colors.muted }}>Sunucu üyelerinden DM al</Text>
                    </View>
                    <Switch
                      value={membership.allowServerDMs !== false}
                      disabled={updateServerDm.isPending}
                      onValueChange={(value) => updateServerDm.mutate({ memberId: membership.id, value })}
                      trackColor={{ false: colors.deep, true: colors.brand }}
                      thumbColor={colors.bright}
                    />
                  </View>
                </View>
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="users" title="Sunucu yok" description="Sunucu bazlı DM tercihi bulunmuyor." />
          )}
        </View>

        <SectionHeader title="ENGELLENEN KULLANICILAR" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {(blocked.data?.pages.flatMap((page) => page.items).length ?? 0) > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <ListGroup>
                {blocked.data?.pages.flatMap((page) => page.items).map((entry, index) => (
                  <View key={entry.friendId}>
                    {index > 0 ? <Divider inset={52} /> : null}
                    <ListRow
                      leading={<Avatar profileId={entry.profile.id} imageUrl={entry.profile.imageUrl} fallbackText={entry.profile.username} size={36} />}
                      title={entry.profile.name?.trim() || entry.profile.username}
                      subtitle={`@${entry.profile.username}`}
                      detail="Engeli kaldır"
                      chevron={false}
                      disabled={unblock.isPending}
                      onPress={() => Alert.alert("Engeli kaldır", `@${entry.profile.username} yeniden sana ulaşabilecek.`, [
                        { text: "Vazgeç", style: "cancel" },
                        { text: "Kaldır", onPress: () => unblock.mutate(entry.profile.id) },
                      ])}
                    />
                  </View>
                ))}
              </ListGroup>
              {blocked.hasNextPage ? <Button label="Daha Fazla Göster" variant="secondary" onPress={() => void blocked.fetchNextPage()} loading={blocked.isFetchingNextPage} fullWidth /> : null}
            </View>
          ) : blocked.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <EmptyState icon="shield" title="Engellenen kimse yok" description="Engellediğin kullanıcılar burada görünür." />
          )}
        </View>

        <SectionHeader title="ETKİN CİHAZLAR" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {sessionsLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : sessions?.length ? (
            <ListGroup>
              {sessions.map((session, index) => {
                const current = session.deviceToken === deviceToken;
                return (
                  <View key={session.id}>
                    {index > 0 ? <Divider inset={52} /> : null}
                    <ListRow
                      icon="settings"
                      title={session.deviceName ?? "Bilinmeyen cihaz"}
                      subtitle={`${session.osInfo ?? "Bilinmiyor"} · ${formatDate(session.lastSeenAt)}`}
                      detail={current ? "Bu cihaz" : "Kaldır"}
                      chevron={false}
                      disabled={current || revoke.isPending}
                      onPress={() =>
                        Alert.alert(
                          "Oturumu kapat",
                          `${session.deviceName ?? "Bu cihaz"} için erişim kaldırılacak.`,
                          [
                            { text: "Vazgeç", style: "cancel" },
                            {
                              text: "Kaldır",
                              style: "destructive",
                              onPress: () => revoke.mutate(session.id),
                            },
                          ]
                        )
                      }
                    />
                  </View>
                );
              })}
            </ListGroup>
          ) : (
            <EmptyState icon="shield" title="Etkin cihaz yok" description="Oturum listesi alınamadı." />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function RadioOption({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: radii.full,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: selected ? colors.brand : colors.bright }}>
          {title}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ToggleRow({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: spacing.lg }}>
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.deep, true: colors.brand }}
        thumbColor={colors.bright}
      />
    </View>
  );
}
