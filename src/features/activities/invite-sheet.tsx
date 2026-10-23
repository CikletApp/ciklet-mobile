import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type {
  ActivityInviteListResponse,
  ActivityInviteOriginKind,
  ActivityInviteSendResponse,
  ActivityInviteTarget,
} from "@/api/types";
import { Avatar, GroupAvatar, Icon, KeyboardAvoider, showDialog, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Arkadaşları Davet Et — alttan açılan seçici (web
 * components/modals/activity-invite-modal karşılığı).
 *
 * Hem SDK komutu (OPEN_INVITE_DIALOG) hem üst çubuktaki "⋯" menüsü açar.
 * Hedefler ve "uygun mu" kararı SUNUCUDAN gelir: kart yalnızca oturumun
 * sohbetine zaten erişen kişilere gidebilir; uygun olmayanlar soluk ve
 * seçilemez. Gönderim tek istek, sonuç hedef başına.
 */

const SEND_ERRORS: Record<string, string> = {
  not_found: "sohbet bulunamadı",
  not_eligible: "bu aktiviteye erişimi yok",
  dm_not_allowed: "DM kabul etmiyor",
  rate_limited: "çok fazla davet; biraz bekle",
  failed: "gönderilemedi",
};

function loadError(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "Davet göndermek için bu aktiviteye katılmış olmalısın.";
  if (error instanceof ApiError && error.status === 404) return "Bu aktivite artık sürmüyor.";
  return "Davet listesi yüklenemedi.";
}

function emptyMessage(kind: ActivityInviteOriginKind): string {
  switch (kind) {
    case "direct":
      return "Özel sohbette başlayan bir aktiviteye yalnızca sohbetin üyeleri katılabilir. Arkadaşlarını davet etmek için aktiviteyi bir grup sohbetinde ya da sunucu kanalında başlat.";
    case "group":
      return "Davet edebileceğin kimse yok. Arkadaşlarını davet etmek için önce onları gruba ekle.";
    default:
      return "Bu kanalı görebilen bir arkadaşın ya da sohbetin yok.";
  }
}

function ineligibleLabel(kind: ActivityInviteOriginKind): string {
  switch (kind) {
    case "channel":
      return "Bu kanalı göremiyor";
    case "group":
      return "Grubun üyesi değil";
    default:
      return "Bu sohbette değil";
  }
}

export function ActivityInviteSheet({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["activity-invite-targets", chatId],
    queryFn: () => api<ActivityInviteListResponse>(endpoints.activityInviteTargets(chatId)),
    // Uygunluk oturuma ve üyeliğe bağlı; her açılışta taze.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const data = list.data;
  const maxTargets = data?.maxTargets ?? 10;
  const filtered = useMemo(() => {
    const targets = data?.targets ?? [];
    const needle = query.toLocaleLowerCase("tr").trim();
    if (!needle) return targets;
    return targets.filter((t) => `${t.name} ${t.username ?? ""}`.toLocaleLowerCase("tr").includes(needle));
  }, [data, query]);
  const hasEligible = Boolean(data?.targets.some((t) => t.eligible));

  const toggle = (target: ActivityInviteTarget) => {
    if (!target.eligible) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(target.key)) next.delete(target.key);
      else if (next.size < maxTargets) next.add(target.key);
      else showToast(`En fazla ${maxTargets} kişiyi aynı anda davet edebilirsin.`);
      return next;
    });
  };

  const submit = async () => {
    if (!data || selected.size === 0 || sending) return;
    const chosen = data.targets.filter((t) => selected.has(t.key));
    setSending(true);
    try {
      let result: ActivityInviteSendResponse;
      try {
        result = await api<ActivityInviteSendResponse>(endpoints.activityInvite, {
          method: "POST",
          body: {
            chatId,
            targets: chosen.map((t) => (t.directId ? { directId: t.directId } : { profileId: t.profileId })),
          },
        });
      } catch (error) {
        // 429: tüm hedefler hız sınırına takıldı; gövde yine hedef başına sonuç taşır.
        if (error instanceof ApiError && error.status === 429 && error.body && typeof error.body === "object") {
          result = error.body as ActivityInviteSendResponse;
        } else {
          throw error;
        }
      }

      const touched = result.results.filter((r) => !r.error && r.directId).map((r) => r.directId as string);
      for (const directId of touched) {
        void queryClient.invalidateQueries({ queryKey: qk.messages.chat(directId) });
      }
      if (touched.length > 0) void queryClient.invalidateQueries({ queryKey: qk.directs });

      const nameOf = new Map(chosen.map((t) => [t.key, t.name]));
      const failures = result.results
        .filter((r) => r.error)
        .map((r) => `${nameOf.get(r.key) ?? "?"}: ${SEND_ERRORS[r.error ?? "failed"] ?? "gönderilemedi"}`);
      if (result.sent > 0) showToast(result.sent === 1 ? "Davet gönderildi." : `${result.sent} davet gönderildi.`);
      if (failures.length > 0) {
        showDialog("Bazı davetler gönderilemedi", failures.join("\n"));
        const failedKeys = new Set(result.results.filter((r) => r.error).map((r) => r.key));
        setSelected(new Set([...selected].filter((key) => failedKeys.has(key))));
        return;
      }
      onClose();
    } catch (error) {
      showDialog("Davet gönderilemedi", loadError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoider style={{ backgroundColor: "transparent" }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Daveti kapat"
            style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              maxHeight: "82%",
              paddingTop: spacing.lg,
              paddingBottom: spacing["2xl"],
              gap: spacing.md,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.bento,
            }}
          >
            <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />

            <View style={{ paddingHorizontal: spacing.lg, gap: 2 }}>
              <Text style={{ ...typography.display, color: colors.bright }}>Arkadaşları Davet Et</Text>
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                {data
                  ? `${data.activity.name}${data.origin.label ? ` · ${data.origin.label}` : ""}`
                  : "Etkinliğe davet gönder"}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
              }}
            >
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Arkadaş veya sohbet ara"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                editable={Boolean(data)}
                style={{ flex: 1, paddingVertical: spacing.sm, color: colors.bright, ...typography.body }}
                accessibilityLabel="Davet edilecek kişiyi ara"
              />
            </View>

            <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.sm }}>
              {list.isLoading ? <ActivityIndicator color={colors.muted} style={{ marginVertical: spacing.lg }} /> : null}
              {list.isError ? <Note text={loadError(list.error)} /> : null}
              {data && !hasEligible && !query ? <Note text={emptyMessage(data.origin.kind)} /> : null}
              {data && query && filtered.length === 0 ? <Note text="Eşleşen kimse yok." /> : null}
              {data
                ? filtered.map((target) => (
                    <TargetRow
                      key={target.key}
                      target={target}
                      selected={selected.has(target.key)}
                      disabledLabel={target.eligible ? null : ineligibleLabel(data.origin.kind)}
                      onPress={() => toggle(target)}
                    />
                  ))
                : null}
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Davet yalnızca bu etkinliğin sohbetine zaten erişebilen kişilere gider; kimseye yeni erişim vermez.
              </Text>
              <Pressable
                onPress={() => void submit()}
                disabled={selected.size === 0 || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: selected.size === 0 || sending }}
                style={({ pressed }) => ({
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  backgroundColor: selected.size === 0 ? colors.panel : pressed ? colors.raised : colors.brand,
                  opacity: sending ? 0.6 : 1,
                })}
              >
                {sending ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Icon name="user-plus" size={18} color={selected.size === 0 ? colors.muted : colors.onBrand} />
                )}
                <Text style={{ ...typography.bodyStrong, color: selected.size === 0 ? colors.muted : colors.onBrand }}>
                  {selected.size > 1 ? `${selected.size} kişiye gönder` : "Gönder"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", paddingVertical: spacing.lg, paddingHorizontal: spacing.lg }}>
      {text}
    </Text>
  );
}

function TargetRow({
  target,
  selected,
  disabledLabel,
  onPress,
}: {
  target: ActivityInviteTarget;
  selected: boolean;
  disabledLabel: string | null;
  onPress: () => void;
}) {
  const disabled = disabledLabel !== null;
  const sublabel = disabled
    ? disabledLabel
    : target.isGroup
      ? `${target.memberCount} üye`
      : target.username
        ? `@${target.username}`
        : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={target.name}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: pressed && !disabled ? colors.raised : "transparent",
      })}
    >
      {target.isGroup ? (
        <GroupAvatar members={target.members} imageUrl={target.imageUrl} name={target.name} size={36} backgroundColor={colors.bento} />
      ) : (
        <Avatar profileId={target.profileId ?? undefined} imageUrl={target.imageUrl} fallbackText={target.name} size={36} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {target.name}
        </Text>
        {sublabel ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {!disabled ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
            borderColor: selected ? colors.brand : colors.border,
            backgroundColor: selected ? colors.brand : "transparent",
          }}
        >
          {selected ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}
