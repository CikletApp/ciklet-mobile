import { useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type { ProfileCardResponse } from "@/api/types";
import { ActionSheet, Button, Icon, Pressable, showDialog, showToast, type ActionSheetItem } from "@/components/ui";
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
      onError: (reason) => showToast(errorText(reason, "İşlem yapılamadı."), "error"),
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
        "Arkadaşlık isteği gönderildi!"
      ),
    accept: () => {
      if (!friendship) return;
      run(
        () => api(endpoints.friend(friendship.id), { method: "PATCH", body: { action: "ACCEPT" } }),
        "Arkadaşlık isteği kabul edildi!"
      );
    },
    cancel: () => {
      if (!friendship) return;
      run(() => api(endpoints.friend(friendship.id), { method: "DELETE" }), "İstek iptal edildi.");
    },
    remove: () => {
      if (!friendship) return;
      run(() => api(endpoints.friend(friendship.id), { method: "DELETE" }), "Arkadaşlıktan çıkarıldı.");
    },
    block: () =>
      run(() => api(endpoints.friendBlock, { method: "POST", body: { profileId: target.id } }), "Kullanıcı engellendi."),
    unblock: () =>
      run(() => api(endpoints.friendBlock, { method: "DELETE", body: { profileId: target.id } }), "Engel kaldırıldı."),
  };
}

export type ProfileFriendship = ReturnType<typeof useProfileFriendship>;

/** Profil başlığındaki arkadaşlık düğmesi — duruma göre tek düğme (web ile aynı). */
export function ProfileFriendButton({ friendship }: { friendship: ProfileFriendship }) {
  if (friendship.isBlocked) {
    return (
      <Button
        label={friendship.iBlocked ? "Engeli Kaldır" : "Engellendi"}
        icon="shield"
        variant="danger"
        disabled={!friendship.iBlocked || friendship.busy}
        onPress={friendship.unblock}
      />
    );
  }
  if (friendship.isFriend) {
    return <SquareIcon icon="check" label="Arkadaşsınız" />;
  }
  if (friendship.isReceiver) {
    return <SquareIcon icon="check" label="İsteği Kabul Et" onPress={friendship.accept} disabled={friendship.busy} />;
  }
  if (friendship.isPending) {
    return <SquareIcon icon="user-plus" label="İstek Gönderildi" onPress={friendship.cancel} disabled={friendship.busy} dim />;
  }
  return <SquareIcon icon="user-plus" label="Arkadaş Ekle" onPress={friendship.add} disabled={friendship.busy} />;
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

  const copyId = async () => {
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(profileId);
      showToast("Kullanıcı kimliği kopyalandı");
    } catch {
      showToast("Kopyalanamadı", "error");
    }
  };

  const items: (ActionSheetItem | "separator")[] = [];
  if (isPerson && friendship.isFriend) {
    items.push(
      { key: "audio", label: "Sesli Arama Başlat", icon: "phone", onPress: () => onCall("audio") },
      { key: "video", label: "Görüntülü Arama Başlat", icon: "video", onPress: () => onCall("video") },
      "separator"
    );
  }
  items.push({ key: "copy", label: "Kullanıcı Kimliğini Kopyala", icon: "copy", onPress: () => void copyId() });
  if (isPerson) {
    items.push("separator");
    if (friendship.isFriend) {
      items.push({
        key: "remove",
        label: "Arkadaşlıktan Çıkar",
        icon: "close",
        onPress: () =>
          showDialog("Arkadaşlıktan çıkar", `${displayName} arkadaş listenden çıkarılsın mı?`, [
            { text: "Vazgeç", style: "cancel" },
            { text: "Arkadaşlıktan Çıkar", style: "destructive", onPress: friendship.remove },
          ]),
      });
    }
    if (!friendship.isBlocked) {
      items.push({
        key: "block",
        label: "Engelle",
        icon: "shield",
        destructive: true,
        onPress: () =>
          showDialog("Engelle", `${displayName} engellensin mi? Sana mesaj gönderemez ve seni arayamaz.`, [
            { text: "Vazgeç", style: "cancel" },
            { text: "Engelle", style: "destructive", onPress: friendship.block },
          ]),
      });
    }
    items.push({
      key: "report",
      label: "Kullanıcıyı Bildir",
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

const REASONS: { value: string; label: string }[] = [
  { value: "SPAM", label: "Spam veya reklam" },
  { value: "HARASSMENT", label: "Taciz veya zorbalık" },
  { value: "HATE_SPEECH", label: "Nefret söylemi" },
  { value: "VIOLENCE", label: "Şiddet veya tehdit" },
  { value: "SELF_HARM", label: "Kendine zarar / intihar" },
  { value: "CSAM", label: "Çocuk istismarı" },
  { value: "ILLEGAL", label: "Yasa dışı içerik" },
  { value: "IMPERSONATION", label: "Taklit / sahtecilik" },
  { value: "OTHER", label: "Diğer" },
];

const TYPE_LABEL = { USER: "kullanıcıyı", BOT: "botu" } as const;

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
      showToast("Şikayetin alındı. Teşekkürler.");
      close();
    } catch (reason) {
      showToast(errorText(reason, "Şikayet gönderilemedi."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <RNPressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
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
            Bu {TYPE_LABEL[target.type]} şikayet et
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
                  <Text style={{ ...typography.caption, color: colors.text }}>{r.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="Eklemek istediğin detay (isteğe bağlı)"
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
            <Button label="Vazgeç" variant="ghost" onPress={close} />
            <Button
              label={busy ? "Gönderiliyor…" : "Şikayet Et"}
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
