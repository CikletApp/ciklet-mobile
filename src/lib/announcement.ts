/**
 * Duyuru kanalı — ciklet-web `lib/announcement-channel.ts` istemci kısmı.
 * Takip edilen duyuru kanalından gelen kopya `metadata.crosspost` taşır;
 * kaynak mesaj yayınlanınca `metadata.crossposted: true` olur.
 */
export interface CrosspostMeta {
  sourceServerId: string;
  sourceServerName: string;
  sourceChannelId: string;
  sourceChannelName: string;
  sourceMessageId: string;
}

export function readCrosspostMeta(metadata: unknown): CrosspostMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const c = (metadata as { crosspost?: unknown }).crosspost;
  if (!c || typeof c !== "object") return null;
  const v = c as Record<string, unknown>;
  if (typeof v.sourceServerName !== "string" || typeof v.sourceChannelName !== "string") return null;
  return {
    sourceServerId: String(v.sourceServerId ?? ""),
    sourceServerName: v.sourceServerName,
    sourceChannelId: String(v.sourceChannelId ?? ""),
    sourceChannelName: v.sourceChannelName,
    sourceMessageId: String(v.sourceMessageId ?? ""),
  };
}

/** "Yayınla": duyuru kanalında, yayınlanmamış ve kopya olmayan mesaj. */
export function canPublishMessage(message: { deleted?: boolean; metadata?: unknown }): boolean {
  if (message.deleted) return false;
  const meta = message.metadata as { crossposted?: unknown } | null | undefined;
  return meta?.crossposted !== true && !readCrosspostMeta(message.metadata);
}
