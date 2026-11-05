import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button, Icon, IconButton, showToast } from "@/components/ui";
import { GifPicker } from "@/features/chat/components/gif-picker";
import { friendAnniversary } from "@/lib/friend-anniversary";
import { useNow } from "@/lib/use-now";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Arkadaşlık yıl dönümü — web `components/directs/friend-anniversary-bar.tsx`
 * ve `components/friends/friend-anniversary-gif-dialog.tsx`.
 *
 * Tamamen hesaplanan durum (lib/friend-anniversary): mesaj ya da bildirim
 * yok, şerit yalnızca sohbeti açana görünür. Kapatmak ya da GIF'i göndermek
 * o yılın kutlamasını bu cihazda kalıcı olarak kapatır (anahtar yıl başına;
 * gelecek yıl yeniden çıkar). Web'deki tek seferlik konfeti mobilde yok.
 */

const MESSAGE_MAX = 500;

function dismissKey(friendshipId: string, years: number) {
  return `ciklet:anniversary-dismissed:${friendshipId}:${years}`;
}

/** Kapatılan yıl dönümleri — AsyncStorage'dan okunur, aynı oturumdaki ekranlar birlikte güncellenir. */
const useDismissed = create<{ keys: Record<string, boolean>; set: (key: string, value: boolean) => void }>((set) => ({
  keys: {},
  set: (key, value) => set((state) => ({ keys: { ...state.keys, [key]: value } })),
}));

/** `undefined`: depodan henüz okunmadı — o arada şerit çizilmez (bir an görünüp kaybolmasın). */
function useDismissFlag(key: string | null): [boolean | undefined, () => void] {
  const value = useDismissed((s) => (key ? s.keys[key] : true));
  const setFlag = useDismissed((s) => s.set);
  useEffect(() => {
    if (!key || useDismissed.getState().keys[key] !== undefined) return;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((stored) => {
        if (!cancelled) setFlag(key, stored === "1");
      })
      .catch(() => {
        if (!cancelled) setFlag(key, false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, setFlag]);
  const dismiss = () => {
    if (!key) return;
    setFlag(key, true);
    AsyncStorage.setItem(key, "1").catch(() => undefined);
  };
  return [value, dismiss];
}

/** DM'in tepesindeki yıl dönümü şeridi (web `FriendAnniversaryBar`). */
export function FriendAnniversaryBar({
  friendshipId,
  since,
  friend,
  directId,
}: {
  friendshipId: string;
  /** Arkadaşlığın başladığı an (ISO). */
  since: string;
  friend: { id: string; username: string };
  directId: string;
}) {
  // Gün sınırı görenin yerel saatine göre; dakikada bir yeniden bakılır.
  const now = useNow(60_000);
  const anniversary = friendAnniversary(since, now);
  const [dismissed, dismiss] = useDismissFlag(anniversary ? dismissKey(friendshipId, anniversary.years) : null);
  const [gifOpen, setGifOpen] = useState(false);
  const t = useT();

  if (!anniversary || dismissed !== false) return null;

  const headline =
    anniversary.daysAgo === 0
      ? t("moreScreens.anniversary.today", { username: friend.username, years: anniversary.years })
      : t("moreScreens.anniversary.recent", { username: friend.username, years: anniversary.years });

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.panel,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.full,
            backgroundColor: colors.brandSoft,
          }}
        >
          <Icon name="sparkles" size={16} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 17, ...fw(600), color: colors.bright }}>
            {headline}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.muted }}>
            {t("moreScreens.anniversary.subtitle")}
          </Text>
        </View>
        <Button label={t("moreScreens.anniversary.celebrate")} onPress={() => setGifOpen(true)} />
        <IconButton icon="close" label={t("common.close")} size={32} background="transparent" tint={colors.muted} onPress={dismiss} />
      </View>
      <AnniversaryGifSheet
        visible={gifOpen}
        onClose={() => setGifOpen(false)}
        friend={friend}
        years={anniversary.years}
        directId={directId}
        // Kutlandı: bu yılın şeridi kapanır.
        onSent={dismiss}
      />
    </>
  );
}

/**
 * "Anı bir GIF ile kutla" (web `FriendAnniversaryGifDialog`). Seçici SEÇİM
 * modunda: GIF'e basmak onu yalnızca çerçeveler, gönderim "Gönder"le olur.
 * Mesaj ve GIF tek mesaj olarak gider (metin + ek); metin boşsa içerik GIF'in
 * adresidir. `directId` yoksa (arkadaş listesi) sohbet gönderimde bulunur ya
 * da oluşturulur.
 */
export function AnniversaryGifSheet({
  visible,
  onClose,
  friend,
  years,
  directId,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  friend: { id: string; username: string };
  years: number;
  directId?: string;
  onSent?: (directId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const t = useT();
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    onClose();
    // Her açılış boş başlar (web: gövde kapanınca sökülüyor).
    setMessage("");
    setGifUrl(null);
  };

  const send = async () => {
    if (!gifUrl || sending) return;
    setSending(true);
    try {
      let targetId = directId;
      if (!targetId) {
        const direct = await api<{ id: string }>(endpoints.directInit, { method: "POST", body: { friendId: friend.id } });
        targetId = direct.id;
      }
      const text = message.trim();
      await api(endpoints.sendDirectMessage(targetId), { method: "POST", body: { content: text || gifUrl, fileUrl: gifUrl } });
      void queryClient.invalidateQueries({ queryKey: ["directs"] });
      showToast(t("moreScreens.anniversary.sent", { username: friend.username }));
      setSending(false);
      onClose();
      setMessage("");
      setGifUrl(null);
      onSent?.(targetId);
    } catch (error) {
      showToast(userErrorMessage(error, t("moreScreens.anniversary.failed")), "error");
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.panel, paddingTop: Platform.OS === "android" ? insets.top : 0 }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 20, lineHeight: 26, ...fw(700), color: colors.bright }}>{t("moreScreens.anniversary.sheetTitle")}</Text>
            <Text style={{ ...typography.body, color: colors.muted }}>
              {t("moreScreens.anniversary.sheetBody", { username: friend.username, years })}
            </Text>
          </View>
          <IconButton icon="close" label={t("common.close")} background="transparent" tint={colors.muted} disabled={sending} onPress={close} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={MESSAGE_MAX}
            multiline
            editable={!sending}
            accessibilityLabel={t("moreScreens.anniversary.message")}
            placeholder={t("moreScreens.anniversary.placeholder")}
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 72,
              maxHeight: 120,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.deep,
              color: colors.bright,
              textAlignVertical: "top",
              ...typography.body,
            }}
          />
        </View>
        <View style={{ flex: 1, paddingTop: spacing.sm }}>
          <GifPicker
            initialQuery={t("moreScreens.anniversary.gifQuery")}
            selectedUrl={gifUrl}
            onGif={setGifUrl}
            bottomInset={spacing.md}
            onSearchFocusChange={() => undefined}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Button label={t("common.cancel")} variant="ghost" disabled={sending} onPress={close} />
          <Button label={t("moreScreens.anniversary.send")} loading={sending} disabled={!gifUrl || sending} onPress={() => void send()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
