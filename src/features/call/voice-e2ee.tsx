import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoomContext } from "@livekit/react-native";
import { Room, RoomEvent, type RoomOptions } from "livekit-client";

import { Icon, Pressable, showToast, type IconName } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { NativeVoiceE2EE } from "@/lib/voice-e2ee/livekit-native";
import type { VoiceE2EESession, VoiceE2EESnapshot } from "@/lib/voice-e2ee/session";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Uçtan uca şifreli ses — arama arayüzü (lib/voice-e2ee).
 *
 * Web karşılığı: ciklet-web src/components/call/voice-e2ee.tsx — aynı durumlar
 * ("off" sahne, "unsupported", "on"), aynı katılımcı kuralları ve aynı metinler
 * (`voiceE2ee.*`). Yerleşim farkı: webde kontrol çubuğunda kilit düğmesi,
 * mobilde kontrol satırı dolu olduğundan görüşme başlığının altında dokunulabilir
 * bir durum hapı; ikisi de aynı paneli (durum, ses gizlilik kodu, şifrelenmemiş
 * katılımcılar) açar.
 */
export type VoiceE2EEMode = "off" | "unsupported" | "on";
export type ParticipantE2EEState = "encrypted" | "pending" | "unencrypted";
export type CallE2EEState = "off" | "unsupported" | "connecting" | "encrypted" | "mixed";

export interface VoiceE2EEState {
  mode: VoiceE2EEMode;
  call: CallE2EEState;
  participants: Map<string, ParticipantE2EEState>;
  snapshot: VoiceE2EESnapshot;
}

const EMPTY_SNAPSHOT: VoiceE2EESnapshot = { ready: false, localKeyIndex: 0, rotating: false, peers: {}, code: null };
const OFF_STATE: VoiceE2EEState = { mode: "off", call: "off", participants: new Map(), snapshot: EMPTY_SNAPSHOT };
/** Duyurusu gelmeyen katılımcı bu süre sonunda "şifrelenmemiş" sayılır (web ile aynı). */
const ANNOUNCE_GRACE_MS = 8000;

// ── Oda kurulumu ─────────────────────────────────────────────────────────

interface PreparedRoom {
  key: string;
  mode: VoiceE2EEMode;
  handle: NativeVoiceE2EE | null;
  room: Room | null;
}

/**
 * Şifreli oda: Room'u biz kurarız (yönetici yapıcıya girmeli) ve ilk yerel
 * anahtar BAĞLANMADAN takılır. `encrypted` sunucu yanıtından gelir
 * (`roomUsesE2EE`): ana anahtar kapalıysa ya da sahneyse "off" — oda eskisi
 * gibi kurulur, anahtar takası ve kilit arayüzü yok. `attempt`
 * yeniden denemede odayı baştan kurar. `ready` olana kadar LiveKitRoom
 * çizilmemeli.
 */
export function useVoiceE2EERoom(
  token: string | null,
  encrypted: boolean,
  options: RoomOptions,
  attempt = 0
): { ready: boolean; mode: VoiceE2EEMode; session: VoiceE2EESession | null; room: Room | undefined } {
  const key = token ? `${attempt}:${encrypted ? 1 : 0}:${token}` : null;
  const [prepared, setPrepared] = useState<PreparedRoom | null>(null);

  useEffect(() => {
    if (!key || !token) return;
    let cancelled = false;
    let handle: NativeVoiceE2EE | null = null;
    void (async () => {
      if (!encrypted) {
        setPrepared({ key, mode: "off", handle: null, room: null });
        return;
      }
      try {
        handle = await NativeVoiceE2EE.create(token);
      } catch (error) {
        console.warn("[e2ee] kurulamadı", error);
        handle = null;
      }
      if (cancelled) {
        handle?.dispose();
        return;
      }
      let room: Room | null = null;
      if (handle) {
        room = new Room({ ...options, e2ee: handle.roomOptions });
        await handle.attach(room).catch((error) => console.warn("[e2ee] attach", error));
        if (cancelled) {
          handle.dispose();
          return;
        }
      }
      setPrepared({ key, mode: handle ? "on" : "unsupported", handle, room });
    })();
    return () => {
      cancelled = true;
      handle?.dispose();
    };
    // Seçenekler token'la birlikte gelir (kanalın ses ayarları); bağlantı başına bir kez.
  }, [key, token, encrypted, options]);

  if (!prepared || prepared.key !== key) return { ready: false, mode: "off", session: null, room: undefined };
  return { ready: true, mode: prepared.mode, session: prepared.handle?.session ?? null, room: prepared.room ?? undefined };
}

// ── Durum ────────────────────────────────────────────────────────────────

const VoiceE2EEContext = createContext<VoiceE2EEState>(OFF_STATE);

/** <LiveKitRoom> İÇİNDE durur; durum bir kez hesaplanır. */
export function VoiceE2EEProvider({
  mode,
  session,
  children,
}: {
  mode: VoiceE2EEMode;
  session: VoiceE2EESession | null;
  children: ReactNode;
}) {
  const state = useComputedState(mode, session);
  return <VoiceE2EEContext.Provider value={state}>{children}</VoiceE2EEContext.Provider>;
}

export function useVoiceE2EEState(): VoiceE2EEState {
  return useContext(VoiceE2EEContext);
}

function hasUnencryptedTrack(room: Room, identity: string): boolean {
  const participant = room.remoteParticipants.get(identity);
  if (!participant) return false;
  for (const publication of participant.trackPublications.values()) {
    if (!publication.isEncrypted) return true;
  }
  return false;
}

function sameStates(a: Map<string, ParticipantE2EEState>, b: Map<string, ParticipantE2EEState>): boolean {
  return a.size === b.size && [...a].every(([id, state]) => b.get(id) === state);
}

/**
 * Durum olaylarla (katılımcı/parça değişimi, oturum anlık görüntüsü) ve
 * duyuru bekleme süresi için saniyede bir yeniden hesaplanır; değişmediyse
 * aynı nesne kalır (tüketiciler boşuna yeniden çizilmesin).
 */
function useComputedState(mode: VoiceE2EEMode, session: VoiceE2EESession | null): VoiceE2EEState {
  const room = useRoomContext();
  const [state, setState] = useState<VoiceE2EEState>(OFF_STATE);

  useEffect(() => {
    if (mode === "off") {
      const id = setTimeout(() => setState(OFF_STATE), 0);
      return () => clearTimeout(id);
    }
    const firstSeen = new Map<string, number>();
    let last: VoiceE2EEState | null = null;
    const recompute = () => {
      const snapshot = session?.getSnapshot() ?? EMPTY_SNAPSHOT;
      const participants = new Map<string, ParticipantE2EEState>();
      if (mode === "on") {
        const now = Date.now();
        for (const identity of room.remoteParticipants.keys()) {
          if (!firstSeen.has(identity)) firstSeen.set(identity, now);
          if (hasUnencryptedTrack(room, identity)) participants.set(identity, "unencrypted");
          else if (snapshot.peers[identity] === "encrypted") participants.set(identity, "encrypted");
          else if (snapshot.peers[identity] === "pending" || now - (firstSeen.get(identity) ?? now) < ANNOUNCE_GRACE_MS)
            participants.set(identity, "pending");
          else participants.set(identity, "unencrypted");
        }
        for (const identity of [...firstSeen.keys()]) if (!room.remoteParticipants.has(identity)) firstSeen.delete(identity);
      }
      let call: CallE2EEState;
      if (mode === "unsupported") call = "unsupported";
      else {
        const states = [...participants.values()];
        if (states.includes("unencrypted")) call = "mixed";
        else if (!snapshot.ready || states.includes("pending")) call = "connecting";
        else call = "encrypted";
      }
      if (last && last.call === call && last.snapshot === snapshot && sameStates(last.participants, participants)) return;
      last = { mode, call, participants: last && sameStates(last.participants, participants) ? last.participants : participants, snapshot };
      setState(last);
    };

    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.ParticipantEncryptionStatusChanged,
      RoomEvent.Connected,
    ] as const;
    for (const event of events) room.on(event, recompute);
    const unsubscribe = session?.subscribe(recompute);
    const interval = setInterval(recompute, 1000);
    const first = setTimeout(recompute, 0);
    return () => {
      for (const event of events) room.off(event, recompute);
      unsubscribe?.();
      clearInterval(interval);
      clearTimeout(first);
    };
  }, [mode, session, room]);

  return state;
}

// ── Arayüz ───────────────────────────────────────────────────────────────

const STATUS_ICON: Record<Exclude<CallE2EEState, "off">, IconName> = {
  encrypted: "lock",
  connecting: "lock",
  mixed: "shield",
  unsupported: "unlock",
};

function statusColor(state: Exclude<CallE2EEState, "off">): string {
  if (state === "encrypted") return colors.success;
  if (state === "mixed") return colors.warning;
  if (state === "unsupported") return colors.danger;
  return colors.muted;
}

/**
 * Görüşme başlığının altındaki şifreleme hapı; dokununca ses gizlilik kodu
 * paneli açılır. `onDark`: görüntülü sahnede siyah zemin üstünde.
 */
export function VoiceE2EEPill({ onDark = false }: { onDark?: boolean }) {
  const t = useT();
  const { call } = useVoiceE2EEState();
  const [open, setOpen] = useState(false);
  if (call === "off") return null;
  const tint = statusColor(call);
  const label = t(`voiceE2ee.status.${call}`);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "center",
          paddingVertical: 4,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.full,
          backgroundColor: onDark ? "rgba(0,0,0,0.45)" : colors.raised,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name={STATUS_ICON[call]} size={14} color={tint} />
        <Text style={{ ...typography.caption, ...fw(600), color: onDark ? "#ffffff" : colors.bright }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <VoiceE2EESheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function VoiceE2EESheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { call, participants, snapshot } = useVoiceE2EEState();
  if (call === "off") return null;
  const unencrypted = [...participants.entries()]
    .filter(([, state]) => state === "unencrypted")
    .map(([identity]) => room.remoteParticipants.get(identity)?.name || identity);
  const code = snapshot.code;

  const copy = async () => {
    if (!code) return;
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(code.join(" "));
    showToast(t("voiceE2ee.code.copied"));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <RNPressable
          onPress={() => undefined}
          accessible={false}
          style={{
            maxHeight: "80%",
            marginHorizontal: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: spacing.lg,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <ScrollView contentContainerStyle={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name={STATUS_ICON[call]} size={18} color={statusColor(call)} />
              <Text style={{ ...typography.title, color: colors.bright }}>{t(`voiceE2ee.status.${call}`)}</Text>
            </View>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t(`voiceE2ee.body.${call}`)}</Text>

            {call !== "unsupported" ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>{t("voiceE2ee.code.title")}</Text>
                {code ? (
                  <Pressable
                    onPress={() => void copy()}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={t("voiceE2ee.code.copy")}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      rowGap: spacing.xs,
                      padding: spacing.md,
                      borderRadius: radii.lg,
                      backgroundColor: pressed ? colors.brandSoft : colors.raised,
                    })}
                  >
                    {code.map((group, index) => (
                      <Text
                        key={index}
                        style={{ width: "33%", textAlign: "center", fontFamily: "monospace", fontSize: 18, letterSpacing: 1, color: colors.bright, ...fw(600) }}
                      >
                        {group}
                      </Text>
                    ))}
                  </Pressable>
                ) : (
                  <Text style={{ ...typography.caption, color: colors.muted }}>{t("voiceE2ee.code.waiting")}</Text>
                )}
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("voiceE2ee.code.help")}</Text>
              </View>
            ) : null}

            {unencrypted.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>{t("voiceE2ee.unencrypted.title")}</Text>
                {unencrypted.map((name) => (
                  <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Icon name="unlock" size={14} color={colors.warning} />
                    <Text style={{ ...typography.caption, color: colors.bright }} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}

/** Katılımcı satırında / kutucuğunda "Şifrelenmemiş katılımcı" rozeti. */
export function E2EEParticipantBadge({ identity, compact = false }: { identity: string | undefined; compact?: boolean }) {
  const t = useT();
  const { mode, participants } = useVoiceE2EEState();
  if (mode !== "on" || !identity || participants.get(identity) !== "unencrypted") return null;
  if (compact) {
    return (
      <View
        accessibilityLabel={t("voiceE2ee.unencrypted.badge")}
        style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.warning }}
      >
        <Icon name="unlock" size={12} color="#000000" />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={t("voiceE2ee.unencrypted.badge")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: radii.full,
        backgroundColor: colors.warning,
      }}
    >
      <Icon name="unlock" size={12} color="#000000" />
      <Text style={{ ...typography.caption, fontSize: 11, color: "#000000", ...fw(600) }} numberOfLines={1}>
        {t("voiceE2ee.unencrypted.badge")}
      </Text>
    </View>
  );
}
