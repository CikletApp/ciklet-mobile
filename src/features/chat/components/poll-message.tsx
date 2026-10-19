import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Icon, Pressable, showToast } from "@/components/ui";
import { pollClosed, readPoll, type Poll } from "@/lib/message-extras";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Anket gövdesi (ciklet-web POLL) — normal mesaj balonunun İÇİNDE çizilir;
 * uzun basma menüsü, tepkiler ve silinmiş görünümü balondan gelir.
 *
 * Oy `POST /api/messages/[id]/poll/vote`; yanıt güncel mesajı döndürür ve
 * sunucu güncellemeyi yayınlar. Yerel (iyimser) durum yalnızca türetildiği
 * mesaj metadata'sı için geçerli: yayın gelip metadata değişince kendiliğinden
 * düşer, eski oy sayıları üstte asılı kalmaz.
 */
export function PollCard({ message, poll: parsed }: { message: ChatMessagePayload; poll: Poll }) {
  const myId = useAuth((s) => s.profile?.id) ?? "";
  const [local, setLocal] = useState<{ base: unknown; poll: Poll } | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = local && local.base === message.metadata ? local.poll : parsed;

  const closed = pollClosed(poll);
  const mine = new Set(poll.options.filter((o) => (poll.votes[o.id] ?? []).includes(myId)).map((o) => o.id));
  const total = poll.options.reduce((sum, o) => sum + (poll.votes[o.id]?.length ?? 0), 0);
  const chatId = isChannelMessage(message) ? message.channelId : message.directId;
  const scope = isChannelMessage(message) ? "channel" : "direct";

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
              <Text style={{ ...typography.body, color: colors.text, flexShrink: 1 }}>{o.text}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{count} · %{pct}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={{ ...typography.caption, color: colors.muted }}>
        {total} oy{poll.multiple ? " · çoklu seçim" : ""}{closed ? " · sona erdi" : poll.expiresAt ? ` · ${new Date(poll.expiresAt).toLocaleString("tr-TR")} bitiyor` : ""}
      </Text>
    </View>
  );
}
