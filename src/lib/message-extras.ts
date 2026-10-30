/**
 * Web'in yeni mesaj alanlarının okuyucuları (ciklet-web lib/multi-attachments,
 * lib/stickers, lib/polls, lib/sensitive-media). Yalnızca okuma; kurallar
 * sunucuda.
 */

export interface ExtraAttachment {
  url: string;
  name?: string;
  type?: string;
  size?: number;
}

/** `metadata.attachments`'ın ilki dışındakiler (ilki zaten `fileUrl`). */
export function extraAttachments(metadata: unknown, fileUrl: string | null | undefined): ExtraAttachment[] {
  if (!metadata || typeof metadata !== "object" || !fileUrl) return [];
  const list = (metadata as { attachments?: unknown }).attachments;
  if (!Array.isArray(list)) return [];
  const entries: ExtraAttachment[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.url !== "string" || !/^https:\/\//.test(r.url)) continue;
    entries.push({
      url: r.url,
      ...(typeof r.name === "string" ? { name: r.name } : {}),
      ...(typeof r.type === "string" ? { type: r.type } : {}),
      ...(typeof r.size === "number" ? { size: r.size } : {}),
    });
  }
  if (entries.length < 2 || entries[0].url !== fileUrl) return [];
  return entries.slice(1, 10);
}

export interface StickerMeta {
  id: string;
  name: string;
  imageUrl: string;
}

export function readSticker(metadata: unknown): StickerMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const s = (metadata as { sticker?: unknown }).sticker;
  if (!s || typeof s !== "object") return null;
  const { id, name, imageUrl } = s as Record<string, unknown>;
  if (typeof id !== "string" || typeof name !== "string" || typeof imageUrl !== "string") return null;
  if (!/^https:\/\//.test(imageUrl)) return null;
  return { id, name, imageUrl };
}

export function isSensitive(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as { sensitive?: unknown }).sensitive === true);
}

export function isSpoilerName(name: string | null | undefined): boolean {
  return typeof name === "string" && name.toUpperCase().startsWith("SPOILER_");
}

export interface PollOption {
  id: string;
  text: string;
  /** Seçenek emojisi (unicode ya da Dokimorji); yoksa null. */
  emoji?: string | null;
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiple: boolean;
  expiresAt: string | null;
  votes: Record<string, string[]>;
  /** "Anketi bitir" ile erken bitirildiyse an (ISO). */
  endedAt?: string | null;
}

export function readPoll(metadata: unknown): Poll | null {
  if (!metadata || typeof metadata !== "object") return null;
  const p = (metadata as { poll?: unknown }).poll;
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  if (typeof r.question !== "string" || !Array.isArray(r.options)) return null;
  const options = r.options
    .filter((o): o is PollOption => !!o && typeof o === "object" && typeof (o as PollOption).id === "string" && typeof (o as PollOption).text === "string")
    .map((o) => ({ id: o.id, text: o.text, emoji: typeof o.emoji === "string" && o.emoji ? o.emoji : null }));
  const votes: Record<string, string[]> = {};
  if (r.votes && typeof r.votes === "object") {
    for (const [k, v] of Object.entries(r.votes as Record<string, unknown>)) {
      if (Array.isArray(v)) votes[k] = v.filter((x): x is string => typeof x === "string");
    }
  }
  return {
    question: r.question,
    options,
    multiple: r.multiple === true,
    expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    votes,
    endedAt: typeof r.endedAt === "string" ? r.endedAt : null,
  };
}

export function pollClosed(poll: Poll, now = Date.now()): boolean {
  return poll.expiresAt !== null && new Date(poll.expiresAt).getTime() <= now;
}

/** Anket sonucu satırının özeti (web lib/polls `PollResultSummary`). */
export interface PollResult {
  pollMessageId: string;
  question: string;
  winners: { id: string; text: string; emoji: string | null; count: number }[];
  totalVotes: number;
  voters: number;
}

/** `metadata.pollResult` (web `readPollResult`); bozuksa null. */
export function readPollResult(metadata: unknown): PollResult | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { pollResult?: unknown }).pollResult;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.pollMessageId !== "string" || typeof r.question !== "string") return null;
  const winners = Array.isArray(r.winners)
    ? r.winners.flatMap((w) => {
        if (!w || typeof w !== "object") return [];
        const x = w as Record<string, unknown>;
        if (typeof x.id !== "string" || typeof x.text !== "string" || typeof x.count !== "number") return [];
        return [{ id: x.id, text: x.text, emoji: typeof x.emoji === "string" ? x.emoji : null, count: x.count }];
      })
    : [];
  return {
    pollMessageId: r.pollMessageId,
    question: r.question,
    winners,
    totalVotes: typeof r.totalVotes === "number" ? r.totalVotes : 0,
    voters: typeof r.voters === "number" ? r.voters : 0,
  };
}

/**
 * Sonucun tek satırı — web `describePollOutcome` ile BİREBİR aynı metin:
 * "Kazanan: 🍕 Pizza (3 oy, %60)", "Berabere: A, B (her biri 2 oy)",
 * "Kimse oy vermedi".
 */
export function describePollOutcome(result: PollResult): string {
  if (result.winners.length === 0 || result.totalVotes === 0) return "Kimse oy vermedi";
  const label = (w: PollResult["winners"][number]) => (w.emoji ? `${w.emoji} ${w.text}` : w.text);
  const count = result.winners[0].count;
  const percent = Math.round((count / result.totalVotes) * 100);
  if (result.winners.length > 1) return `Berabere: ${result.winners.map(label).join(", ")} (her biri ${count} oy)`;
  return `Kazanan: ${label(result.winners[0])} (${count} oy, %${percent})`;
}

const TR_VOWEL_SUFFIX: Record<string, string> = {
  a: "ın", ı: "ın", â: "ın",
  e: "in", i: "in", î: "in",
  o: "un", u: "un", û: "un",
  ö: "ün", ü: "ün",
};

/**
 * Adın Türkçe iyelik hâli (web lib/i18n/possessive): "Ali" → "Ali'nin",
 * "Burak" → "Burak'ın". Son karakter harf değilse ad eksiz döner.
 */
export function possessiveName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLocaleLowerCase("tr-TR");
  const last = lower[lower.length - 1];
  if (!/\p{L}/u.test(last)) return trimmed;
  for (let i = lower.length - 1; i >= 0; i--) {
    const suffix = TR_VOWEL_SUFFIX[lower[i]];
    if (!suffix) continue;
    return `${trimmed}'${i === lower.length - 1 ? "n" : ""}${suffix}`;
  }
  return trimmed;
}

/** `@silent` / `@sessiz` ile gönderildi: bildirim üretmedi (web lib/silent-message). */
export function isSilent(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as { silent?: unknown }).silent === true);
}

export interface InteractionMeta {
  name: string;
  username: string;
  /** "component": buton / seçim menüsü etkileşimi; yoksa eğik çizgi komutu. */
  kind?: string;
}

/** Bot yanıtının "X /komut komutunu kullandı" bilgisi (web `metadata.interaction`). */
export function readInteraction(metadata: unknown): { interaction: InteractionMeta; pending: boolean } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { interaction?: unknown; interactionPending?: unknown };
  const i = m.interaction;
  if (!i || typeof i !== "object") return null;
  const { name, username, kind } = i as Record<string, unknown>;
  if (typeof name !== "string" || typeof username !== "string") return null;
  return {
    interaction: { name, username, ...(typeof kind === "string" ? { kind } : {}) },
    pending: m.interactionPending === true,
  };
}

export interface ThreadMeta {
  id: string;
  name: string;
}

/** Mesajdan açılmış alt başlık (web lib/threads `readThreadMeta`). */
export function readThread(metadata: unknown): ThreadMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const t = (metadata as { thread?: unknown }).thread;
  if (!t || typeof t !== "object") return null;
  const { id, name } = t as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string" ? { id, name } : null;
}

// ── Mesaj bileşenleri (web lib/message-components; sunucu temizler) ──

export interface ButtonComponent {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label?: string;
  emoji?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

export interface SelectMenuComponent {
  type: 3;
  custom_id: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
}

export interface ActionRow {
  components: (ButtonComponent | SelectMenuComponent)[];
}

/** `metadata.components` — tanınmayan parçalar atlanır, en çok 5 satır. */
export function readComponents(metadata: unknown): ActionRow[] {
  if (!metadata || typeof metadata !== "object") return [];
  const rows = (metadata as { components?: unknown }).components;
  if (!Array.isArray(rows)) return [];
  const out: ActionRow[] = [];
  for (const row of rows.slice(0, 5)) {
    const list = row && typeof row === "object" ? (row as { components?: unknown }).components : null;
    if (!Array.isArray(list)) continue;
    const components: ActionRow["components"] = [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      if (c.type === 2) {
        const style = [1, 2, 3, 4, 5].includes(Number(c.style)) ? (Number(c.style) as ButtonComponent["style"]) : 2;
        const label = typeof c.label === "string" ? c.label : undefined;
        const emoji = typeof c.emoji === "string" ? c.emoji : undefined;
        if (!label && !emoji) continue;
        components.push({
          type: 2,
          style,
          label,
          emoji,
          custom_id: typeof c.custom_id === "string" ? c.custom_id : undefined,
          url: typeof c.url === "string" && /^https?:\/\//.test(c.url) ? c.url : undefined,
          disabled: c.disabled === true,
        });
      } else if (c.type === 3 && typeof c.custom_id === "string" && Array.isArray(c.options)) {
        const options = c.options.flatMap((o): SelectOption[] => {
          if (!o || typeof o !== "object") return [];
          const r = o as Record<string, unknown>;
          if (typeof r.label !== "string" || typeof r.value !== "string") return [];
          return [{
            label: r.label,
            value: r.value,
            description: typeof r.description === "string" ? r.description : undefined,
            emoji: typeof r.emoji === "string" ? r.emoji : undefined,
            default: r.default === true,
          }];
        });
        if (options.length === 0) continue;
        components.push({
          type: 3,
          custom_id: c.custom_id,
          placeholder: typeof c.placeholder === "string" ? c.placeholder : undefined,
          options,
          disabled: c.disabled === true,
        });
      }
    }
    if (components.length > 0) out.push({ components });
  }
  return out;
}

// ── Sesli mesaj (web lib/voice-message) ──────────────────────────────

export const VOICE_MAX_SECONDS = 300;
export const VOICE_WAVEFORM_BARS = 48;

export interface VoiceMeta {
  durationMs: number;
  /** 0–1 arası genlikler, en çok `VOICE_WAVEFORM_BARS`. */
  waveform: number[];
}

export function readVoice(metadata: unknown): VoiceMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as { voice?: unknown }).voice;
  if (!v || typeof v !== "object") return null;
  const { durationMs, waveform } = v as Record<string, unknown>;
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const bars = Array.isArray(waveform)
    ? waveform.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).slice(0, VOICE_WAVEFORM_BARS).map((n) => Math.min(1, Math.max(0, n)))
    : [];
  return { durationMs: Math.min(VOICE_MAX_SECONDS * 1000, durationMs), waveform: bars };
}

export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
