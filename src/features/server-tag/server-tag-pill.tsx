import { Text, View } from "react-native";

import type { PrimaryGuild } from "@/api/types";
import { emojify } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors } from "@/theme/tokens";

type PillGuild = Pick<PrimaryGuild, "tag" | "badge"> & { serverName?: string };

/**
 * Ham yükten sunucu etiketi (web lib/server-tag `PrimaryGuild`). Mesaj
 * profili SDK tipinde alan taşımadığı için `unknown` okunur; geçersizse null.
 */
export function primaryGuildOf(profile: unknown): PrimaryGuild | null {
  if (!profile || typeof profile !== "object") return null;
  const raw = (profile as { primaryGuild?: unknown }).primaryGuild;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.serverId !== "string" || typeof value.tag !== "string" || !value.tag) return null;
  return {
    serverId: value.serverId,
    tag: value.tag,
    badge: typeof value.badge === "string" && value.badge ? value.badge : null,
    identityEnabled: value.identityEnabled !== false,
    ...(typeof value.serverName === "string" ? { serverName: value.serverName } : {}),
  };
}

/**
 * Adın yanındaki sunucu etiketi hapı (Discord "Server Tag") — web
 * `components/server-tag/server-tag-pill.tsx` karşılığı: emoji rozet +
 * etiket metni, hafif zemin. `sm` mesaj başlığı ve üye satırı, `md` kart.
 */
export function ServerTagPill({ guild, size = "md" }: { guild: PillGuild | null | undefined; size?: "sm" | "md" }) {
  const t = useT();
  if (!guild?.tag) return null;
  const small = size === "sm";
  const fontSize = small ? 10 : 11;
  const label = guild.serverName ? t("serverTag.pill.tooltip", { server: guild.serverName }) : t("serverTag.pill.generic");
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${guild.tag}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: small ? 4 : 5,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.raised,
        flexShrink: 0,
      }}
    >
      {guild.badge ? (
        <Text style={{ fontSize, lineHeight: fontSize + 2 }}>{emojify(guild.badge, "server-tag", small ? 10 : 12)}</Text>
      ) : null}
      <Text style={{ fontSize, lineHeight: fontSize + 2, ...fw(600), color: colors.bright }}>{guild.tag}</Text>
    </View>
  );
}
