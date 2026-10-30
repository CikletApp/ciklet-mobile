import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { currentTranslator } from "@/lib/i18n";
import {
  ApplicationCommandType,
  type ApplicationCommandJson,
  type AutocompleteChoice,
  type InvocationOptionInput,
} from "./app-commands";
import { openInteractionModal } from "./interaction-modal-store";

/**
 * Uygulama komutları ve bot etkileşimleri — ciklet-web
 * `lib/slash-commands-client` karşılığı.
 *
 * Liste `GET /api/channels/{chatId}/application-commands` ucundan gelir
 * (sunucu kanalı ya da botla birebir DM); sohbet başına 60 sn önbellek.
 * Komutlar Discord biçiminde (bkz. app-commands.ts): eğik çizgi (type 1),
 * kullanıcı (type 2) ve mesaj (type 3) bağlam menüsü komutları.
 *
 * Çağrılar `POST /api/channels/{id}/interactions`'a gider. Bot
 * `interaction.create` olayını alır ve 3 sn içinde yanıtlamalıdır; süre
 * dolunca durum hâlâ bekliyorsa kullanıcıya "yanıt vermedi" denir. HTTP uç
 * noktalı bot modalla yanıtladıysa yanıt `modal` taşır; form hemen açılır.
 */

export interface SlashBot {
  /** Botun profil kimliği. */
  id: string;
  applicationId: string;
  name: string;
  username: string;
  imageUrl: string | null;
  commands: ApplicationCommandJson[];
}

export interface SlashCommandEntry {
  bot: SlashBot;
  command: ApplicationCommandJson;
}

/** Dosya seçeneği: önce yüklenir, sonra kimlikle (`value`) bağlanır. */
export interface CommandAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  content_type?: string;
}

interface InteractionCreated {
  id: string;
  status?: string;
  modal?: unknown;
}

function openModalFrom(channelId: string, res: InteractionCreated) {
  if (res.modal) openInteractionModal({ interactionId: res.id, channelId, modal: res.modal });
}

/** Web `INTERACTION_ACK_MS`. */
export const INTERACTION_ACK_MS = 3000;

export type RunResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Sohbetteki uygulama komutları. İnsanla DM'de `[]`; görünmeyen kanal
 * (404) ve yetkisizlik de boş liste sayılır — hata gösterilmez.
 */
export function useAppCommands(chatId: string | undefined) {
  return useQuery({
    queryKey: ["app-commands", chatId],
    enabled: Boolean(chatId),
    queryFn: async (): Promise<SlashBot[]> => {
      try {
        const data = await api<{ bots?: SlashBot[] }>(endpoints.applicationCommands(chatId ?? ""));
        return (data.bots ?? []).filter((bot) => Array.isArray(bot.commands) && bot.commands.length > 0);
      } catch (reason) {
        if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) return [];
        throw reason;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Eğik çizgi komutları (type 1). */
export function flattenSlashCommands(bots: SlashBot[]): SlashCommandEntry[] {
  return bots.flatMap((bot) =>
    bot.commands.filter((c) => c.type === ApplicationCommandType.CHAT_INPUT).map((command) => ({ bot, command }))
  );
}

/** "Uygulamalar" bölümü: kullanıcı (2) ya da mesaj (3) komutları. */
export function contextMenuCommands(bots: SlashBot[], type: 2 | 3): SlashCommandEntry[] {
  return bots.flatMap((bot) => bot.commands.filter((c) => c.type === type).map((command) => ({ bot, command })));
}

/**
 * `/komut a "iki kelime"` → ad + argümanlar (web `parseCommandArgs`):
 * tırnaklar birden çok kelimeyi tek argüman yapar.
 */
export function parseCommandArgs(text: string): { name: string; args: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const ch of trimmed.slice(1)) {
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      has = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        tokens.push(current);
        current = "";
        has = false;
      }
      continue;
    }
    current += ch;
    has = true;
  }
  if (has) tokens.push(current);
  if (tokens.length === 0) return null;
  const [name, ...args] = tokens;
  if (!/^[-_\p{L}\p{N}]+$/u.test(name)) return null;
  return { name: name.toLowerCase(), args };
}

/**
 * Yazılmış metin (`/komut alt arg…`) kayıtlı bir eğik çizgi komutuna uyuyor
 * mu? Seçenek alanları kullanılmadan yazılan komutlar için yedek yol:
 * argümanlar sunucuda komutun şemasına oturtulur. Aynı adı birden çok bot
 * taşıyorsa ilki.
 */
export function matchSlashCommand(text: string, bots: SlashBot[]): { entry: SlashCommandEntry; args: string[] } | null {
  const parsed = parseCommandArgs(text);
  if (!parsed) return null;
  for (const entry of flattenSlashCommands(bots)) {
    if (entry.command.name === parsed.name) return { entry, args: parsed.args };
  }
  return null;
}

function errorText(reason: unknown, fallback: string): string {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}

async function postInteraction(chatId: string, body: Record<string, unknown>, fallback: string): Promise<RunResult> {
  try {
    const res = await api<InteractionCreated>(endpoints.channelInteractions(chatId), { method: "POST", body });
    openModalFrom(chatId, res);
    return { ok: true, id: res.id };
  } catch (reason) {
    return { ok: false, error: errorText(reason, fallback) };
  }
}

/**
 * Eğik çizgi komutu. `options` (seçenek alanlarından, Discord biçimi, alt
 * komutlar iç içe) ya da `args` (yazılmış metin yedeği) verilir.
 */
export function runSlashCommand(
  chatId: string,
  entry: SlashCommandEntry,
  input: { options?: InvocationOptionInput[]; args?: string[]; attachments?: CommandAttachment[] }
): Promise<RunResult> {
  return postInteraction(
    chatId,
    {
      botId: entry.bot.id,
      commandId: entry.command.id,
      name: entry.command.name,
      commandType: ApplicationCommandType.CHAT_INPUT,
      ...(input.options ? { options: input.options } : { args: input.args ?? [] }),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    },
    currentTranslator()("appCommands.runFailed")
  );
}

/** Kullanıcı/mesaj bağlam menüsü komutu: hedef kullanıcı profili ya da mesaj kimliği. */
export function runContextMenuCommand(chatId: string, entry: SlashCommandEntry, targetId: string): Promise<RunResult> {
  return postInteraction(
    chatId,
    { botId: entry.bot.id, commandId: entry.command.id, commandType: entry.command.type, targetId },
    currentTranslator()("appCommands.runFailed")
  );
}

/**
 * Otomatik tamamlama (etkileşim type 4): odaklanan seçenek `focused: true`
 * ve yazılan metinle. Bot 3 sn içinde yanıtlamazsa `timedOut`. 429 (çok
 * hızlı) sessizce yutulur. Çağıran gecikmeli (debounce) sormalı; `signal`
 * iptal edilince yanıt yok sayılır (`api` dış sinyal taşımıyor — istek
 * kendi zaman aşımıyla biter, sonucu kullanılmaz).
 */
export async function requestAutocomplete(
  chatId: string,
  entry: SlashCommandEntry,
  options: InvocationOptionInput[],
  signal?: AbortSignal
): Promise<{ choices: AutocompleteChoice[]; timedOut?: boolean; error?: string; aborted?: boolean }> {
  try {
    const res = await api<{ choices?: AutocompleteChoice[]; timedOut?: boolean }>(endpoints.channelInteractions(chatId), {
      method: "POST",
      body: { type: 4, botId: entry.bot.id, commandId: entry.command.id, commandType: ApplicationCommandType.CHAT_INPUT, options },
    });
    if (signal?.aborted) return { choices: [], aborted: true };
    return { choices: Array.isArray(res.choices) ? res.choices : [], ...(res.timedOut ? { timedOut: true } : {}) };
  } catch (reason) {
    if (signal?.aborted) return { choices: [], aborted: true };
    if (reason instanceof ApiError && reason.status === 429) return { choices: [] };
    return { choices: [], error: errorText(reason, "Öneriler alınamadı.") };
  }
}

/** Buton / seçim menüsü: type 3 etkileşim. */
export async function runComponentInteraction(
  channelId: string,
  messageId: string,
  customId: string,
  values?: string[]
): Promise<RunResult> {
  return postInteraction(channelId, { messageId, customId, ...(values ? { values } : {}) }, "Etkileşim başlatılamadı.");
}

/** 3 sn sonra durum: bot hâlâ yanıtlamadıysa true (uyarı için). */
export async function waitForAck(channelId: string, interactionId: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, INTERACTION_ACK_MS));
  try {
    const res = await api<{ status?: string }>(endpoints.channelInteraction(channelId, interactionId));
    return res.status === "PENDING" || res.status === "EXPIRED";
  } catch {
    return false;
  }
}

/** Komut gönderildi: 3 sn içinde yanıt yoksa mevcut uyarı metni (değişmedi). */
export function silentNotice(botName: string): string {
  return `${botName} komuta yanıt vermedi.`;
}
