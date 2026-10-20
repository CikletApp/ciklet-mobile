/**
 * DM'de süren görüşmenin bandı — "Katıl" ya da "Buraya aktar".
 *
 * Katılımcılar ağ geçidinin `voice.update` karesinden (ciklet-web
 * `gateway/src/voice.rs` `Member`). Kullanıcının KENDİSİ listedeyse ama bu
 * cihazda çağrı yoksa görüşme başka bir cihazında sürüyor: bant onu buraya
 * aktarmayı önerir. Katılmak aktarımın kendisi — LiveKit kimliği her cihazda
 * aynı ve ikinci cihaz katılınca ilkini `DUPLICATE_IDENTITY` ile düşürür.
 *
 * Metinler ciklet-web `lib/calls/ongoing-call.ts` ile aynı — kullanıcı aynı
 * durumu iki cihazda farklı cümleyle görmemeli. Yalnızca diğer cihazın adı
 * bu cihazın telefon olmasına göre seçiliyor.
 */

export interface OngoingCallParticipant {
  id: string;
  username: string;
  name?: string | null;
  imageUrl?: string | null;
  callType?: string;
  /** "web" | "desktop" | "mobile" — ağ geçidi bilmiyorsa yok. */
  device?: string;
}

export interface OngoingCallBanner {
  /** "elsewhere": kullanıcı başka cihazında görüşmede; "join": başkaları görüşmede. */
  kind: "elsewhere" | "join";
  title: string;
  subtitle: string;
  actionLabel: string;
  callType: "audio" | "video";
}

function displayName(participant: OngoingCallParticipant): string {
  return participant.name?.trim() || participant.username;
}

/** "Hakan", "Hakan ve Ayşe", "Hakan ve 2 kişi". */
function peopleText(people: OngoingCallParticipant[]): string {
  const [first, second] = people;
  if (people.length === 1) return displayName(first);
  if (people.length === 2) return `${displayName(first)} ve ${displayName(second)}`;
  return `${displayName(first)} ve ${people.length - 1} kişi`;
}

function elsewhereTitle(device: string | undefined): string {
  switch (device) {
    case "mobile":
      // Bu cihaz da telefon: "telefonunda" yanıltıcı olurdu.
      return "Başka bir telefonda görüşüyorsun";
    case "desktop":
      return "Masaüstü uygulamasında görüşüyorsun";
    case "web":
      return "Tarayıcıda görüşüyorsun";
    default:
      return "Başka bir cihazda görüşmedesin";
  }
}

/** Bandın içeriği; gösterilecek bir şey yoksa `null`. Çağıran, bu cihazda çağrı olmadığından emin olmalı. */
export function describeOngoingCall(
  participants: readonly OngoingCallParticipant[],
  selfId: string | null | undefined
): OngoingCallBanner | null {
  const seen = new Set<string>();
  const unique = participants.filter((participant) => {
    if (!participant?.id || seen.has(participant.id)) return false;
    seen.add(participant.id);
    return true;
  });
  if (unique.length === 0) return null;

  const self = selfId ? unique.find((participant) => participant.id === selfId) : undefined;
  const others = unique.filter((participant) => participant.id !== selfId);

  if (self) {
    return {
      kind: "elsewhere",
      title: elsewhereTitle(self.device),
      subtitle:
        others.length === 0
          ? "Görüşmeyi buraya aktarabilirsin"
          : `${peopleText(others)} ile görüşmedesin · Buraya aktarabilirsin`,
      actionLabel: "Buraya aktar",
      callType: self.callType === "video" ? "video" : "audio",
    };
  }

  return {
    kind: "join",
    title: "Görüşme şu an devam ediyor",
    subtitle: `${peopleText(others)} görüşmede`,
    actionLabel: "Katıl",
    callType: others.some((participant) => participant.callType === "video") ? "video" : "audio",
  };
}

/** Eski cihazda gösterilen bildirim — görüşme bitmedi, yalnızca taşındı. */
export const CALL_TRANSFERRED_MESSAGE = "Görüşme başka bir cihaza aktarıldı";
