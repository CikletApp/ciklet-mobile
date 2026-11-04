import { useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type { ProfileCardResponse } from "@/api/types";
import { ActionSheet, Button, Icon, Pressable, showDialog, showToast, type ActionSheetItem } from "@/components/ui";
import { useT, type MessageKey } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Başkasının profilindeki arkadaşlık / engel / bildir eylemleri — web
 * `components/chat/v2/member-card.tsx` `useFriendship` ve
 * `components/profile/full-profile-dialog.tsx` "Diğer" menüsünün karşılığı.
 * Metinler ve durumlar web ile aynı.
 */
type Friendship = ProfileCardResponse["friendship"];

function errorText(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}

export function useProfileFriendship(
  friendship: Friendship,
  target: { id: string; username: string },
  meId: string | undefined
) {
  const queryClient = useQueryClient();
  const t = useT();
  const mutation = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.profileCard(target.id) });
      void queryClient.invalidateQueries({ queryKey: qk.friends });
      void queryClient.invalidateQueries({ queryKey: qk.blockedUsers });
    },
  });

  const run = (work: () => Promise<unknown>, success: string) => {
    if (mutation.isPending) return;
    mutation.mutate(work, {
      onSuccess: () => showToast(success),
      onError: (reason) => showToast(errorText(reason, t("moreScreens.profileActions.failed")), "error"),
    });
  };

  const isPending = friendship?.status === "PENDING";
  const isBlocked = friendship?.status === "BLOCKED";
  return {
    busy: mutation.isPending,
    isFriend: friendship?.status === "ACCEPTED",
    isPending,
    isReceiver: isPending && friendship?.profileOneId !== meId,
    isBlocked,
    // Engeli yalnızca koyan taraf kaldırabilir (sunucu da bunu doğruluyor).
    iBlocked: isBlocked && friendship?.blockedById === meId,
    add: () =>
      run(
        () => api(endpoints.friends, { method: "POST", body: { targetUsername: target.username } }),
        t("moreScreens.profileActions.requestSent")
      ),
    accept: () => {
      if (!friendship) return;
      run(
        () => api(endpoints.friend(friendship.id), { method: "PATCH", body: { action: "ACCEPT" } }),
        t("moreScreens.profileActions.requestAccepted")
      );
    },
    cancel: () => {
      if (!friendship) return;
      run(() => api(endpoints.friend(friendship.id), { method: "DELETE" }), t("moreScreens.profileActions.requestCancelled"));
    },
    remove: () => {
      if (!friendship) return;
      run(() => api(endpoints.friend(friendship.id), { method: "DELETE" }), t("moreScreens.profileActions.removed"));
    },
    block: () =>
      run(() => api(endpoints.friendBlock, { method: "POST", body: { profileId: target.id } }), t("moreScreens.profileActions.blocked")),
    unblock: () =>
      run(() => api(endpoints.friendBlock, { method: "DELETE", body: { profileId: target.id } }), t("moreScreens.profileActions.unblocked")),
  };
}

export type ProfileFriendship = ReturnType<typeof useProfileFriendship>;

/** Profil başlığındaki arkadaşlık düğmesi — duruma göre tek düğme (web ile aynı). */
export function ProfileFriendButton({ friendship }: { friendship: ProfileFriendship }) {
  const t = useT();
  if (friendship.isBlocked) {
    return (
      <Button
        label={friendship.iBlocked ? t("moreScreens.profileActions.unblock") : t("moreScreens.profileActions.blockedLabel")}
        icon="shield"
        variant="danger"
        disabled={!friendship.iBlocked || friendship.busy}
        onPress={friendship.unblock}
      />
    );
  }
  if (friendship.isFriend) {
    return <SquareIcon icon="check" label={t("moreScreens.profileActions.friends")} />;
  }
  if (friendship.isReceiver) {
    return <SquareIcon icon="check" label={t("moreScreens.profileActions.accept")} onPress={friendship.accept} disabled={friendship.busy} />;
  }
  if (friendship.isPending) {
    return <SquareIcon icon="user-plus" label={t("moreScreens.profileActions.pending")} onPress={friendship.cancel} disabled={friendship.busy} dim />;
  }
  return <SquareIcon icon="user-plus" label={t("moreScreens.profileActions.add")} onPress={friendship.add} disabled={friendship.busy} />;
}

export function SquareIcon({
  icon,
  label,
  onPress,
  disabled,
  dim,
}: {
  icon: "check" | "user-plus" | "more";
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  dim?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      haptic="light"
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.raised : colors.panel,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: dim || disabled ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

/**
 * "Diğer" menüsü: arama başlat (arkadaşsa), kimliği kopyala, arkadaşlıktan
 * çıkar, engelle, kullanıcıyı bildir — web full-profile-dialog sırası.
 */
export function ProfileMoreSheet({
  visible,
  onClose,
  profileId,
  displayName,
  isPerson,
  friendship,
  onCall,
}: {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  displayName: string;
  isPerson: boolean;
  friendship: ProfileFriendship;
  onCall: (kind: "audio" | "video") => void;
}) {
  const [reporting, setReporting] = useState(false);
  const t = useT();

  const copyId = async () => {
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(profileId);
      showToast(t("moreScreens.profileActions.idCopied"));
    } catch {
      showToast(t("moreScreens.profileActions.copyFailed"), "error");
    }
  };

  const items: (ActionSheetItem | "separator")[] = [];
  if (isPerson && friendship.isFriend) {
    items.push(
      { key: "audio", label: t("moreScreens.profileActions.voiceCall"), icon: "phone", onPress: () => onCall("audio") },
      { key: "video", label: t("moreScreens.profileActions.videoCall"), icon: "video", onPress: () => onCall("video") },
      "separator"
    );
  }
  items.push({ key: "copy", label: t("moreScreens.profileActions.copyId"), icon: "copy", onPress: () => void copyId() });
  if (isPerson) {
    items.push("separator");
    if (friendship.isFriend) {
      items.push({
        key: "remove",
        label: t("moreScreens.profileActions.remove"),
        icon: "close",
        onPress: () =>
          showDialog(t("moreScreens.profileActions.removeTitle"), t("moreScreens.profileActions.removeBody", { name: displayName }), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("moreScreens.profileActions.remove"), style: "destructive", onPress: friendship.remove },
          ]),
      });
    }
    if (!friendship.isBlocked) {
      items.push({
        key: "block",
        label: t("moreScreens.profileActions.block"),
        icon: "shield",
        destructive: true,
        onPress: () =>
          showDialog(t("moreScreens.profileActions.block"), t("moreScreens.profileActions.blockBody", { name: displayName }), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("moreScreens.profileActions.block"), style: "destructive", onPress: friendship.block },
          ]),
      });
    }
    items.push({
      key: "report",
      label: t("moreScreens.profileActions.report"),
      icon: "flag",
      destructive: true,
      onPress: () => setReporting(true),
    });
  }

  return (
    <>
      <ActionSheet visible={visible} onClose={onClose} items={items} />
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        target={{ type: "USER", id: profileId, reportedUserId: profileId }}
      />
    </>
  );
}

const REASONS: { value: string; label: MessageKey }[] = [
  { value: "SPAM", label: "moreScreens.report.reasons.SPAM" },
  { value: "HARASSMENT", label: "moreScreens.report.reasons.HARASSMENT" },
  { value: "HATE_SPEECH", label: "moreScreens.report.reasons.HATE_SPEECH" },
  { value: "VIOLENCE", label: "moreScreens.report.reasons.VIOLENCE" },
  { value: "SELF_HARM", label: "moreScreens.report.reasons.SELF_HARM" },
  { value: "CSAM", label: "moreScreens.report.reasons.CSAM" },
  { value: "ILLEGAL", label: "moreScreens.report.reasons.ILLEGAL" },
  { value: "IMPERSONATION", label: "moreScreens.report.reasons.IMPERSONATION" },
  { value: "OTHER", label: "moreScreens.report.reasons.OTHER" },
];

const TYPE_LABEL: Record<"USER" | "BOT", MessageKey> = { USER: "moreScreens.report.titleUser", BOT: "moreScreens.report.titleBot" };

/** Şikayet sayfası — web `components/reports/report-modal.tsx` (USER/BOT). */
export function ReportSheet({
  visible,
  onClose,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  target: { type: keyof typeof TYPE_LABEL; id: string; reportedUserId: string | null };
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();

  const close = () => {
    onClose();
    setReason(null);
    setDetail("");
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api(endpoints.reports, {
        method: "POST",
        body: {
          targetType: target.type,
          targetId: target.id,
          reportedUserId: target.reportedUserId,
          reason,
          detail: detail.trim() || null,
        },
      });
      showToast(t("moreScreens.report.sent"));
      close();
    } catch (reason) {
      showToast(errorText(reason, t("moreScreens.report.failed")), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <RNPressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <RNPressable
          onPress={() => undefined}
          accessible={false}
          style={{
            margin: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            maxHeight: "85%",
          }}
        >
          <Text style={{ ...typography.body, ...fw(700), color: colors.bright }}>
            {t(TYPE_LABEL[target.type])}
          </Text>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.xs }}>
            {REASONS.map((r) => {
              const chosen = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    minHeight: 40,
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: chosen ? colors.brand : colors.border,
                    backgroundColor: pressed || chosen ? colors.raised : colors.panel,
                  })}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: radii.full,
                      borderWidth: 2,
                      borderColor: chosen ? colors.brand : colors.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {chosen ? (
                      <View style={{ width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.brand }} />
                    ) : null}
                  </View>
                  <Text style={{ ...typography.caption, color: colors.text }}>{t(r.label)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={t("moreScreens.report.detail")}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            style={{
              minHeight: 72,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.deep,
              color: colors.text,
              textAlignVertical: "top",
              ...typography.body,
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
            <Button label={t("common.cancel")} variant="ghost" onPress={close} />
            <Button
              label={busy ? t("moreScreens.report.sending") : t("moreScreens.report.submit")}
              variant="danger"
              disabled={!reason || busy}
              onPress={() => void submit()}
            />
          </View>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
