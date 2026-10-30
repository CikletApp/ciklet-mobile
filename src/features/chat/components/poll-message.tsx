import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { hasServerPermission, useMyPermissions } from "@/api/hooks";
import { Icon, Pressable, emojify, showToast } from "@/components/ui";
import { pollClosed, readPoll, type Poll } from "@/lib/message-extras";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { useChatScope } from "../chat-scope";

/**
 * Anket gövdesi (ciklet-web POLL) — normal mesaj balonunun İÇİNDE çizilir;
 * uzun basma menüsü, tepkiler ve silinmiş görünümü balondan gelir.
 *
 * Oy `POST /api/messages/[id]/poll/vote`; yanıt güncel mesajı döndürür ve
 * sunucu güncellemeyi yayınlar. Yerel (iyimser) durum yalnızca türetildiği
 * mesaj metadata'sı için geçerli: yayın gelip metadata değişince kendiliğinden
 * düşer, eski oy sayıları üstte asılı kalmaz.
 *
 * "Anketi bitir" (web `message-poll.tsx` ile aynı): anketin sahibi ya da
 * kanalda "Mesajları Yönet" izni olan görür; iki adımlı onayla
 * `POST /api/messages/[id]/poll/end`. Seçenek emojileri metnin önünde.
 */
export function PollCard({ message, poll: parsed }: { message: ChatMessagePayload; poll: Poll }) {
  const myId = useAuth((s) => s.profile?.id) ?? "";
  const [local, setLocal] = useState<{ base: unknown; poll: Poll } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const poll = local && local.base === message.metadata ? local.poll : parsed;
  const chatScope = useChatScope();
  const permissions = useMyPermissions(chatScope?.kind === "channel" ? chatScope.serverId : undefined);

  // Kapanış anında yeniden çiz (web ile aynı): düğmeler kilitlenir.
  const expiresAtMs = poll.expiresAt ? new Date(poll.expiresAt).getTime() : null;
  useEffect(() => {
    if (expiresAtMs === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, expiresAtMs - Date.now() + 50), 2_147_000_000));
    return () => clearTimeout(timer);
  }, [expiresAtMs]);

  const closed = pollClosed(poll, now);
  const mine = new Set(poll.options.filter((o) => (poll.votes[o.id] ?? []).includes(myId)).map((o) => o.id));
  const total = poll.options.reduce((sum, o) => sum + (poll.votes[o.id]?.length ?? 0), 0);
  const chatId = isChannelMessage(message) ? message.channelId : message.directId;
  const scope = isChannelMessage(message) ? "channel" : "direct";
  const authorId = isChannelMessage(message) ? message.member.profile.id : message.profile.id;
  const canModerate =
    scope === "channel" &&
    (permissions.data?.memberRole === MemberRole.ADMIN ||
      permissions.data?.memberRole === MemberRole.MODERATOR ||
      hasServerPermission(permissions.data, "MANAGE_MESSAGES"));
  const canEnd = !closed && Boolean(myId) && (authorId === myId || canModerate);

  const endPoll = async () => {
    if (busy) return;
    const base = message.metadata;
    setBusy(true);
    try {
      const updated = await api<{ metadata?: unknown }>(endpoints.pollEnd(message.id), {
        method: "POST",
        body: { chatId, scope },
      });
      const confirmed = readPoll(updated?.metadata);
      if (confirmed) setLocal({ base, poll: confirmed });
      setNow(Date.now());
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Anket bitirilemedi.", "error");
    } finally {
      setBusy(false);
      setConfirmEnd(false);
    }
  };

  const vote = async (optionId: string) => {
    if (busy || closed) return;
    const base = message.metadata;
    const next = new Set(mine);
    if (next.has(optionId)) next.delete(optionId);
    else {
      if (!poll.multiple) next.clear();
      next.add(optionId);
    }
    const votes: Record<string, string[]> = {};
    for (const o of poll.options) {
      const others = (poll.votes[o.id] ?? []).filter((id) => id !== myId);
      votes[o.id] = next.has(o.id) ? [...others, myId] : others;
    }
    setLocal({ base, poll: { ...poll, votes } });
    setBusy(true);
    try {
      const updated = await api<{ metadata?: unknown }>(endpoints.pollVote(message.id), {
        method: "POST",
        body: { chatId, scope, optionIds: [...next] },
      });
      // Sunucunun kesin sayıları; yayın gelince metadata zaten değişir.
      const confirmed = readPoll(updated?.metadata);
      setLocal(confirmed ? { base, poll: confirmed } : null);
    } catch {
      setLocal(null);
      showToast("Oy verilemedi.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ minWidth: 220, gap: spacing.sm, paddingVertical: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Icon name="list" size={14} color={colors.brand} />
        <Text style={{ ...typography.caption, color: colors.muted }}>Anket</Text>
      </View>
      <Text style={{ ...typography.bodyStrong, color: colors.text }}>{poll.question}</Text>
      {poll.options.map((o) => {
        const count = poll.votes[o.id]?.length ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const picked = mine.has(o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => void vote(o.id)}
            disabled={closed || busy}
            accessibilityRole="button"
            accessibilityState={{ selected: picked, disabled: closed || busy }}
            accessibilityLabel={`${o.text}, ${count} oy`}
            style={{ borderRadius: radii.md, borderWidth: 1, borderColor: picked ? colors.brand : colors.border, overflow: "hidden" }}
          >
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: picked ? colors.brandSoft : colors.raised }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
              <Text style={{ ...typography.body, color: colors.text, flexShrink: 1 }}>
                {o.emoji ? <>{emojify(o.emoji, `poll-${message.id}-${o.id}`, 16)}{" "}</> : null}
                {o.text}
              </Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{count} · %{pct}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={{ ...typography.caption, color: colors.muted }}>
        {total} oy{poll.multiple ? " · çoklu seçim" : ""}{closed ? (poll.endedAt ? " · erken bitirildi" : " · sona erdi") : poll.expiresAt ? ` · ${new Date(poll.expiresAt).toLocaleString("tr-TR")} bitiyor` : ""}
      </Text>
      {canEnd ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm }}>
          {confirmEnd ? (
            <>
              <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>Anket şimdi bitirilsin mi?</Text>
              <Pressable onPress={() => setConfirmEnd(false)} disabled={busy} accessibilityRole="button" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={() => void endPoll()}
                disabled={busy}
                haptic="light"
                accessibilityRole="button"
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.md, backgroundColor: colors.danger, opacity: busy ? 0.5 : 1 }}
              >
                <Text style={{ ...typography.caption, ...fw(600), color: colors.onBrand }}>Bitir</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setConfirmEnd(true)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
            >
              <Icon name="flag" size={14} color={colors.muted} />
              <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>Anketi bitir</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
