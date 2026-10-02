import { Platform, Vibration } from "react-native";

import CikletCalls from "../../../modules/ciklet-calls";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { resolveMediaUrl } from "@/lib/config";
import { stopRingtone } from "@/lib/sounds";
import { useCall, type CallPeer } from "@/stores/call";

/**
 * Gelen arama — uygulama ARKA PLANDA ya da KAPALIYKEN.
 *
 * Ön plandayken zil ekranını CallOverlay çizer ve zili expo-audio çalar.
 * Diğer durumlarda Android'de yerel modül (modules/ciklet-calls) sistem
 * bildirimi gösterir: kilitli ekranda TAM EKRAN zil, açık ekranda üstte
 * Cevapla/Reddet'li kart; zil sesi bildirim kanalından döner. Kullanıcı
 * bildirimden gelince uygulama `ciklet://call/incoming?...` ile açılır
 * (app/call/incoming.tsx) ve buradaki bekleyen eylem tüketilir.
 */

export interface IncomingCallInfo {
  callId: string;
  caller: CallPeer;
  video: boolean;
  directId: string | null;
  expiresAt?: number | null;
  declineUrl?: string | null;
}

/** Yerel modül yalnızca Android'de; iOS ve modülsüz derlemede `null`. */
export const nativeIncomingCalls = Platform.OS === "android" ? CikletCalls : null;

/** Sistem bildirimini gösterir; gösterilemediyse `false` (çağıran JS ziline düşer). */
export async function presentIncomingCallNotification(info: IncomingCallInfo): Promise<boolean> {
  if (!nativeIncomingCalls) return false;
  try {
    await nativeIncomingCalls.showIncomingCall({
      callId: info.callId,
      callerName: info.caller.name?.trim() || info.caller.username,
      callerAvatarUrl: resolveMediaUrl(info.caller.imageUrl) ?? null,
      video: info.video,
      directId: info.directId,
      expiresAt: info.expiresAt ?? null,
      declineUrl: info.declineUrl ?? null,
    });
    return true;
  } catch (error) {
    console.warn("[arama] sistem bildirimi gösterilemedi:", error instanceof Error ? error.message : error);
    return false;
  }
}

export function dismissIncomingCallNotification(callId?: string | null): void {
  try {
    nativeIncomingCalls?.dismissIncomingCall(callId ?? null);
  } catch {
    /* modül yok ya da bildirim zaten düşmüş */
  }
}

/** Android 14+: tam ekran izni kapalıysa kullanıcıyı ayarlara yönlendirmek için. */
export function canShowFullScreenCall(): boolean {
  try {
    return nativeIncomingCalls?.canUseFullScreenIntent() ?? false;
  } catch {
    return false;
  }
}

export function openFullScreenCallSettings(): void {
  try {
    nativeIncomingCalls?.openFullScreenIntentSettings();
  } catch {
    /* yok say */
  }
}

// ── Bildirimden gelen eylem ──────────────────────────────────────────────

export type PendingCallAction = "accept" | "show";

interface PendingCall {
  callId: string;
  action: PendingCallAction;
  at: number;
}

/** Derin bağlantıdan gelen eylem; davet listesi yüklenince `ring` tüketir. */
let pending: PendingCall | null = null;
const PENDING_TTL_MS = 60_000;

export function setPendingCallAction(callId: string, action: PendingCallAction): void {
  pending = { callId, action, at: Date.now() };
}

export function consumePendingCallAction(callId: string): PendingCallAction | null {
  if (!pending || pending.callId !== callId) return null;
  const { action, at } = pending;
  pending = null;
  return Date.now() - at > PENDING_TTL_MS ? null : action;
}

// ── Kabul / ret (kanca dışından da çağrılabilir) ─────────────────────────

/** Gelen aramayı kabul et; `directId` LiveKit oda adıdır. */
export function acceptIncomingCall(directId: string): void {
  const session = useCall.getState().session;
  if (!session || session.direction !== "incoming" || session.status !== "ringing") return;
  Vibration.cancel();
  stopRingtone();
  dismissIncomingCallNotification(session.callId);
  void api(endpoints.callAccept, {
    method: "POST",
    body: { callId: session.callId, callerId: session.peer.id },
  }).catch(() => {});
  useCall.setState({ session: { ...session, directId } });
  useCall.getState().markConnected();
}

/** Gelen aramayı reddet. */
export function declineIncomingCall(): void {
  const session = useCall.getState().session;
  if (!session) return;
  Vibration.cancel();
  stopRingtone();
  dismissIncomingCallNotification(session.callId);
  void api(endpoints.callDecline, {
    method: "POST",
    body: { callId: session.callId, callerId: session.peer.id },
  }).catch(() => {});
  useCall.getState().end();
}
