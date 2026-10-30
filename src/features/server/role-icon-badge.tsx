import { Text } from "react-native";
import { Image } from "expo-image";

import { emojify } from "@/components/ui";

/**
 * Rol simgesi (Discord "role icon") — ciklet-web `lib/roles` +
 * `components/role-icon-badge` karşılığı. Kural aynı: simgesi olan roller
 * içinde EN YÜKSEK konumlu olanınki; görsel varsa görsel, yoksa emoji.
 * Ağ geçidinden gelen canlı mesaj rolleri değil yalnızca hesaplanmış simgeyi
 * (`member.roleIcon`) taşır.
 */
export interface RoleIcon {
  url: string | null;
  emoji: string | null;
  name: string;
}

interface RoleWithIcon {
  name?: string;
  position?: number;
  iconUrl?: string | null;
  iconEmoji?: string | null;
}

export function roleIconFromRoles(roles: readonly RoleWithIcon[] | null | undefined): RoleIcon | null {
  if (!roles || roles.length === 0) return null;
  const top = roles
    .filter((role) => Boolean(role.iconUrl) || Boolean(role.iconEmoji))
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0];
  if (!top) return null;
  return { url: top.iconUrl || null, emoji: top.iconUrl ? null : top.iconEmoji || null, name: top.name ?? "" };
}

/** Zarftaki ham simgeyi doğrular (web `parseRoleIcon`). */
export function parseRoleIcon(raw: unknown): RoleIcon | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const url = typeof value.url === "string" && /^https:\/\//.test(value.url) ? value.url : null;
  const emoji = typeof value.emoji === "string" && value.emoji ? value.emoji : null;
  if (!url && !emoji) return null;
  return { url, emoji: url ? null : emoji, name: typeof value.name === "string" ? value.name : "" };
}

/** Mesajın / üyenin simgesi: önce zarftaki hazır simge, yoksa rollerden. */
export function memberRoleIcon(member: { roleIcon?: unknown; roles?: readonly RoleWithIcon[] | null } | null | undefined): RoleIcon | null {
  if (!member) return null;
  return parseRoleIcon(member.roleIcon) ?? roleIconFromRoles(member.roles);
}

export function RoleIconBadge({ icon, size = 16 }: { icon: RoleIcon | null | undefined; size?: number }) {
  if (!icon || (!icon.url && !icon.emoji)) return null;
  const label = icon.name ? `${icon.name} rol simgesi` : "Rol simgesi";
  if (icon.url) {
    return (
      <Image
        source={{ uri: icon.url }}
        recyclingKey={icon.url}
        cachePolicy="memory-disk"
        contentFit="contain"
        accessibilityLabel={label}
        style={{ width: size, height: size, borderRadius: 3 }}
      />
    );
  }
  return (
    <Text accessibilityLabel={label} style={{ fontSize: size * 0.85, lineHeight: size + 2 }}>
      {emojify(icon.emoji ?? "", "role-icon", size)}
    </Text>
  );
}
