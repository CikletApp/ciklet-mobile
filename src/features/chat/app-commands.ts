/**
 * Uygulama komutları — SAF çekirdek, ciklet-web `lib/application-commands`
 * dosyasının istemcide gereken parçalarının birebir kopyası (tipler,
 * sabitler, `localize`, `resolveInvocation`, `leafOptions`…). Doğrulama
 * hata metinleri sunucuyla AYNI Türkçe metinlerdir; değiştirilecekse iki
 * tarafta birlikte değiştirilir.
 *
 * Discord "application commands" modeli: 1 CHAT_INPUT (eğik çizgi), 2 USER
 * (kullanıcı bağlam menüsü), 3 MESSAGE (mesaj bağlam menüsü). Seçenekler
 * Discord numaralarıyla; tek kademe iç içe: grup → alt komut → seçenekler.
 */

export const ApplicationCommandType = {
  CHAT_INPUT: 1,
  USER: 2,
  MESSAGE: 3,
} as const;
export type ApplicationCommandTypeValue = (typeof ApplicationCommandType)[keyof typeof ApplicationCommandType];

export const ApplicationCommandOptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const;
export type ApplicationCommandOptionTypeValue =
  (typeof ApplicationCommandOptionType)[keyof typeof ApplicationCommandOptionType];

/** Kanal türleri (Discord numaraları): metin 0, ses 2, duyuru 5, alt başlık 11, sahne 13, forum 15. */
export const ChannelType = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  PUBLIC_THREAD: 11,
  GUILD_STAGE_VOICE: 13,
  GUILD_FORUM: 15,
} as const;

export const APP_COMMAND_LIMITS = {
  options: 25,
  stringValue: 6000,
  autocompleteChoices: 25,
} as const;

const COMMAND_LOCALES = [
  "id", "da", "de", "en-GB", "en-US", "es-ES", "es-419", "fr", "hr", "it", "lt", "hu", "nl", "no", "pl",
  "pt-BR", "ro", "fi", "sv-SE", "vi", "tr", "cs", "el", "bg", "ru", "uk", "hi", "th", "zh-CN", "ja", "zh-TW", "ko",
] as const;

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export type Localizations = Partial<Record<(typeof COMMAND_LOCALES)[number], string>>;

export interface CommandOptionChoice {
  name: string;
  name_localizations?: Localizations | null;
  value: string | number;
}

export interface CommandOption {
  type: ApplicationCommandOptionTypeValue;
  name: string;
  name_localizations?: Localizations | null;
  description: string;
  description_localizations?: Localizations | null;
  required?: boolean;
  choices?: CommandOptionChoice[];
  options?: CommandOption[];
  channel_types?: number[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}

/** REST yanıtındaki komut nesnesi (Discord biçimi). */
export interface ApplicationCommandJson {
  id: string;
  application_id: string;
  guild_id?: string;
  type: ApplicationCommandTypeValue;
  name: string;
  name_localizations: Localizations | null;
  description: string;
  description_localizations: Localizations | null;
  options: CommandOption[];
  default_member_permissions: string | null;
  contexts: number[];
  nsfw: boolean;
  dm_permission: boolean;
  integration_types: number[];
  version: string;
}

// ── Yerelleştirme ──────────────────────────────────────────────────────

/** Arayüz dilinden Discord yerel ayarı adayları: "tr" → [tr], "en" → [en-US, en-GB]. */
function localeCandidates(locale: string | null | undefined): string[] {
  if (!locale) return [];
  const l = locale.toLowerCase();
  if (l.startsWith("tr")) return ["tr"];
  if (l.startsWith("en")) return l === "en-gb" ? ["en-GB", "en-US"] : ["en-US", "en-GB"];
  const exact = COMMAND_LOCALES.find((c) => c.toLowerCase() === l);
  return exact ? [exact] : [];
}

/** Yerelleştirilmiş metin; yoksa varsayılan. */
export function localize(base: string, localizations: Localizations | null | undefined, locale: string | null | undefined): string {
  if (!localizations) return base;
  for (const candidate of localeCandidates(locale)) {
    const hit = (localizations as Record<string, string | undefined>)[candidate];
    if (hit) return hit;
  }
  return base;
}

export function isSubcommandOption(o: Pick<CommandOption, "type">): boolean {
  return o.type === ApplicationCommandOptionType.SUB_COMMAND || o.type === ApplicationCommandOptionType.SUB_COMMAND_GROUP;
}

export function hasSubcommands(options: CommandOption[]): boolean {
  return options.some(isSubcommandOption);
}

// ── Çağrı: kullanıcının girdiği seçenekleri doğrulama ─────────────────

/** İstemcinin gönderdiği seçenek (Discord `data.options` biçimi; değerler ham). */
export interface InvocationOptionInput {
  name: string;
  type?: number;
  value?: unknown;
  options?: InvocationOptionInput[];
  focused?: boolean;
}

/** Bota giden seçenek (Discord `data.options`). */
export interface InteractionDataOption {
  name: string;
  type: ApplicationCommandOptionTypeValue;
  value?: string | number | boolean;
  options?: InteractionDataOption[];
  focused?: boolean;
}

export type ReferenceKind = "user" | "channel" | "role" | "mentionable" | "attachment";

export interface OptionReference {
  kind: ReferenceKind;
  id: string;
  option: CommandOption;
}

export interface ResolvedInvocation {
  options: InteractionDataOption[];
  references: OptionReference[];
  /** Alt komut yolu: ["grup", "alt"] ya da ["alt"] ya da []. */
  path: string[];
  focused?: { option: CommandOption; value: string };
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Kullanıcıya gösterilen seçenek adı (Discord istemcisi gibi yerel adla). */
function label(o: CommandOption, locale?: string | null): string {
  return localize(o.name, o.name_localizations, locale);
}

/**
 * Tek seçenek değerinin dönüştürülmesi ve denetimi (web `coerceValue`).
 * Mobilde ayrıca dışa açık: gönderimde hata veren alana odaklanmak için.
 */
export function coerceOptionValue(
  def: CommandOption,
  raw: unknown,
  locale?: string | null,
): { ok: true; value: string | number | boolean; ref?: ReferenceKind } | { ok: false; error: string } {
  const n = label(def, locale);
  switch (def.type) {
    case ApplicationCommandOptionType.STRING: {
      if (typeof raw !== "string") return { ok: false, error: `"${n}" metin olmalı.` };
      const max = def.max_length ?? APP_COMMAND_LIMITS.stringValue;
      if (raw.length > max) return { ok: false, error: `"${n}" en fazla ${max} karakter olabilir.` };
      if (def.min_length !== undefined && raw.length < def.min_length) return { ok: false, error: `"${n}" en az ${def.min_length} karakter olmalı.` };
      if (def.choices && !def.choices.some((c) => c.value === raw)) return { ok: false, error: `"${n}" için listeden bir seçim yapmalısın.` };
      return { ok: true, value: raw };
    }
    case ApplicationCommandOptionType.INTEGER:
    case ApplicationCommandOptionType.NUMBER: {
      const integer = def.type === ApplicationCommandOptionType.INTEGER;
      let v: number | undefined;
      if (typeof raw === "number") v = raw;
      else if (typeof raw === "string" && (integer ? /^-?\d+$/ : /^-?(\d+([.,]\d+)?|[.,]\d+)$/).test(raw.trim())) v = Number(raw.trim().replace(",", "."));
      if (v === undefined || !Number.isFinite(v) || Math.abs(v) > MAX_SAFE) return { ok: false, error: `"${n}" ${integer ? "tam sayı" : "sayı"} olmalı.` };
      if (integer && !Number.isInteger(v)) return { ok: false, error: `"${n}" tam sayı olmalı.` };
      if (def.min_value !== undefined && v < def.min_value) return { ok: false, error: `"${n}" en az ${def.min_value} olmalı.` };
      if (def.max_value !== undefined && v > def.max_value) return { ok: false, error: `"${n}" en fazla ${def.max_value} olabilir.` };
      if (def.choices && !def.choices.some((c) => c.value === v)) return { ok: false, error: `"${n}" için listeden bir seçim yapmalısın.` };
      return { ok: true, value: v };
    }
    case ApplicationCommandOptionType.BOOLEAN: {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (typeof raw === "string") {
        const v = raw.trim().toLocaleLowerCase("tr-TR");
        if (["true", "evet", "1", "yes", "on", "açık", "acik", "doğru", "dogru"].includes(v)) return { ok: true, value: true };
        if (["false", "hayır", "hayir", "0", "no", "off", "kapalı", "kapali", "yanlış", "yanlis"].includes(v)) return { ok: true, value: false };
      }
      return { ok: false, error: `"${n}" Doğru ya da Yanlış olmalı.` };
    }
    case ApplicationCommandOptionType.USER:
    case ApplicationCommandOptionType.CHANNEL:
    case ApplicationCommandOptionType.ROLE:
    case ApplicationCommandOptionType.MENTIONABLE:
    case ApplicationCommandOptionType.ATTACHMENT: {
      if (typeof raw !== "string" || !ID_PATTERN.test(raw)) {
        const what = def.type === ApplicationCommandOptionType.USER ? "bir kullanıcı"
          : def.type === ApplicationCommandOptionType.CHANNEL ? "bir kanal"
          : def.type === ApplicationCommandOptionType.ROLE ? "bir rol"
          : def.type === ApplicationCommandOptionType.MENTIONABLE ? "bir kullanıcı ya da rol"
          : "bir dosya";
        return { ok: false, error: `"${n}" için ${what} seçmelisin.` };
      }
      const ref: ReferenceKind = def.type === ApplicationCommandOptionType.USER ? "user"
        : def.type === ApplicationCommandOptionType.CHANNEL ? "channel"
        : def.type === ApplicationCommandOptionType.ROLE ? "role"
        : def.type === ApplicationCommandOptionType.MENTIONABLE ? "mentionable"
        : "attachment";
      return { ok: true, value: raw, ref };
    }
    default:
      return { ok: false, error: `"${n}" desteklenmeyen seçenek türü.` };
  }
}

function resolveLeaf(
  defs: CommandOption[],
  inputs: InvocationOptionInput[],
  mode: "execute" | "autocomplete",
  out: ResolvedInvocation,
  locale?: string | null,
): { ok: true; options: InteractionDataOption[] } | { ok: false; error: string } {
  const options: InteractionDataOption[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (!input || typeof input.name !== "string") return { ok: false, error: "Geçersiz seçenek." };
    const def = defs.find((d) => d.name === input.name);
    if (!def || isSubcommandOption(def)) return { ok: false, error: `Bilinmeyen seçenek: "${input.name}".` };
    if (seen.has(def.name)) return { ok: false, error: `"${label(def, locale)}" iki kez verilmiş.` };
    seen.add(def.name);
    if (mode === "autocomplete" && input.focused) {
      if (out.focused) return { ok: false, error: "Yalnızca bir seçenek odaklanabilir." };
      if (!def.autocomplete) return { ok: false, error: `"${label(def, locale)}" otomatik tamamlama desteklemiyor.` };
      const value = typeof input.value === "string" ? input.value : input.value === undefined || input.value === null ? "" : String(input.value);
      if (value.length > APP_COMMAND_LIMITS.stringValue) return { ok: false, error: "Değer çok uzun." };
      out.focused = { option: def, value };
      options.push({ name: def.name, type: def.type, value, focused: true });
      continue;
    }
    // Boş metin "verilmedi" sayılır (istemci boş alanı göndermeyebilir de).
    if (input.value === undefined || input.value === null || input.value === "") continue;
    const coerced = coerceOptionValue(def, input.value, locale);
    if (!coerced.ok) {
      if (mode === "autocomplete") continue;
      return coerced;
    }
    options.push({ name: def.name, type: def.type, value: coerced.value });
    if (coerced.ref) out.references.push({ kind: coerced.ref, id: String(coerced.value), option: def });
  }
  if (mode === "execute") {
    for (const def of defs) {
      if (def.required && !options.some((o) => o.name === def.name)) return { ok: false, error: `"${label(def, locale)}" seçeneği zorunlu.` };
    }
    options.sort((a, b) => defs.findIndex((d) => d.name === a.name) - defs.findIndex((d) => d.name === b.name));
  } else if (!out.focused) {
    return { ok: false, error: "Odaklanan seçenek yok." };
  }
  return { ok: true, options };
}

/**
 * Kullanıcının girdiği seçenekleri komut tanımına karşı doğrular ve bota
 * gidecek `data.options`'ı kurar (alt komutlar iç içe) — sunucuyla aynı kural.
 */
export function resolveInvocation(
  command: { options: CommandOption[] },
  inputs: unknown,
  mode: "execute" | "autocomplete" = "execute",
  locale?: string | null,
): { ok: true; value: ResolvedInvocation } | { ok: false; error: string } {
  const list = Array.isArray(inputs) ? (inputs as InvocationOptionInput[]) : inputs === undefined || inputs === null ? [] : null;
  if (!list) return { ok: false, error: "Seçenekler dizi olmalı." };
  if (list.length > APP_COMMAND_LIMITS.options) return { ok: false, error: "Çok fazla seçenek." };
  const out: ResolvedInvocation = { options: [], references: [], path: [] };
  const defs = command.options ?? [];

  if (!hasSubcommands(defs)) {
    const leaf = resolveLeaf(defs, list, mode, out, locale);
    if (!leaf.ok) return leaf;
    out.options = leaf.options;
    return { ok: true, value: out };
  }

  if (list.length !== 1 || !list[0] || typeof list[0].name !== "string") return { ok: false, error: "Bir alt komut seçmelisin." };
  const first = defs.find((d) => d.name === list[0].name && isSubcommandOption(d));
  if (!first) return { ok: false, error: `Bilinmeyen alt komut: "${list[0].name}".` };
  if (first.type === ApplicationCommandOptionType.SUB_COMMAND_GROUP) {
    const inner = Array.isArray(list[0].options) ? list[0].options : [];
    if (inner.length !== 1 || !inner[0] || typeof inner[0].name !== "string") return { ok: false, error: "Bir alt komut seçmelisin." };
    const sub = (first.options ?? []).find((d) => d.name === inner[0].name && d.type === ApplicationCommandOptionType.SUB_COMMAND);
    if (!sub) return { ok: false, error: `Bilinmeyen alt komut: "${inner[0].name}".` };
    const leaf = resolveLeaf(sub.options ?? [], Array.isArray(inner[0].options) ? inner[0].options : [], mode, out, locale);
    if (!leaf.ok) return leaf;
    out.path = [first.name, sub.name];
    out.options = [{ name: first.name, type: first.type, options: [{ name: sub.name, type: sub.type, options: leaf.options }] }];
    return { ok: true, value: out };
  }
  const leaf = resolveLeaf(first.options ?? [], Array.isArray(list[0].options) ? list[0].options : [], mode, out, locale);
  if (!leaf.ok) return leaf;
  out.path = [first.name];
  out.options = [{ name: first.name, type: first.type, options: leaf.options }];
  return { ok: true, value: out };
}

/** Bir alt komut yolunun seçenek tanımları. */
export function leafOptions(command: { options: CommandOption[] }, path: string[]): CommandOption[] | null {
  let options = command.options ?? [];
  for (const segment of path) {
    const next = options.find((o) => o.name === segment && isSubcommandOption(o));
    if (!next) return null;
    options = next.options ?? [];
  }
  return hasSubcommands(options) ? null : options;
}

/** Yaprak seçenek girdilerini alt komut yoluna göre iç içe sarar (Discord biçimi). */
export function wrapLeafInputs(
  command: { options: CommandOption[] },
  path: string[],
  leaf: InvocationOptionInput[],
): InvocationOptionInput[] {
  const chain: CommandOption[] = [];
  let options = command.options ?? [];
  for (const segment of path) {
    const next = options.find((o) => o.name === segment && isSubcommandOption(o));
    if (!next) break;
    chain.push(next);
    options = next.options ?? [];
  }
  if (chain.length === 0) return leaf;
  let nested: InvocationOptionInput = { name: chain[chain.length - 1].name, type: chain[chain.length - 1].type, options: leaf };
  for (let i = chain.length - 2; i >= 0; i--) nested = { name: chain[i].name, type: chain[i].type, options: [nested] };
  return [nested];
}

/** Komutun "/" listesindeki düzleştirilmiş girişleri: alt komutsuz `[[]]`, yoksa her alt komut yolu. */
export function commandPaths(command: { options: CommandOption[] }): string[][] {
  const defs = command.options ?? [];
  if (!hasSubcommands(defs)) return [[]];
  const out: string[][] = [];
  for (const o of defs) {
    if (o.type === ApplicationCommandOptionType.SUB_COMMAND) out.push([o.name]);
    else if (o.type === ApplicationCommandOptionType.SUB_COMMAND_GROUP) {
      for (const sub of o.options ?? []) {
        if (sub.type === ApplicationCommandOptionType.SUB_COMMAND) out.push([o.name, sub.name]);
      }
    }
  }
  return out;
}

/** Bir yolun seçenek nesneleri (ad + açıklamanın yerelleştirilmesi için). */
export function pathOptions(command: { options: CommandOption[] }, path: string[]): CommandOption[] {
  const chain: CommandOption[] = [];
  let options = command.options ?? [];
  for (const segment of path) {
    const next = options.find((o) => o.name === segment && isSubcommandOption(o));
    if (!next) break;
    chain.push(next);
    options = next.options ?? [];
  }
  return chain;
}

// ── Kanal türü eşlemesi ────────────────────────────────────────────────

/** Ciklet kanalının Discord kanal türü numarası (web `cikletChannelType`). */
export function cikletChannelType(channel: {
  type: string;
  announcement?: boolean | null;
  stage?: boolean | null;
  forum?: boolean | null;
  parentChannelId?: string | null;
}): number {
  if (channel.parentChannelId) return ChannelType.PUBLIC_THREAD;
  if (channel.type === "TEXT") {
    if (channel.forum) return ChannelType.GUILD_FORUM;
    if (channel.announcement) return ChannelType.GUILD_ANNOUNCEMENT;
    return ChannelType.GUILD_TEXT;
  }
  return channel.stage ? ChannelType.GUILD_STAGE_VOICE : ChannelType.GUILD_VOICE;
}

export interface AutocompleteChoice {
  name: string;
  name_localizations?: Localizations | null;
  value: string | number;
}
