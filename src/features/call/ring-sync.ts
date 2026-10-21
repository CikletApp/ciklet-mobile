/**
 * Gelen aramanın zili — saf kurallar (ciklet-web `lib/calls/ringing.ts` ile
 * aynı).
 *
 * Alıcının başka bir cihazı aramayı yanıtlayınca bu cihaza
 * `call.handled_elsewhere` gelir; ama yayın EN FAZLA BİR KEZ teslim edilir.
 * Soket o an kopuksa (ağ değişimi, arka plan) olay kaçıyor ve kabul edilen
 * davet sunucuda süpürülmediği için `call.cancelled` da gelmiyordu: uygulama
 * içi zil susmuyordu. İki emniyet:
 *
 *   1. Yerel süre: zil en çok davet süresi kadar çalar.
 *   2. Bekleyen davetler sorulduğunda sunucuda artık çalmayan davet yerelde
 *      de kapatılır.
 */

/** Sunucudaki davet süresi (ciklet-web lib/calls/store CALL_RING_MS). */
export const CALL_RING_MS = 45_000;
/** Yerel sayaç sunucudan biraz sonra dolsun: sunucunun kapanışı önce gelsin. */
export const LOCAL_RING_GRACE_MS = 2_000;
/** Saat kayması emniyeti — ileri giden saat zili hemen susturmasın. */
export const MIN_LOCAL_RING_MS = 5_000;

/** Bu cihazda zilin kendiliğinden susacağı ana kadar kalan süre (ms). */
export function localRingRemainingMs(expiresAt: number | null | undefined, now: number): number {
  const remaining =
    typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt - now : CALL_RING_MS;
  return Math.min(CALL_RING_MS, Math.max(MIN_LOCAL_RING_MS, remaining)) + LOCAL_RING_GRACE_MS;
}

/**
 * Yerelde ÇALAN gelen davet sunucuda artık bekleyenler arasında değil mi?
 * Yalnızca çalan gelen aramaya bakılır; bağlı görüşmeye dokunulmaz.
 */
export function isStaleRinging(
  session: { callId: string | null; direction: string; status: string } | null | undefined,
  pendingIds: readonly string[]
): boolean {
  if (!session || session.direction !== "incoming" || session.status !== "ringing" || !session.callId) return false;
  return !pendingIds.includes(session.callId);
}
