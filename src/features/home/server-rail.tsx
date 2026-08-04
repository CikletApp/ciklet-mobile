import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useMyServers, useUnreadCounts } from "@/api/hooks";
import type { MembershipWithServer } from "@/api/types";
import { Avatar, Icon, Pressable, UnreadBadge } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sol dikey sunucu rayı.
 *
 * Seçim ekran DEĞİŞTİRMEZ — ray her zaman görünür kalır ve içerik yanında
 * açılır (bkz. app/(tabs)/index.tsx). Mobilde ray kaybolunca sunucular
 * arasında geçmek için her seferinde geri gitmek gerekiyordu.
 *
 * Şekil, seçim durumunu taşır: **pasif sunucu yuvarlak, aktif sunucu
 * kare-yuvarlak (squircle)**. Ayrıca solda ince bir gösterge çubuğu belirir.
 *
 * Klasörler `GET /api/members/mine` yanıtındaki `folderId` / `orderInFolder`
 * alanlarından kurulur. Klasörün ADI sunucudan gelmiyor (bkz. api/types.ts),
 * bu yüzden başlık yerine içindeki sunucu sayısı gösterilir.
 */

const TILE = 48;

export interface RailSelection {
  /** `null` = doğrudan mesajlar görünümü. */
  serverId: string | null;
}

export function ServerRail({
  selectedServerId,
  onSelect,
}: {
  selectedServerId: string | null;
  onSelect: (serverId: string | null) => void;
}) {
  const { data: memberships } = useMyServers();
  const { data: unread } = useUnreadCounts();
  const me = useAuth((s) => s.profile);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const { folders, loose } = useMemo(
    () => groupByFolder(memberships ?? []),
    [memberships]
  );

  const toggleFolder = (folderId: string) =>
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });

  const serverUnread = (serverId: string) => unread?.serverUnreads?.[serverId] ?? 0;

  return (
    <View
      style={{
        width: 72,
        backgroundColor: colors.deep,
        alignItems: "center",
        paddingTop: spacing.md,
      }}
    >
      {/* Doğrudan mesajlar — kullanıcının kendi avatarı. Presence noktası
          yok: bu bir durum göstergesi değil, sekme göstergesi. */}
      <RailTile
        active={selectedServerId === null}
        onPress={() => onSelect(null)}
        accessibilityLabel="Doğrudan mesajlar"
      >
        <Avatar
          imageUrl={me?.imageUrl}
          fallbackText={me?.username}
          size={TILE}
          shape={selectedServerId === null ? "squircle" : "circle"}
          backgroundColor={colors.deep}
        />
      </RailTile>

      <View
        style={{
          width: 28,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.border,
          marginVertical: spacing.sm,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", gap: spacing.sm, paddingBottom: spacing.lg }}
      >
        {folders.map((folder) => {
          const isOpen = openFolders.has(folder.id);
          const folderUnread = folder.members.reduce(
            (sum, m) => sum + serverUnread(m.serverId),
            0
          );
          const holdsActive = folder.members.some(
            (m) => m.serverId === selectedServerId
          );

          return (
            <View key={folder.id} style={{ alignItems: "center", gap: spacing.sm }}>
              <RailTile
                active={holdsActive && !isOpen}
                onPress={() => toggleFolder(folder.id)}
                accessibilityLabel={`Klasör, ${folder.members.length} sunucu${isOpen ? ", açık" : ", kapalı"}`}
                badge={isOpen ? 0 : folderUnread}
              >
                <FolderTile members={folder.members} open={isOpen} />
              </RailTile>

              {isOpen
                ? folder.members.map((membership) => (
                    <ServerTile
                      key={membership.serverId}
                      membership={membership}
                      active={membership.serverId === selectedServerId}
                      unread={serverUnread(membership.serverId)}
                      onPress={() => onSelect(membership.serverId)}
                      inFolder
                    />
                  ))
                : null}
            </View>
          );
        })}

        {loose.map((membership) => (
          <ServerTile
            key={membership.serverId}
            membership={membership}
            active={membership.serverId === selectedServerId}
            unread={serverUnread(membership.serverId)}
            onPress={() => onSelect(membership.serverId)}
          />
        ))}

        <RailTile
          onPress={() => router.push("/servers/new")}
          accessibilityLabel="Sunucu ekle"
        >
          <View
            style={{
              width: TILE,
              height: TILE,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.panel,
            }}
          >
            <Icon name="plus" size={22} color={colors.brand} />
          </View>
        </RailTile>
      </ScrollView>
    </View>
  );
}

function ServerTile({
  membership,
  active,
  unread,
  onPress,
  inFolder,
}: {
  membership: MembershipWithServer;
  active: boolean;
  unread: number;
  onPress: () => void;
  inFolder?: boolean;
}) {
  return (
    <RailTile
      active={active}
      onPress={onPress}
      accessibilityLabel={`${membership.server.name} sunucusu`}
      badge={unread}
      indent={inFolder}
    >
      <Avatar
        imageUrl={membership.server.imageUrl}
        fallbackText={membership.server.name}
        size={inFolder ? TILE - 8 : TILE}
        // Şekil seçim durumunu taşır: pasif yuvarlak, aktif squircle.
        shape={active ? "squircle" : "circle"}
        backgroundColor={colors.deep}
      />
    </RailTile>
  );
}

/** Klasör kapağı — içindeki ilk dört sunucunun 2×2 küçük ızgarası. */
function FolderTile({
  members,
  open,
}: {
  members: MembershipWithServer[];
  open: boolean;
}) {
  if (open) {
    return (
      <View
        style={{
          width: TILE,
          height: TILE,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.panel,
        }}
      >
        <Icon name="chevron-down" size={20} color={colors.brand} />
      </View>
    );
  }

  return (
    <View
      style={{
        width: TILE,
        height: TILE,
        borderRadius: radii.md,
        backgroundColor: colors.panel,
        padding: 4,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      {members.slice(0, 4).map((membership) => (
        <Avatar
          key={membership.serverId}
          imageUrl={membership.server.imageUrl}
          fallbackText={membership.server.name}
          size={18}
          shape="circle"
          backgroundColor={colors.panel}
        />
      ))}
    </View>
  );
}

/** Ortak dokunma kabı: seçim göstergesi ve okunmamış rozeti. */
function RailTile({
  children,
  onPress,
  active,
  badge = 0,
  indent,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  badge?: number;
  indent?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View style={{ justifyContent: "center" }}>
      {/* Soldaki seçim çubuğu — şekil değişimini destekleyen ikinci ipucu. */}
      <View
        style={{
          position: "absolute",
          left: -12,
          width: 4,
          height: active ? 28 : 0,
          borderRadius: 2,
          backgroundColor: colors.bright,
        }}
      />
      <Pressable
        onPress={onPress}
        haptic="light"
        noHitSlop
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => ({
          marginLeft: indent ? spacing.sm : 0,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {children}
        {badge > 0 ? (
          <View style={{ position: "absolute", right: -4, top: -4 }}>
            <UnreadBadge count={badge} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * Üyelikleri klasörlere ayırır.
 * Sıralama sunucudan gelen `order` / `orderInFolder` alanlarına uyar.
 */
function groupByFolder(memberships: MembershipWithServer[]) {
  const byFolder = new Map<string, MembershipWithServer[]>();
  const loose: MembershipWithServer[] = [];

  for (const membership of memberships) {
    if (membership.folderId) {
      const bucket = byFolder.get(membership.folderId);
      if (bucket) bucket.push(membership);
      else byFolder.set(membership.folderId, [membership]);
    } else {
      loose.push(membership);
    }
  }

  const folders = [...byFolder.entries()].map(([id, members]) => ({
    id,
    members: members.sort(
      (a, b) => (a.orderInFolder ?? 0) - (b.orderInFolder ?? 0)
    ),
  }));

  loose.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return { folders, loose };
}

/** Klasörsüz kullanım için dışa açık yardımcı (test/ekranlar). */
export { groupByFolder };

/** Ray başlığında kullanılan tipografi — dışarıdan da tutarlı kalsın. */
export const railLabelStyle = { ...typography.caption, color: colors.muted };
