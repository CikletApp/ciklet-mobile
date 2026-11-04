/**
 * Canlı altyazı (lib/live-captions) — sesli kanal ve aramalarda.
 * Web karşılığı: ciklet-web src/components/call/live-captions.tsx (aynı
 * metinler, aynı davranış, aynı veri biçimi; web ve mobil birbirinin
 * altyazısını görür).
 *
 * Herkes yalnızca KENDİ konuşmasını, KENDİ cihazında yazıya çevirir
 * ("Konuşmamı altyazıla", her aramada kapalı başlar) ve metni LiveKit veri
 * kanalıyla yalnızca o odadakilere yollar. "Altyazıları göster" ile görülür;
 * yayını açık olanın yanında "Altyazı açık" rozeti çıkar. Uçtan uca şifreli
 * odada mesajlar gönderenin ses anahtarıyla şifrelenir; şifreleyemeyen
 * cihaz yayın yapamaz.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalParticipant, useRoomContext } from "@livekit/react-native";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import * as Crypto from "expo-crypto";
import { create } from "zustand";

import { Icon, IconButton } from "@/components/ui";
import { useLocale, useT, type MessageKey } from "@/lib/i18n";
import {
  CAPTION_HEARTBEAT_MS,
  CAPTIONS_TOPIC,
  CaptionBoard,
  CaptionSender,
  encodeCaption,
  parseCaption,
  resolveSpeechLanguage,
  SPEECH_LANGUAGES,
  type CaptionLine,
} from "@/lib/live-captions/protocol";
import { openCaption, parseSealed, sealCaption, type CaptionKeyring } from "@/lib/live-captions/crypto";
import { nativeSpeechSupported, NativeSpeechCaptioner } from "@/lib/live-captions/native-speech";
import { languageName } from "@/lib/translation/core";
import { LanguageSelect, ToggleRow } from "@/features/translation/language-picker";
import { usePreferences } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useVoiceE2EEState, type VoiceE2EEMode } from "@/features/call/voice-e2ee";

export type CaptionStatus = "idle" | "listening" | "muted" | "unsupported" | "denied" | "e2eeBlocked" | "error";

interface LiveCaptionsState {
  publish: boolean;
  status: CaptionStatus;
  onDevice: boolean | null;
  lines: CaptionLine[];
  captioning: string[];
  setPublish: (publish: boolean) => void;
  setStatus: (status: CaptionStatus) => void;
  reset: () => void;
}

/** `publish` saklanmaz (her aramada kapalı); göster/dil tercihleri preferences'ta. */
export const useLiveCaptions = create<LiveCaptionsState>((set) => ({
  publish: false,
  status: "idle",
  onDevice: null,
  lines: [],
  captioning: [],
  setPublish: (publish) => set(publish ? { publish } : { publish, status: "idle", onDevice: null }),
  setStatus: (status) => set({ status }),
  reset: () => set({ publish: false, status: "idle", onDevice: null, lines: [], captioning: [] }),
}));

const STATUS_KEYS: Partial<Record<CaptionStatus, MessageKey>> = {
  listening: "liveCaptions.status.listening",
  muted: "liveCaptions.status.muted",
  unsupported: "liveCaptions.status.unsupported",
  denied: "liveCaptions.status.denied",
  e2eeBlocked: "liveCaptions.status.e2eeBlocked",
  error: "liveCaptions.status.error",
};

/** <LiveKitRoom> içinde: veri mesajları, tanıyıcı, pano. Görsel çizmez. */
export function LiveCaptionsController({ e2eeMode, keyring }: { e2eeMode: VoiceE2EEMode; keyring: CaptionKeyring | null }) {
  const room = useRoomContext();
  const { isMicrophoneEnabled } = useLocalParticipant();
  const publish = useLiveCaptions((s) => s.publish);
  const speechPref = usePreferences((s) => s.captionsSpeechLang);
  const locale = useLocale();
  const lang = resolveSpeechLanguage(speechPref, locale);
  const blocked = e2eeMode === "unsupported";
  const [board] = useState(() => new CaptionBoard());
  // Mikrofon kapalıyken (ya da Bas-Konuş bırakılıyken) tanınan metin gönderilmez.
  const micLiveRef = useRef(isMicrophoneEnabled);
  useEffect(() => {
    micLiveRef.current = isMicrophoneEnabled;
    if (useLiveCaptions.getState().publish && !blocked) {
      const { status, setStatus } = useLiveCaptions.getState();
      if (!isMicrophoneEnabled && status === "listening") setStatus("muted");
      if (isMicrophoneEnabled && status === "muted") setStatus("listening");
    }
  }, [isMicrophoneEnabled, blocked]);

  const syncBoard = useCallback(() => {
    useLiveCaptions.setState({ lines: board.lines(), captioning: board.captioning() });
  }, [board]);

  const transmit = useCallback(
    (plain: Uint8Array): boolean => {
      let bytes = plain;
      if (e2eeMode === "on") {
        const key = keyring?.localKey();
        if (!key) return false;
        bytes = sealCaption({
          plaintext: plain,
          passphrase: key.passphrase,
          index: key.index,
          room: room.name,
          identity: room.localParticipant.identity,
          random: (length) => Crypto.getRandomBytes(length),
        });
      } else if (e2eeMode !== "off") {
        return false;
      }
      void room.localParticipant.publishData(new Uint8Array(bytes), { reliable: true, topic: CAPTIONS_TOPIC }).catch(() => undefined);
      return true;
    },
    [e2eeMode, keyring, room],
  );

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== CAPTIONS_TOPIC || !participant) return;
      let bytes: Uint8Array | null = null;
      if (e2eeMode === "on") {
        const envelope = parseSealed(payload);
        bytes = envelope && keyring ? openCaption({ envelope, keyring, room: room.name, identity: participant.identity }) : null;
      } else if (e2eeMode === "off") {
        bytes = payload;
      }
      const message = bytes ? parseCaption(bytes) : null;
      if (message && board.ingest(participant.identity, message)) syncBoard();
    };
    const onLeft = (participant: RemoteParticipant) => {
      board.remove(participant.identity);
      syncBoard();
    };
    room.on(RoomEvent.DataReceived, onData).on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData).off(RoomEvent.ParticipantDisconnected, onLeft);
    };
  }, [room, e2eeMode, keyring, board, syncBoard]);

  useEffect(() => {
    const id = setInterval(() => {
      if (board.prune()) syncBoard();
    }, 1000);
    return () => clearInterval(id);
  }, [board, syncBoard]);

  useEffect(() => () => useLiveCaptions.getState().reset(), []);

  useEffect(() => {
    if (!publish || blocked) return;
    const localId = room.localParticipant.identity;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const announce = () => {
      if (retry) clearTimeout(retry);
      retry = null;
      if (!transmit(encodeCaption({ v: 1, t: "on", on: true }))) retry = setTimeout(announce, 1000);
      board.ingest(localId, { v: 1, t: "on", on: true });
      syncBoard();
    };
    announce();
    const id = setInterval(announce, CAPTION_HEARTBEAT_MS);
    room.on(RoomEvent.ParticipantConnected, announce);
    return () => {
      clearInterval(id);
      if (retry) clearTimeout(retry);
      room.off(RoomEvent.ParticipantConnected, announce);
      transmit(encodeCaption({ v: 1, t: "on", on: false }));
      board.ingest(localId, { v: 1, t: "on", on: false });
      syncBoard();
    };
  }, [publish, blocked, room, transmit, board, syncBoard]);

  useEffect(() => {
    const store = useLiveCaptions.getState();
    if (!publish) return;
    if (blocked) {
      store.setPublish(false);
      store.setStatus("e2eeBlocked");
      return;
    }
    if (!nativeSpeechSupported()) {
      store.setPublish(false);
      store.setStatus("unsupported");
      return;
    }
    const localId = room.localParticipant.identity;
    const sender = new CaptionSender({
      lang: () => lang,
      send: (bytes) => {
        const message = parseCaption(bytes);
        if (message && board.ingest(localId, message)) syncBoard();
        transmit(bytes);
      },
    });
    const captioner = new NativeSpeechCaptioner({
      lang,
      onResult: (text, final) => {
        if (micLiveRef.current) sender.push(text, final);
      },
      onError: (error) => {
        const s = useLiveCaptions.getState();
        if (error === "denied" || error === "unsupported") s.setPublish(false);
        s.setStatus(error);
      },
      onMode: (onDevice) => useLiveCaptions.setState({ onDevice }),
    });
    store.setStatus(micLiveRef.current ? "listening" : "muted");
    void captioner.start();
    return () => {
      captioner.stop();
      sender.dispose();
    };
  }, [publish, blocked, lang, room, transmit, board, syncBoard]);

  return null;
}

/** Altyazı satırları (sahnenin altında, kontrollerin üstünde). */
export function LiveCaptionsOverlay() {
  const room = useRoomContext();
  const show = usePreferences((s) => s.captionsShow);
  const lines = useLiveCaptions((s) => s.lines);
  if (!show || lines.length === 0) return null;
  const nameOf = (identity: string) => {
    if (identity === room.localParticipant.identity) return room.localParticipant.name || identity;
    return room.remoteParticipants.get(identity)?.name || identity;
  };
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 4, paddingHorizontal: spacing.md }}>
      {lines.slice(-4).map((line) => (
        <Text
          key={`${line.identity}:${line.segment}`}
          style={{
            ...typography.body,
            color: "#fff",
            textAlign: "center",
            backgroundColor: "rgba(0,0,0,0.75)",
            borderRadius: radii.md,
            overflow: "hidden",
            paddingHorizontal: spacing.md,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>{nameOf(line.identity)}: </Text>
          <Text style={{ color: line.final ? "#fff" : "rgba(255,255,255,0.85)" }}>{line.text}</Text>
        </Text>
      ))}
    </View>
  );
}

/** "Altyazılar" düğmesi + alttan açılan panel. */
export function LiveCaptionsButton({ size = 48 }: { size?: number }) {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const { mode } = useVoiceE2EEState();
  const publish = useLiveCaptions((s) => s.publish);
  const status = useLiveCaptions((s) => s.status);
  const onDevice = useLiveCaptions((s) => s.onDevice);
  const show = usePreferences((s) => s.captionsShow);
  const speechLang = usePreferences((s) => s.captionsSpeechLang);
  const setPreference = usePreferences((s) => s.setPreference);
  const [open, setOpen] = useState(false);
  const supported = nativeSpeechSupported();
  const blocked = mode === "unsupported";
  const statusKey = blocked ? STATUS_KEYS.e2eeBlocked : !supported ? STATUS_KEYS.unsupported : STATUS_KEYS[status];
  const active = show || publish;
  const autoLabel = `${t("liveCaptions.languageAuto")} (${languageName(resolveSpeechLanguage("auto", locale), locale)})`;

  return (
    <>
      <IconButton
        icon="captions"
        label={t("liveCaptions.button")}
        size={size}
        background={active ? colors.brand : colors.raised}
        tint={active ? colors.onBrand : colors.bright}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <RNPressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: colors.deep,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.lg,
          }}
        >
          <Text style={{ ...typography.overline, color: colors.muted }}>{t("liveCaptions.title")}</Text>
          <ToggleRow
            label={t("liveCaptions.show.label")}
            description={t("liveCaptions.show.description")}
            value={show}
            onChange={(value) => setPreference("captionsShow", value)}
          />
          <ToggleRow
            label={t("liveCaptions.publish.label")}
            description={t("liveCaptions.publish.description")}
            value={publish}
            disabled={blocked || !supported}
            onChange={(value) => {
              const s = useLiveCaptions.getState();
              s.setStatus("idle");
              s.setPublish(value);
            }}
          />
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("liveCaptions.language")}</Text>
            <LanguageSelect
              label={t("liveCaptions.language")}
              value={speechLang}
              options={[
                { value: "auto", label: autoLabel },
                ...SPEECH_LANGUAGES.map((tag) => ({ value: tag, label: languageName(tag, locale) })),
              ]}
              onChange={(value) => setPreference("captionsSpeechLang", value)}
            />
          </View>
          {statusKey || publish ? (
            <View style={{ gap: 4 }}>
              {statusKey ? (
                <Text style={{ ...typography.caption, color: status === "listening" && !blocked ? colors.success : colors.warning }}>
                  {t(statusKey)}
                </Text>
              ) : null}
              {publish && onDevice === true ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("liveCaptions.status.onDevice")}</Text>
              ) : null}
              {publish && onDevice === false ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("liveCaptions.status.cloud")}</Text>
              ) : null}
              {publish && mode === "on" ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("liveCaptions.status.e2ee")}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

/** Katılımcının yanında "Altyazı açık" (gizlilik göstergesi). */
export function CaptionsBadge({ identity }: { identity: string }) {
  const t = useT();
  const on = useLiveCaptions((s) => s.captioning.includes(identity));
  if (!on) return null;
  return (
    <View
      accessibilityLabel={t("liveCaptions.indicatorHelp")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: colors.raised,
      }}
    >
      <Icon name="captions" size={12} color={colors.bright} />
      <Text style={{ ...typography.caption, fontSize: 11, color: colors.bright }}>{t("liveCaptions.indicator")}</Text>
    </View>
  );
}
