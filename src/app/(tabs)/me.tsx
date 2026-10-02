import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useCurrentProfile, useFriends, useMentolPlan } from "@/api/hooks";
import {
  Avatar,
  Divider,
  HeaderButton,
  Icon,
  ListGroup,
  ListRow,
  Pressable,
  Screen,
  SectionHeader,
  TabHeader,
  type IconName,
} from "@/components/ui";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";
import { formatActivity } from "@/lib/format";
import { setSelfPresence } from "@/realtime/provider";
import { useAuth } from "@/stores/auth";
import { usePresence, usePresenceStore } from "@/stores/presence";
import { THEME_LABELS, useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * "Sen" sekmesi — profil kartı, durum seçimi ve en sık kullanılan
 * ayarların kısayolları. Tüm ayarlar sağ üstteki düğmede.
 */

const STATUSES: { status: PresenceStatus; label: string; description: string }[] = [
  { status: PresenceStatus.ONLINE, label: "Çevrimiçi", description: "Arkadaşların seni aktif görür" },
  { status: PresenceStatus.IDLE, label: "Boşta", description: "Uzaktayım, birazdan dönerim" },
  { status: PresenceStatus.DND, label: "Rahatsız Etmeyin", description: "Arama ve bildirim kartları gösterilmez" },
  { status: PresenceStatus.INVISIBLE, label: "Görünmez", description: "Çevrimdışı görünürsün, her şeyi kullanabilirsin" },
];

function statusColor(status: PresenceStatus): string {
  if (status === PresenceStatus.ONLINE) return colors.online;
  if (status === PresenceStatus.IDLE) return colors.idle;
  if (status === PresenceStatus.DND) return colors.dnd;
  return colors.offline;
}

export default function MeScreen() {
  const sessionProfile = useAuth((s) => s.profile);
  const { data: profile } = useCurrentProfile();
  const { accepted, incoming } = useFriends();
  // Seçicideki ✓ ELLE seçilen durumu gösterir; otomatik boşta onu değiştirmez.
  const selfManual = usePresenceStore((s) => s.selfManual);
  // Sunucudan gerçek durum gelmeden varsayılan ONLINE'a ✓ konmaz.
  const selfKnown = usePresenceStore((s) => s.selfKnown);
  const preference = useTheme((s) => s.preference);
  const plan = useMentolPlan();

  const me = profile ?? sessionProfile;
  // Oturum profili (giriş yanıtı) afişi taşımıyor; yalnızca /current-profile taşır.
  const bannerUrl = (me as { bannerUrl?: string | null } | null)?.bannerUrl ?? null;
  const activity = formatActivity(usePresence(me?.id).activity);

  return (
    <Screen edges={["top", "left", "right"]}>
      <TabHeader
        title="Sen"
        right={<HeaderButton icon="settings" label="Tüm ayarlar" onPress={() => router.push("/settings")} />}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: FLOATING_TAB_INSET + spacing.lg }}>
        {/* Profil kartı — web'deki profil kartıyla aynı dil: bant rengi + avatar. */}
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.bentoBorder }}>
          {/* Afiş: görsel varsa görsel (web ile aynı öncelik), yoksa bant rengi.
              Görsel hiç çizilmediği için yüklenen afiş yerine hep düz renk
              görünüyordu. */}
          <View style={{ height: 84, backgroundColor: me?.bannerColor ?? colors.brandSoft }}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} contentFit="cover" transition={150} style={{ width: "100%", height: "100%" }} />
            ) : null}
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -38 }}>
              <View style={{ borderRadius: 44, borderWidth: 5, borderColor: colors.panel }}>
                <Avatar profileId={me?.id} imageUrl={me?.imageUrl} fallbackText={me?.username} size={78} showPresence backgroundColor={colors.panel} />
              </View>
              <Pressable
                onPress={() => router.push("/profile/edit")}
                haptic="light"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 38,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.full,
                  backgroundColor: colors.brand,
                  opacity: pressed ? 0.85 : 1,
                  marginBottom: spacing.xs,
                })}
              >
                <Icon name="pencil" size={15} color={colors.onBrand} />
                <Text style={{ ...typography.caption, fontSize: 14, ...fw(700), color: colors.onBrand }}>Düzenle</Text>
              </Pressable>
            </View>
            <Text style={{ ...typography.display, color: colors.bright, marginTop: spacing.sm }} numberOfLines={1}>
              {me?.name?.trim() || me?.username || "—"}
            </Text>
            <Text style={{ ...typography.body, color: colors.muted }} numberOfLines={1}>
              {me?.username ? `@${me.username}` : ""}
              {me?.pronouns ? ` · ${me.pronouns}` : ""}
            </Text>
            {activity ? (
              <Text style={{ ...typography.caption, color: colors.brand, marginTop: spacing.xs }} numberOfLines={1}>
                {activity}
              </Text>
            ) : null}
            {me?.bio ? (
              <Text style={{ ...typography.body, color: colors.text, marginTop: spacing.sm }} numberOfLines={3}>
                {me.bio}
              </Text>
            ) : null}
          </View>
        </View>

        <SectionHeader title="DURUMUN" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            {STATUSES.map((item, index) => {
              const active = selfKnown && selfManual === item.status;
              return (
                <View key={item.status}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    title={item.label}
                    subtitle={item.description}
                    chevron={false}
                    onPress={() => setSelfPresence(item.status)}
                    leading={
                      <View style={{ width: 24, alignItems: "center" }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: statusColor(item.status) }} />
                      </View>
                    }
                    trailing={active ? <Icon name="check" size={19} color={colors.brand} /> : undefined}
                  />
                </View>
              );
            })}
          </ListGroup>
        </View>

        <SectionHeader title="KISAYOLLAR" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <Shortcut icon="users" title="Arkadaşların" detail={incoming.length > 0 ? `${incoming.length} istek` : String(accepted.length)} onPress={() => router.push("/friends")} />
            <Divider inset={52} />
            <Shortcut icon="palette" title="Görünüm" detail={preference === "system" ? "Sistem" : THEME_LABELS[preference]} onPress={() => router.push("/settings/appearance")} />
            <Divider inset={52} />
            <Shortcut icon="sparkles" title="Mentol" detail={plan.data?.features.label} onPress={() => router.push("/settings/mentol")} />
            <Divider inset={52} />
            <Shortcut icon="bell" title="Bildirim ayarları" onPress={() => router.push("/settings/notifications")} />
            <Divider inset={52} />
            <Shortcut icon="shield" title="Gizlilik" onPress={() => router.push("/settings/privacy")} />
          </ListGroup>
        </View>

        {me?.createdAt ? (
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", paddingTop: spacing.xl }}>
            {new Date(me.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinden beri Ciklet’te
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Shortcut({ icon, title, detail, onPress }: { icon: IconName; title: string; detail?: string; onPress: () => void }) {
  return <ListRow icon={icon} title={title} detail={detail} onPress={onPress} />;
}
