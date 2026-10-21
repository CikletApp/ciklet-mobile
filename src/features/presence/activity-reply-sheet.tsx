import { useEffect, useState } from "react";
import { Modal, Pressable as RNPressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";

import { useOpenDirect } from "@/api/hooks";
import type { RichPresence } from "@/api/types";
import { Avatar, Icon, KeyboardAvoider, Pressable, ToastHost, emojify, showToast } from "@/components/ui";
import { activityTypeIcon } from "@/features/chat/components/message-activity-reply";
import { kickOutbox } from "@/features/chat/outbox-sender";
import {
  ACTIVITY_REPLY_CONTENT_MAX,
  ACTIVITY_REPLY_QUICK_EMOJIS,
  activityRefHeadline,
  activityVerbLabel,
  buildActivityReplyPayload,
} from "@/lib/activity-reply";
import { API_BASE_URL, resolveMediaUrl } from "@/lib/config";
import { displayNameOf } from "@/lib/format";
import { useOutbox } from "@/stores/outbox";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Etkinliğe yanıt / tepki — alttan açılan sayfa (web
 * components/server/activity-reply-card karşılığı).
 *
 * Bir arkadaşın şu anki etkinliğine (Şimdi Aktif kartı, profildeki "ŞU AN")
 * dokununca açılır: kimlik satırı, etkinlik kutusu (görsel, "Ad · Oynuyor",
 * başlık, süre / müzik ilerlemesi), dört hızlı tepki ve "Yanıt yaz…" alanı.
 *
 * Gönderim: kişiyle DM açılır/oluşturulur (POST /api/directs/init) ve mesaj
 * KALICI gönderim kuyruğuna (stores/outbox) ACTIVITY_REPLY türüyle girer;
 * `metadata.activity` etkinliğin özetidir (lib/activity-reply). Kuyruk ağ
 * gidip gelse de mesajı teslim eder; DM'de kart olarak çizilir.
 */
export interface ActivityReplyTarget {
  profile: { id: string; username: string; name?: string | null; imageUrl?: string | null };
  activity: RichPresence;
}

export function ActivityReplySheet({ target, onClose }: { target: ActivityReplyTarget | null; onClose: () => void }) {
  if (!target) return null;
  return <SheetBody key={`${target.profile.id}:${target.activity.name}`} target={target} onClose={onClose} />;
}

function SheetBody({ target, onClose }: { target: ActivityReplyTarget; onClose: () => void }) {
  const { profile, activity } = target;
  const openDirect = useOpenDirect();
  const enqueue = useOutbox((s) => s.enqueue);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const displayName = displayNameOf(profile);
  const showUsername = displayName.toLocaleLowerCase("tr") !== profile.username.toLocaleLowerCase("tr");
  const type = activity.type ?? "PLAYING";
  const ref = { type, name: activity.name, details: activity.details, state: activity.state, isLive: true };
  const { title, subtitle } = activityRefHeadline(ref);
  const verb = activityVerbLabel(ref);
  const icon = activityTypeIcon(type);
  // Kapaklar göreli yol olarak gelebilir (/api/presence/covers/…).
  const artwork = resolveMediaUrl(activity.largeImageUrl) || resolveMediaUrl(activity.appIconUrl) || null;
  const shownImage = artwork && artwork !== failedSrc ? artwork : null;

  const send = async (content: string) => {
    if (sending) return;
    // Gövdeye ham (göreli olabilen) adres gider; API köküyle mutlak yapılır,
    // https değilse düşer — web'le aynı kural.
    const payload = buildActivityReplyPayload(
      { type, name: activity.name, details: activity.details ?? null, state: activity.state ?? null, isLive: true },
      content,
      activity.largeImageUrl || activity.appIconUrl || null,
      API_BASE_URL,
    );
    if (!payload) return;
    setSending(true);
    try {
      const direct = await openDirect.mutateAsync(profile.id);
      enqueue({
        chatId: direct.id,
        kind: "direct",
        content: payload.content,
        payload: { messageType: payload.messageType, metadata: payload.metadata },
      });
      kickOutbox();
      showToast(`${displayName} kişisine gönderildi.`);
      onClose();
    } catch (reason) {
      showToast(reason instanceof Error && reason.message ? reason.message : "Yanıt gönderilemedi.", "error");
      setSending(false);
    }
  };

  const openChat = () => {
    openDirect.mutate(profile.id, {
      onSuccess: (direct) => {
        onClose();
        router.push(`/chat/direct/${direct.id}`);
      },
    });
  };

  const canSend = !sending && text.trim().length > 0;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoider style={{ backgroundColor: "transparent" }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <RNPressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              paddingTop: spacing.lg,
              paddingBottom: spacing["2xl"],
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.bento,
              overflow: "hidden",
            }}
          >
            {/* Bulanık kapak zemini (web kartı gibi): üst kısımda soluk. */}
            {shownImage ? (
              <Image
                source={{ uri: shownImage }}
                contentFit="cover"
                blurRadius={28}
                style={{ position: "absolute", left: -24, right: -24, top: -24, height: 170, opacity: 0.22 }}
              />
            ) : null}

            <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />

            {/* ── Kimlik ── */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar profileId={profile.id} imageUrl={profile.imageUrl ?? null} fallbackText={profile.username} size={44} showPresence />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.title, color: colors.bright }} numberOfLines={1}>
                  {displayName}
                </Text>
                {showUsername ? (
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={openChat}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`${displayName} ile sohbeti aç`}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.raised : colors.panel,
                })}
              >
                <Icon name="message" size={18} color={colors.bright} />
              </Pressable>
            </View>

            {/* ── Etkinlik ── */}
            <View style={{ padding: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.panel, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name={icon} size={13} color={colors.brand} />
                <Text
                  style={{ flex: 1, fontSize: 10, lineHeight: 14, letterSpacing: 0.8, ...fw(800), color: colors.muted, textTransform: "uppercase" }}
                  numberOfLines={1}
                >
                  {activity.name} · {verb}
                </Text>
                <ElapsedLabel startedAt={activity.startedAt} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radii.md,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.raised,
                  }}
                >
                  {shownImage ? (
                    <Image
                      source={{ uri: shownImage }}
                      contentFit="cover"
                      onError={() => setFailedSrc(shownImage)}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Icon name={icon} size={28} color={colors.muted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, lineHeight: 19, ...fw(700), color: colors.bright }} numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
              {activity.timestamps ? <MediaProgress timestamps={activity.timestamps} /> : null}
            </View>

            {/* ── Tepki + yanıt ── */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {ACTIVITY_REPLY_QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  disabled={sending}
                  haptic="light"
                  noHitSlop
                  onPress={() => void send(emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={`${emoji} gönder`}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    backgroundColor: pressed ? colors.raised : colors.panel,
                    opacity: sending ? 0.5 : 1,
                  })}
                >
                  <Text style={{ fontSize: 22, lineHeight: 28 }}>{emojify(emoji, `ar-${emoji}`, 24)}</Text>
                </Pressable>
              ))}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingLeft: spacing.md,
                paddingRight: 4,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                editable={!sending}
                maxLength={ACTIVITY_REPLY_CONTENT_MAX}
                placeholder={`${displayName} kişisine yanıt yaz…`}
                placeholderTextColor={colors.muted}
                returnKeyType="send"
                submitBehavior="submit"
                onSubmitEditing={() => {
                  if (canSend) void send(text);
                }}
                style={{ flex: 1, paddingVertical: spacing.sm, color: colors.bright, ...typography.body }}
                accessibilityLabel="Yanıt"
              />
              <Pressable
                onPress={() => void send(text)}
                disabled={!canSend}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Yanıtı gönder"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend ? colors.brand : "transparent",
                }}
              >
                <Icon name="send" size={17} color={canSend ? colors.onBrand : colors.muted} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }}>
              Yanıtın {displayName} ile olan özel mesajına gider.
            </Text>
          </View>
        </View>
      </KeyboardAvoider>
      {/* Modal ayrı pencere: hata şeridi kökteki ToastHost'un arkasında kalmasın. */}
      <ToastHost />
    </Modal>
  );
}

// ── Süre ─────────────────────────────────────────────────────────────

/** Modül düzeyinde: render içinde doğrudan `Date.now` React Compiler'a takılıyor. */
function nowMs(): number {
  return Date.now();
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Web formatActivityTimer: 1:23:45 / 12:07. */
function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function ElapsedLabel({ startedAt }: { startedAt?: number }) {
  const now = useNow(Boolean(startedAt));
  if (!startedAt) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Icon name="clock" size={11} color={colors.success} />
      <Text style={{ fontSize: 10, lineHeight: 14, ...fw(600), color: colors.success, fontVariant: ["tabular-nums"] }}>
        {formatTimer(now - startedAt)}
      </Text>
    </View>
  );
}

function MediaProgress({ timestamps }: { timestamps: { start: number; end: number } }) {
  const now = useNow(true);
  const duration = Math.max(0, timestamps.end - timestamps.start);
  if (duration <= 0) return null;
  const progress = Math.min(duration, Math.max(0, now - timestamps.start));
  return (
    <View>
      <View style={{ height: 4, borderRadius: radii.full, overflow: "hidden", backgroundColor: colors.border }}>
        <View style={{ width: `${(progress / duration) * 100}%`, height: "100%", borderRadius: radii.full, backgroundColor: colors.brand }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ fontSize: 10, lineHeight: 13, color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatTimer(progress)}</Text>
        <Text style={{ fontSize: 10, lineHeight: 13, color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatTimer(duration)}</Text>
      </View>
    </View>
  );
}
