import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { CommandBot, BotCommand } from "./components/command-suggestions";
import { openInteractionModal } from "./interaction-modal-store";

/**
 * Bot etkileşimleri — ciklet-web `lib/slash-commands-client` karşılığı.
 *
 * Eğik çizgi komutu (type 2) ve mesaj bileşeni (buton / seçim menüsü,
 * type 3) aynı uca gider: `POST /api/channels/{id}/interactions`. Bot
 * `interaction.create` olayını alır ve 3 sn içinde yanıtlamalıdır; süre
 * dolunca durum hâlâ bekliyorsa kullanıcıya "yanıt vermedi" denir.
 * HTTP uç noktalı bot modalla yanıtladıysa yanıt `status: "MODAL"` +
 * `modal` taşır; form hemen açılır (bkz. interaction-modal).
 */

interface InteractionCreated {
  id: string;
  status?: string;
  modal?: unknown;
}

function openModalFrom(channelId: string, res: InteractionCreated) {
  if (res.status === "MODAL" && res.modal) {
    openInteractionModal({ interactionId: res.id, channelId, modal: res.modal });
  }
}

/** Web `INTERACTION_ACK_MS`. */
export const INTERACTION_ACK_MS = 3000;

export type RunResult = { ok: true; id: string } | { ok: false; error: string };

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
  if (!/^[a-z0-9_-]+$/i.test(name)) return null;
  return { name: name.toLowerCase(), args };
}

/** Metin kurulu bir komuta uyuyor mu? Aynı adı birden çok bot taşıyorsa ilki. */
export function matchSlashCommand(
  text: string,
  bots: CommandBot[]
): { bot: CommandBot; command: BotCommand; args: string[] } | null {
  const parsed = parseCommandArgs(text);
  if (!parsed) return null;
  for (const bot of bots) {
    const command = bot.commands.find((c) => c.name.toLowerCase() === parsed.name);
    if (command) return { bot, command, args: parsed.args };
  }
  return null;
}

function errorText(reason: unknown, fallback: string): string {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}

export async function runSlashCommand(
  channelId: string,
  match: { bot: CommandBot; command: BotCommand; args: string[] }
): Promise<RunResult> {
  try {
    const res = await api<InteractionCreated>(endpoints.channelInteractions(channelId), {
      method: "POST",
      body: { botId: match.bot.id, name: match.command.name, args: match.args },
    });
    openModalFrom(channelId, res);
    return { ok: true, id: res.id };
  } catch (reason) {
    return { ok: false, error: errorText(reason, "Komut çalıştırılamadı.") };
  }
}

/** Buton / seçim menüsü: type 3 etkileşim. */
export async function runComponentInteraction(
  channelId: string,
  messageId: string,
  customId: string,
  values?: string[]
): Promise<RunResult> {
  try {
    const res = await api<InteractionCreated>(endpoints.channelInteractions(channelId), {
      method: "POST",
      body: { messageId, customId, ...(values ? { values } : {}) },
    });
    openModalFrom(channelId, res);
    return { ok: true, id: res.id };
  } catch (reason) {
    return { ok: false, error: errorText(reason, "Etkileşim başlatılamadı.") };
  }
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
