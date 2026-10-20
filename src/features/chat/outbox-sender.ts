import { AppState } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";
import { Directory, File, Paths } from "expo-file-system";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { onLocalDataCleared } from "@/api/query-client";
import { qk } from "@/api/query-keys";
import { adoptMedia } from "@/lib/media-cache";
import { isOnline, onNetworkChange } from "@/lib/network";
import { uploadMessageAttachment, type PickedAsset } from "@/lib/uploads";
import type { ChatMessagePayload } from "@/realtime/events";
import { onGatewayOpen } from "@/realtime/gateway";
import { useAuth } from "@/stores/auth";
import { allOutbox, useOutbox, type OutboxMessage, type OutboxPayload, type OutboxUpload } from "@/stores/outbox";
import { MAX_SERVER_ATTEMPTS, backoffMs, nextSendable, nextWakeAt } from "@/stores/outbox-logic";
import { mergeNewestPage } from "./message-sync";
import type { MessageCache } from "./reaction-cache";

/**
 * Gönderim motoru — kalıcı kuyruğu (stores/outbox) sırayla boşaltır.
 *
 * Ekrandan bağımsız, kök düzende bir kez başlar: sohbetten çıkılsa da,
 * uygulama kapanıp açılsa da bekleyen mesajlar gider (WhatsApp'ın saat
 * simgesi). Tetikleyiciler: yeni kayıt, ağ geri geldi (NetInfo), ağ
 * geçidi yeniden bağlandı, uygulama ön plana döndü, bekleme süresi doldu.
 *
 * Çift gönderim: her kayıt kuyruk kimliğini `clientNonce` olarak gönderir;
 * sunucu aynı nonce'la gelen tekrarı yeni mesaj yazmadan ilk yanıtla
 * karşılar (ciklet-web lib/message-nonce, 10 dk). Yedek olarak (nonce'u
 * bilmeyen eski sunucu) yanıtı gelmeden kopan kayıt "belirsiz" işaretlenir
 * ve yeniden göndermeden önce sohbetin en yeni sayfasında aynı içerikli
 * kendi mesajımız aranır.
 */

const OUTBOX_DIR = "outbox";
/** Belirsiz kaydı ararken saat kayması payı. */
const UNCERTAIN_SKEW_MS = 2 * 60 * 1000;

// ── Gövde ───────────────────────────────────────────────────────────

export interface SendAttachment {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface SendExtras {
  metadata?: Record<string, unknown>;
  messageType?: string;
  label?: string;
}

function attachmentInfo(file: { name: string; mimeType?: string | null; size?: number | null }) {
  return {
    name: file.name,
    ...(file.mimeType ? { type: file.mimeType } : {}),
    ...(typeof file.size === "number" ? { size: file.size } : {}),
  };
}

/**
 * Web'le aynı gövde (chat-input-area): içerik boşsa dosyanın adresi gider;
 * ilk dosya `fileUrl`, birden çoksa tam liste `metadata.attachments`.
 */
export function buildMessageBody(
  text: string,
  files: SendAttachment[],
  replyToId: string | undefined,
  extras: SendExtras | undefined
): { content: string; payload: OutboxPayload; label?: string } {
  const first = files[0];
  const content = text || first?.url || "";
  const metadata: Record<string, unknown> = {
    // UploadThing adresi ne ad ne tür taşıyor; önizleme (görsel, video,
    // dosya kartı) web'de de mobilde de bu bilgiye bakıyor.
    ...(first ? { attachment: attachmentInfo(first) } : {}),
    ...(files.length > 1 ? { attachments: files.map((file) => ({ url: file.url, ...attachmentInfo(file) })) } : {}),
    ...extras?.metadata,
  };
  const payload: OutboxPayload = {
    ...(first ? { fileUrl: first.url } : {}),
    ...(replyToId ? { replyToId } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(extras?.messageType ? { messageType: extras.messageType } : {}),
  };
  const label =
    extras?.label ??
    (text ? undefined : files.length > 1 ? `📎 ${files.length} dosya` : first ? `📎 ${first.name || "Dosya"}` : undefined);
  return { content, payload, label };
}

/**
 * Yüklenecek dosya kuyruk klasörüne kopyalanır: seçici/kaydedici önbelleği
 * sistem tarafından silinebilir, uygulama kapanıp açılınca dosya dursun.
 */
export async function stageOutboxFile(asset: PickedAsset): Promise<OutboxUpload> {
  const directory = new Directory(Paths.document, OUTBOX_DIR);
  directory.create({ intermediates: true, idempotent: true });
  const extension = /\.([a-z0-9]{1,5})$/i.exec(asset.name)?.[1] ?? "bin";
  const target = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
  await new File(asset.uri).copy(target);
  return { uri: target.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size ?? target.size ?? null };
}

function deleteStaged(uri: string | undefined) {
  if (!uri || !uri.includes(`/${OUTBOX_DIR}/`)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* sistem temizler */
  }
}

// ── Motor ───────────────────────────────────────────────────────────

let client: QueryClient | null = null;
let pumping = false;
let again = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
/** Ağ hatası art arda sayısı — bekleme süresini büyütür, deneme sayılmaz. */
const networkFailures = new Map<string, number>();

function authorOf(message: ChatMessagePayload): string | undefined {
  return "member" in message ? message.member?.profileId : message.profileId;
}

function writeCreated(chatId: string, message: ChatMessagePayload) {
  client?.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => {
    if (!old?.pages?.length) return old;
    if (old.pages.some((page) => page.items.some((item) => item.id === message.id))) return old;
    const [newest, ...rest] = old.pages;
    return { ...old, pages: [{ ...newest, items: [message, ...newest.items] }, ...rest] };
  });
}

function finish(entry: OutboxMessage, url?: string) {
  networkFailures.delete(entry.id);
  if (entry.upload && url) {
    const voice = Boolean((entry.payload.metadata as { voice?: unknown } | undefined)?.voice);
    void adoptMedia(url, voice ? "voice" : "file", entry.upload.uri).finally(() => deleteStaged(entry.upload?.uri));
  }
  useOutbox.getState().remove(entry.id);
  if (entry.kind === "direct") void client?.invalidateQueries({ queryKey: qk.directs });
}

function retryLater(entry: OutboxMessage, patch: Partial<OutboxMessage>, failures: number) {
  useOutbox.getState().update(entry.id, {
    status: "queued",
    nextAttemptAt: Date.now() + backoffMs(failures, Math.random()),
    ...patch,
  });
}

/** Belirsiz kayıt: sunucuda zaten varsa yeniden gönderilmez. */
async function alreadyDelivered(entry: OutboxMessage): Promise<boolean> {
  const myId = useAuth.getState().profile?.id;
  if (!myId) return false;
  const page = await api<MessagesPage<ChatMessagePayload>>(
    entry.kind === "channel" ? endpoints.channelMessages(entry.chatId) : endpoints.directMessages(entry.chatId)
  );
  const since = Date.parse(entry.createdAt) - UNCERTAIN_SKEW_MS;
  const match = page.items.find(
    (item) => authorOf(item) === myId && item.content === entry.content && Date.parse(item.createdAt) >= since
  );
  if (!match) return false;
  if (client) mergeNewestPage(client, entry.chatId, page);
  writeCreated(entry.chatId, match);
  return true;
}

async function deliver(entry: OutboxMessage): Promise<void> {
  const store = useOutbox.getState();
  store.update(entry.id, { status: "sending", error: undefined });
  let current = entry;

  // 1) Yerel dosya varsa önce yüklenir; adres kayda yazılır (tekrar denemede yeniden yüklenmez).
  if (current.upload && !current.payload.fileUrl) {
    try {
      const uploaded = await uploadMessageAttachment(
        {
          uri: current.upload.uri,
          name: current.upload.name,
          mimeType: current.upload.mimeType,
          size: current.upload.size,
        },
        (progress) => store.setProgress(entry.id, Math.round(progress))
      );
      const metadata = {
        ...current.payload.metadata,
        attachment: attachmentInfo({ name: uploaded.name, mimeType: uploaded.mimeType, size: uploaded.size }),
      };
      const patch: Partial<OutboxMessage> = {
        content: current.content || uploaded.url,
        payload: { ...current.payload, fileUrl: uploaded.url, metadata },
      };
      store.update(entry.id, patch);
      current = { ...current, ...patch };
    } catch (err) {
      store.setProgress(entry.id, null);
      const message = err instanceof Error ? err.message : "Dosya yüklenemedi.";
      if (/büyük/i.test(message)) {
        store.update(entry.id, { status: "failed", error: message });
        return;
      }
      const failures = (networkFailures.get(entry.id) ?? 0) + 1;
      networkFailures.set(entry.id, failures);
      retryLater(entry, {}, failures);
      return;
    }
    store.setProgress(entry.id, null);
  }

  // 2) Yanıtı kopmuş önceki deneme sunucuya ulaşmış mı?
  if (current.uncertain) {
    try {
      if (await alreadyDelivered(current)) {
        finish(current, current.payload.fileUrl);
        return;
      }
    } catch {
      const failures = (networkFailures.get(entry.id) ?? 0) + 1;
      networkFailures.set(entry.id, failures);
      retryLater(current, {}, failures);
      return;
    }
  }

  // 3) Gönderim.
  try {
    const created = await api<Partial<ChatMessagePayload> | undefined>(
      current.kind === "channel"
        ? endpoints.sendChannelMessage(current.chatId, current.serverId ?? "")
        : endpoints.sendDirectMessage(current.chatId),
      // `clientNonce`: sunucu aynı nonce'la gelen tekrarı yeni mesaj yazmadan
      // ilk yanıtla karşılar (ciklet-web lib/message-nonce).
      { method: "POST", body: { content: current.content, ...current.payload, clientNonce: current.id } }
    );
    // Yanıt sunum katmanından geçmiş tam mesaj; kimliği varsa listeye hemen
    // yazılır, yoksa canlı yayın satırı düşürür.
    if (created && typeof created.id === "string" && typeof created.createdAt === "string") {
      writeCreated(current.chatId, created as ChatMessagePayload);
    }
    finish(current, current.payload.fileUrl);
  } catch (err) {
    if (!(err instanceof ApiError) || err.isNetwork) {
      // İstek gitmiş olabilir: bir dahaki denemede önce sunucuya bakılır.
      const failures = (networkFailures.get(entry.id) ?? 0) + 1;
      networkFailures.set(entry.id, failures);
      retryLater(current, { uncertain: true }, failures);
      return;
    }
    if (err.status === 429 || err.status >= 500) {
      const attempts = (current.attempts ?? 0) + 1;
      if (attempts >= MAX_SERVER_ATTEMPTS) {
        store.update(entry.id, { status: "failed", attempts, error: err.message || "Gönderilemedi" });
      } else {
        retryLater(current, { attempts }, attempts);
      }
      return;
    }
    // 4xx: yeniden denemenin anlamı yok (izin, doğrulama…).
    store.update(entry.id, { status: "failed", uncertain: false, error: err.message || "Gönderilemedi" });
  }
}

function scheduleWake() {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
  const wake = nextWakeAt(allOutbox(), Date.now());
  if (wake === null) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    kickOutbox();
  }, Math.max(250, wake - Date.now()));
}

/** Kuyruğu şimdi işlemeyi dene (yeni kayıt, bağlantı geldi…). */
export function kickOutbox() {
  if (!client) return;
  if (pumping) {
    again = true;
    return;
  }
  pumping = true;
  void (async () => {
    try {
      while (isOnline() && useAuth.getState().status === "signedIn") {
        const entry = nextSendable(allOutbox(), Date.now());
        if (!entry) break;
        await deliver(entry);
      }
    } finally {
      pumping = false;
      scheduleWake();
      if (again) {
        again = false;
        kickOutbox();
      }
    }
  })();
}

/** Kullanıcı "Tekrar dene"ye bastı. */
export function retryOutbox(id: string) {
  networkFailures.delete(id);
  useOutbox.getState().requeue(id);
  kickOutbox();
}

/** Kullanıcı bekleyen mesajı sildi. */
export function discardOutbox(id: string) {
  const entry = allOutbox().find((m) => m.id === id);
  useOutbox.getState().remove(id);
  deleteStaged(entry?.upload?.uri);
}

/** Kök düzende bir kez. */
export function startOutboxSender(queryClient: QueryClient): () => void {
  client = queryClient;
  const releaseNet = onNetworkChange((online) => {
    if (!online) return;
    // Bağlantı geldi: ağ beklemeleri sıfırlanır, sıra hemen işlenir.
    networkFailures.clear();
    for (const entry of allOutbox()) {
      if (entry.status === "queued" && (entry.nextAttemptAt ?? 0) > Date.now() && entry.attempts === 0) {
        useOutbox.getState().update(entry.id, { nextAttemptAt: 0 });
      }
    }
    kickOutbox();
  });
  const releaseGateway = onGatewayOpen(() => kickOutbox());
  const appState = AppState.addEventListener("change", (next) => {
    if (next === "active") kickOutbox();
  });
  const releaseAuth = useAuth.subscribe((state, prev) => {
    if (state.status === "signedIn" && prev.status !== "signedIn") kickOutbox();
  });
  const releaseClear = onLocalDataCleared(() => {
    for (const entry of allOutbox()) deleteStaged(entry.upload?.uri);
    networkFailures.clear();
    useOutbox.getState().reset();
  });
  kickOutbox();
  return () => {
    releaseNet();
    releaseGateway();
    appState.remove();
    releaseAuth();
    releaseClear();
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    client = null;
  };
}
