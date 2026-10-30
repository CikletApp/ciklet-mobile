/**
 * ciklet-web `src/lib/join-application.ts` ile AYNI — iki tarafta birlikte değişmeli.
 *
 * Katılım başvurusu (Discord "Apply to Join") — saf kurallar (istemci +
 * sunucu; mobil `src/lib/join-application.ts` ile AYNI).
 *
 * Sunucu ayarı (Server.joinApplication): açıkken davetle ya da keşfetten
 * gelen kişi doğrudan üye olmaz; en çok 5 soruluk formu (kısa yanıt /
 * paragraf / çoktan seçmeli) ve istenirse sunucu kurallarının kabulünü
 * doldurur. Başvuru moderatör kuyruğuna düşer; başvuran onaylanana kadar
 * üye değildir, kanalları göremez. Onayda üyelik açılır, retle (isteğe
 * bağlı sebeple) kapanır; iki durumda da başvurana resmî hesaptan DM gider.
 */

export type JoinQuestionType = "short" | "paragraph" | "choice";
export const JOIN_QUESTION_TYPES: readonly JoinQuestionType[] = ["short", "paragraph", "choice"];

export const JOIN_APPLICATION_MAX_QUESTIONS = 5;
export const JOIN_QUESTION_LABEL_MAX = 150;
export const JOIN_SHORT_ANSWER_MAX = 150;
export const JOIN_PARAGRAPH_ANSWER_MAX = 1000;
export const JOIN_CHOICE_OPTIONS_MAX = 10;
export const JOIN_CHOICE_OPTION_MAX = 80;
export const JOIN_REJECT_REASON_MAX = 300;
export const JOIN_DESCRIPTION_MAX = 300;

export interface JoinQuestion {
  id: string;
  type: JoinQuestionType;
  label: string;
  required: boolean;
  /** Yalnızca "choice". */
  options: string[];
}

export interface JoinApplicationConfig {
  enabled: boolean;
  /** Formun başındaki kısa açıklama (isteğe bağlı). */
  description: string;
  questions: JoinQuestion[];
  /** Sunucu kurallarının kabulü zorunlu mu (kural metni varsa gösterilir). */
  requireRules: boolean;
}

export const DEFAULT_JOIN_APPLICATION: Readonly<JoinApplicationConfig> = Object.freeze({
  enabled: false,
  description: "",
  questions: [],
  requireRules: true,
});

export type JoinApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface JoinAnswer {
  questionId: string;
  /** Soru metninin anlık görüntüsü (sonradan değişse de inceleme anlamlı kalsın). */
  label: string;
  type: JoinQuestionType;
  value: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function newQuestionId(): string {
  return `q${Math.random().toString(36).slice(2, 10)}`;
}

/** Veritabanından/istekten gelen ayarı geçerli hâle getirir. */
export function normalizeJoinApplicationConfig(raw: unknown): JoinApplicationConfig {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const questions: JoinQuestion[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.questions) ? r.questions : []) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const type = JOIN_QUESTION_TYPES.includes(q.type as JoinQuestionType) ? (q.type as JoinQuestionType) : "short";
    const label = text(q.label, JOIN_QUESTION_LABEL_MAX);
    if (!label) continue;
    let id = typeof q.id === "string" && ID_RE.test(q.id) ? q.id : newQuestionId();
    if (seen.has(id)) id = newQuestionId();
    seen.add(id);
    const options =
      type === "choice"
        ? [...new Set((Array.isArray(q.options) ? q.options : []).map((o) => text(o, JOIN_CHOICE_OPTION_MAX)).filter(Boolean))].slice(0, JOIN_CHOICE_OPTIONS_MAX)
        : [];
    // Seçeneksiz çoktan seçmeli soru anlamsız: atlanır.
    if (type === "choice" && options.length < 2) continue;
    questions.push({ id, type, label, required: q.required !== false, options });
    if (questions.length >= JOIN_APPLICATION_MAX_QUESTIONS) break;
  }
  return {
    enabled: r.enabled === true,
    description: text(r.description, JOIN_DESCRIPTION_MAX),
    questions,
    requireRules: r.requireRules !== false,
  };
}

/** Başvuru açık mı (null/bozuk → kapalı). */
export function joinApplicationEnabled(raw: unknown): boolean {
  return normalizeJoinApplicationConfig(raw).enabled;
}

export function answerMax(type: JoinQuestionType): number {
  return type === "paragraph" ? JOIN_PARAGRAPH_ANSWER_MAX : type === "short" ? JOIN_SHORT_ANSWER_MAX : JOIN_CHOICE_OPTION_MAX;
}

export type AnswerValidation = { ok: true; answers: JoinAnswer[] } | { ok: false; error: string };

/**
 * Yanıtları doğrular: zorunlu sorular dolu, çoktan seçmelide değer
 * seçeneklerden biri, uzunluk sınırları; bilinmeyen soru yok sayılır.
 * `rulesAccepted`: kurallar zorunlu ve metin varsa true olmalı.
 */
export function validateJoinAnswers(
  config: JoinApplicationConfig,
  raw: unknown,
  rules: { rulesText: string | null; rulesAccepted: boolean },
): AnswerValidation {
  const byId = new Map<string, string>();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (typeof a.questionId === "string" && typeof a.value === "string") byId.set(a.questionId, a.value);
  }
  const answers: JoinAnswer[] = [];
  for (const q of config.questions) {
    const value = (byId.get(q.id) ?? "").trim();
    if (!value) {
      if (q.required) return { ok: false, error: `“${q.label}” sorusunu yanıtlamalısın.` };
      continue;
    }
    if (value.length > answerMax(q.type)) return { ok: false, error: `“${q.label}” yanıtı en çok ${answerMax(q.type)} karakter olabilir.` };
    if (q.type === "choice" && !q.options.includes(value)) return { ok: false, error: `“${q.label}” için geçerli bir seçenek seç.` };
    answers.push({ questionId: q.id, label: q.label, type: q.type, value });
  }
  if (config.requireRules && rules.rulesText?.trim() && !rules.rulesAccepted) {
    return { ok: false, error: "Sunucu kurallarını kabul etmelisin." };
  }
  return { ok: true, answers };
}

export function readJoinAnswers(raw: unknown): JoinAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
    .map((a) => ({
      questionId: typeof a.questionId === "string" ? a.questionId : "",
      label: typeof a.label === "string" ? a.label : "",
      type: JOIN_QUESTION_TYPES.includes(a.type as JoinQuestionType) ? (a.type as JoinQuestionType) : "short",
      value: typeof a.value === "string" ? a.value : "",
    }));
}

export const APPLICATION_REQUIRED_MESSAGE = "Bu sunucuya katılmak için başvuru formunu doldurman gerekiyor.";
export const APPLICATION_PENDING_MESSAGE = "Başvurun inceleniyor. Onaylanınca sunucuya katılacaksın.";

/** Başvurana giden DM metinleri. */
export function applicationDecisionText(serverName: string, approved: boolean, reason?: string | null): string {
  if (approved) return `“${serverName}” sunucusuna katılım başvurun onaylandı. Artık sunucunun bir üyesisin!`;
  const why = reason?.trim() ? ` Sebep: ${reason.trim()}` : "";
  return `“${serverName}” sunucusuna katılım başvurun reddedildi.${why}`;
}
