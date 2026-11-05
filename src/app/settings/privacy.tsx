import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { api } from "@/api/client";
import {
  useBlockedUsers,
  useAccountSessions,
  useIgnoredUsers,
  useSetIgnored,
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
import { Avatar, Button, Divider, EmptyState, ListGroup, ListRow, Screen, SectionHeader, showDialog, showToast } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getDeviceId } from "@/lib/device";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { GameStatsPrivacySection } from "@/features/profile/game-stats-privacy";
import { profileExtras, useRevokeOtherSessions } from "@/api/hooks/use-account-privacy";
import {
  AgeSafetySection,
  ConsentsSection,
  DataRightsSection,
  KvkkRequestSection,
  LegalLinksSection,
} from "@/features/account/privacy-compliance";
import { useT } from "@/lib/i18n";
import { userErrorMessage } from "@/lib/user-error";

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
  const ignoredUsers = useIgnoredUsers();
  const setIgnored = useSetIgnored();
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
  const [blurSensitive, setBlurSensitive] = useState(true);
  const [groupDmFromServerMembers, setGroupDmFromServerMembers] = useState(false);
  const t = useT();
  const revokeOthers = useRevokeOtherSessions();
  const extras = profileExtras(profile);
  const teenSafe = extras.age?.teenSafe === true;

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
    setBlurSensitive(profileExtras(profile).blurSensitiveMedia ?? true);
    setGroupDmFromServerMembers(profileExtras(profile).groupDmFromServerMembers ?? false);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = Boolean(
    profile &&
      (dmPermission !== (profile.dmPermission ?? "EVERYONE") ||
        spamFilter !== (profile.spamFilter ?? "NON_FRIENDS") ||
        friendReqEveryone !== (profile.friendReqEveryone ?? true) ||
        friendReqFriendsOfFriends !== (profile.friendReqFriendsOfFriends ?? true) ||
        friendReqServerMembers !== (profile.friendReqServerMembers ?? true) ||
        blurSensitive !== (extras.blurSensitiveMedia ?? true) ||
        groupDmFromServerMembers !== (extras.groupDmFromServerMembers ?? false))
  );

  const save = () => {
    if (!dirty || update.isPending) return;
    // blurSensitiveMedia / groupDmFromServerMembers: web `PATCH /api/current-profile` alanları.
    const input = {
      dmPermission,
      spamFilter,
      friendReqEveryone,
      friendReqFriendsOfFriends,
      friendReqServerMembers,
      blurSensitiveMedia: blurSensitive,
      groupDmFromServerMembers,
    };
    update.mutate(input);
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
        <AgeSafetySection />

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
              disabled={teenSafe && value === "NONE"}
              onPress={() => setSpamFilter(value)}
            />
          ))}
          {teenSafe ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.age.spamLocked")}</Text> : null}
        </View>

        <SectionHeader title={t("settingsGeneral.privacy.sensitive.title").toLocaleUpperCase()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsGeneral.privacy.sensitive.desc")}</Text>
          <RadioOption
            title={t("settingsGeneral.privacy.sensitive.blur.label")}
            description={t("settingsGeneral.privacy.sensitive.blur.desc")}
            selected={blurSensitive}
            onPress={() => setBlurSensitive(true)}
          />
          <RadioOption
            title={t("settingsGeneral.privacy.sensitive.show.label")}
            description={t("settingsGeneral.privacy.sensitive.show.desc")}
            selected={!blurSensitive}
            disabled={teenSafe}
            onPress={() => setBlurSensitive(false)}
          />
          {teenSafe ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.age.sensitiveLocked")}</Text> : null}
        </View>

        <SectionHeader title={t("settingsGeneral.privacy.groupDm.title").toLocaleUpperCase()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsGeneral.privacy.groupDm.desc")}</Text>
          <ListGroup>
            <ToggleRow
              title={t("settingsGeneral.privacy.groupDm.label")}
              description={t("settingsGeneral.privacy.groupDm.labelDesc")}
              value={groupDmFromServerMembers}
              onChange={setGroupDmFromServerMembers}
            />
          </ListGroup>
        </View>

        <SectionHeader title="ARKADAŞLIK İSTEKLERİ" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow title="Herkes" value={friendReqEveryone} onChange={setFriendReqEveryone} />
            <Divider inset={16} />
            <ToggleRow
              title="Arkadaşların arkadaşları"
              disabled={friendReqEveryone}
              value={friendReqEveryone || friendReqFriendsOfFriends}
              onChange={setFriendReqFriendsOfFriends}
            />
            <Divider inset={16} />
            <ToggleRow
              title="Aynı sunucudaki üyeler"
              disabled={friendReqEveryone}
              value={friendReqEveryone || friendReqServerMembers}
              onChange={setFriendReqServerMembers}
            />
          </ListGroup>
        </View>

        {update.isError ? (
          <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>
            {userErrorMessage(update.error, "Ayarlar kaydedilemedi.")}
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
                      trackColor={{ false: colors.border, true: colors.brand }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="users" title="Sunucu yok" description="Sunucu bazlı DM tercihi bulunmuyor." />
          )}
        </View>

        <GameStatsPrivacySection />

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
                      onPress={() => showDialog("Engeli kaldır", `@${entry.profile.username} yeniden sana ulaşabilecek.`, [
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

        <SectionHeader title="YOKSAYILAN KULLANICILAR" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {"Yoksaydığın kişilerin mesajları daraltılır, sana bildirim göndermez, etkinlikleri ve DM'leri gizlenir. Onlara haber verilmez ve seni görmeye devam ederler."}
          </Text>
          {(ignoredUsers.data?.length ?? 0) > 0 ? (
            <ListGroup>
              {ignoredUsers.data?.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    leading={<Avatar profileId={entry.id} imageUrl={entry.imageUrl} fallbackText={entry.username} size={36} />}
                    title={entry.name?.trim() || entry.username}
                    subtitle={`@${entry.username}`}
                    detail="Yoksaymayı Bırak"
                    chevron={false}
                    disabled={setIgnored.isPending}
                    onPress={() =>
                      setIgnored.mutate(
                        { profileId: entry.id, ignored: false },
                        {
                          onSuccess: () => showToast(`${entry.name?.trim() || entry.username} artık yoksayılmıyor.`),
                          onError: () => showToast("İşlem tamamlanamadı. Tekrar dene.", "error"),
                        }
                      )
                    }
                  />
                </View>
              ))}
            </ListGroup>
          ) : ignoredUsers.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <EmptyState icon="bell-off" title="Kimseyi yoksaymadın" description="Yoksaydığın kullanıcılar burada görünür." />
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
                        showDialog(
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
          {(sessions?.length ?? 0) > 1 ? (
            <Button
              label={revokeOthers.isPending ? t("settingsAccount.sessions.revokingOthers") : t("settingsAccount.sessions.revokeOthers")}
              variant="danger"
              fullWidth
              loading={revokeOthers.isPending}
              style={{ marginTop: spacing.sm }}
              onPress={() =>
                showDialog(t("settingsAccount.sessions.revokeOthers"), "", [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: t("settingsAccount.sessions.revokeOthers"),
                    style: "destructive",
                    onPress: () =>
                      revokeOthers.mutate(undefined, {
                        onSuccess: () => showToast(t("settingsAccount.sessions.revokeOthersDone")),
                        onError: () => showToast(t("settingsAccount.sessions.revokeOthersFailed"), "error"),
                      }),
                  },
                ])
              }
            />
          ) : null}
        </View>

        <ConsentsSection />
        <DataRightsSection />
        <KvkkRequestSection />
        <LegalLinksSection />
      </ScrollView>
    </Screen>
  );
}

function RadioOption({
  title,
  description,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : 1,
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

function ToggleRow({
  title,
  description,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: spacing.lg, gap: spacing.md, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, paddingVertical: spacing.sm }}>
        <Text style={{ ...typography.body, color: colors.text }}>{title}</Text>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
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
