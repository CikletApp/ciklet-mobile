import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { MyServerPermissions } from "@/api/types";
import { Icon } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Davet seçenekleri — web `lib/server/invite-options` + `components/invite/
 * invite-preview` + `server-settings/invites-tab` karşılığı:
 * rol veren davet, geçici üyelik, etkinliğe bağlı davet.
 */

/** `GET /api/i/[code]` → `event` (web `InviteEventCard`). */
export interface InviteEventCardData {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  channelName: string | null;
  channelType: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  coverImageUrl: string | null;
  interestedCount: number;
}

/** `GET /api/servers/[id]/invites` satırı. */
export interface ServerInviteRow {
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  paused: boolean;
  temporary?: boolean;
  inviter: { username: string; imageUrl: string | null } | null;
  channel: { id: string; name: string } | null;
  roles?: { id: string; name: string; color: string | null }[];
  event?: { id: string; name: string } | null;
}

export interface CreateInviteInput {
  maxAgeSeconds?: number;
  maxUses?: number;
  temporary: boolean;
  roleIds: string[];
  eventId: string | null;
}

/** Web davet sekmesiyle aynı seçenekler. */
export const INVITE_AGE_OPTIONS = [
  { label: "Süresiz", value: 0 },
  { label: "30 dakika", value: 1800 },
  { label: "1 saat", value: 3600 },
  { label: "1 gün", value: 86400 },
  { label: "7 gün", value: 604800 },
] as const;
export const INVITE_USE_OPTIONS = [
  { label: "Sınırsız", value: 0 },
  { label: "1 kullanım", value: 1 },
  { label: "5 kullanım", value: 5 },
  { label: "10 kullanım", value: 10 },
  { label: "25 kullanım", value: 25 },
] as const;
export const INVITE_MAX_ROLES = 10;

/** Rol veren davette seçilebilecek roller (uç ayrıca denetler). */
export function grantableInviteRoles<T extends { position: number }>(roles: T[], me: MyServerPermissions | undefined): T[] {
  if (!me) return [];
  if (me.isOwner || me.memberRole === "ADMIN") return roles;
  if (!me.keys.includes("MANAGE_ROLES") && !me.keys.includes("ADMINISTRATOR")) return [];
  return roles.filter((role) => role.position < me.topPosition);
}

/** Kalan süre — web `fmtExpiry` ile aynı metinler. */
export function formatInviteExpiry(iso: string | null): string {
  if (!iso) return "Süresiz";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Süresi doldu";
  const h = Math.floor(ms / 3.6e6);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} gün`;
  if (h > 0) return `${h} saat`;
  return `${Math.floor(ms / 60000)} dk`;
}

/** Yapıştırılan bağlantıdan kod ve (Discord'daki gibi) `?event=` kimliği. */
export function parseInviteInput(raw: string): { code: string; eventId: string | null } {
  const trimmed = raw.trim();
  const [path, query = ""] = trimmed.split("?");
  const code = path.split("/").filter(Boolean).pop() ?? path;
  const match = /(?:^|&)event=([^&]+)/.exec(query);
  return { code, eventId: match ? decodeURIComponent(match[1]) : null };
}

const invitesKey = (serverId: string) => ["server-invites", serverId] as const;

export function useServerInvites(serverId: string | undefined) {
  return useQuery({
    queryKey: invitesKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerInviteRow[]>(endpoints.serverInvites(serverId!)),
  });
}

export function useCreateServerInvite(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      api<ServerInviteRow>(endpoints.serverInvites(serverId), { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: invitesKey(serverId) }),
  });
}

export function usePauseServerInvite(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, paused }: { code: string; paused: boolean }) =>
      api(endpoints.serverInviteItem(serverId, code), { method: "PATCH", body: { paused } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: invitesKey(serverId) }),
  });
}

export function useDeleteServerInvite(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api(endpoints.serverInviteItem(serverId, code), { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: invitesKey(serverId) }),
  });
}

const eventDateFormat = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** Davete bağlı etkinlik kartı — web davet sayfasıyla aynı alanlar ve metinler. */
export function InviteEventCard({ event }: { event: InviteEventCardData }) {
  const live = event.status === "ACTIVE";
  const place = event.channelName ?? event.location;
  return (
    <View style={{ borderRadius: radii.lg, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.raised }}>
      {event.coverImageUrl ? (
        <Image source={{ uri: event.coverImageUrl }} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="cover" />
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name="clock" size={13} color={live ? colors.success : colors.muted} />
          <Text style={{ ...typography.caption, ...fw(700), color: live ? colors.success : colors.muted }}>
            {live ? "Şu an devam ediyor" : eventDateFormat.format(new Date(event.startsAt))}
          </Text>
        </View>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{event.name}</Text>
        {event.description ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md }}>
          {place ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 }}>
              <Icon name={event.channelName ? "volume" : "link"} size={13} color={colors.muted} />
              <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Icon name="users" size={13} color={colors.muted} />
            <Text style={{ ...typography.caption, color: colors.muted }}>{event.interestedCount} kişi ilgileniyor</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Geçici üyelik uyarısı — web davet sayfasıyla aynı cümle. */
export const TEMPORARY_INVITE_NOTICE =
  "Geçici üye olarak katılacaksın: sana bir rol verilmezse bağlantın kopunca sunucudan çıkarılırsın.";
