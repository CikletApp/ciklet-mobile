/**
 * Sunucu denetim kaydı — eylem adları, okunur açıklamalar ve sebep.
 *
 * ciklet-web `src/lib/server/audit-actions.ts` modülünün BİREBİR kopyası
 * (yalnızca saf etiket/açıklama yardımcıları). Web'de bir etiket değişirse
 * burada da değişmeli: web ve mobil Denetim Kaydı aynı metni gösterir.
 */

/** Kayıtların saklanma süresi (gün) — bakım süpürmesi bundan eskiyi siler. */
export const SERVER_AUDIT_RETENTION_DAYS = 90;

/** Eylem → "<kişi> …" cümlesinin yüklemi. Bilinmeyen eylem adıyla gösterilir. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  server_update: "sunucu ayarlarını güncelledi",
  welcome_screen_update: "karşılama ekranını güncelledi",
  onboarding_update: "katılım sorularını güncelledi",
  guide_update: "sunucu rehberini güncelledi",
  emoji_create: "bir emoji ekledi",
  emoji_delete: "bir emoji sildi",
  sticker_create: "bir çıkartma ekledi",
  sticker_delete: "bir çıkartma sildi",
  sound_create: "bir ses ekledi",
  sound_delete: "bir ses sildi",
  role_create: "bir rol oluşturdu",
  role_update: "bir rolü güncelledi",
  role_delete: "bir rol sildi",
  member_kick: "bir üyeyi attı",
  member_ban: "bir üyeyi yasakladı",
  member_bulk_ban: "üyeleri toplu yasakladı",
  member_prune: "etkin olmayan üyeleri temizledi",
  member_timeout: "bir üyeye zaman aşımı verdi",
  member_timeout_clear: "bir üyenin zaman aşımını kaldırdı",
  member_nickname_change: "bir üyenin sunucu takma adını değiştirdi",
  member_unban: "bir yasağı kaldırdı",
  member_role_change: "bir üyenin rolünü değiştirdi",
  invite_create: "bir davet oluşturdu",
  invite_pause: "bir daveti duraklattı",
  invite_resume: "bir daveti yeniden açtı",
  channel_delete: "bir kanalı sildi",
  channel_follow: "bir duyuru kanalını takip etti",
  category_create: "bir kategori oluşturdu",
  category_update: "bir kategoriyi yeniden adlandırdı",
  category_delete: "bir kategori sildi",
  channel_move: "bir kanalı başka kategoriye taşıdı",
  channel_voice_update: "bir ses kanalının ayarlarını güncelledi",
  channel_permissions_update: "bir kanalın izinlerini güncelledi",
  channel_permissions_sync: "bir kanalı kategorisiyle eşitledi",
  category_permissions_update: "bir kategorinin izinlerini güncelledi",
  message_pin: "bir mesajı sabitledi",
  message_unpin: "bir mesajın sabitini kaldırdı",
  message_bulk_delete: "mesajları toplu sildi",
  thread_lock: "bir alt başlığı kilitledi",
  thread_unlock: "bir alt başlığın kilidini açtı",
  forum_post_pin: "bir forum gönderisini sabitledi",
  forum_post_unpin: "bir forum gönderisinin sabitini kaldırdı",
  poll_end: "bir anketi erken bitirdi",
  event_create: "bir etkinlik oluşturdu",
  event_update: "bir etkinliği güncelledi",
  event_delete: "bir etkinliği sildi",
  template_create: "bir şablon oluşturdu",
  template_delete: "bir şablonu sildi",
  webhook_create: "bir webhook oluşturdu",
  webhook_delete: "bir webhook sildi",
  webhook_rotate: "bir webhook anahtarını yeniledi",
  voice_mute: "bir üyeyi seste susturdu",
  voice_unmute: "bir üyenin ses susturmasını kaldırdı",
  voice_deafen: "bir üyeyi seste sağırlaştırdı",
  voice_undeafen: "bir üyenin sağırlaştırmasını kaldırdı",
  voice_disconnect: "bir üyenin ses bağlantısını kesti",
  voice_move: "bir üyeyi başka ses kanalına taşıdı",
  integration_remove: "bir entegrasyonu kaldırdı",
  automod_block: "AutoMod'a takılan bir mesaj gönderdi",
};

/** Filtre listesinde gösterilen eylemler (etiket sırasıyla). */
export const AUDIT_FILTER_ACTIONS: string[] = Object.keys(AUDIT_ACTION_LABELS);

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** Kaydın açıklaması: yüklem + varsa hedefin adı / sayı ("(@ali)", "(12 mesaj, #genel)"). */
export function describeAuditEntry(entry: { action: string; details?: unknown }): string {
  const base = auditActionLabel(entry.action);
  const d = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : {};
  const count = typeof d.count === "number" ? d.count : null;
  if (entry.action === "message_bulk_delete" && count !== null) {
    return typeof d.channelName === "string" ? `${base} (${count} mesaj, #${d.channelName})` : `${base} (${count} mesaj)`;
  }
  if ((entry.action === "member_bulk_ban" || entry.action === "member_prune") && count !== null) {
    return typeof d.days === "number" ? `${base} (${count} üye, ${d.days} gün)` : `${base} (${count} üye)`;
  }
  if (typeof d.username === "string" && d.username) return `${base} (${d.username})`;
  if (typeof d.name === "string" && d.name) return `${base} (${d.name})`;
  return base;
}

/**
 * Kaydın sebebi: yeni kayıtlarda `reason` sütunu; sütun eklenmeden önce
 * yazılan yasak / zaman aşımı kayıtlarında sebep `details.reason` içindeydi.
 */
export function auditEntryReason(entry: { reason?: string | null; details?: unknown }): string | null {
  if (entry.reason) return entry.reason;
  const d = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;
  return d && typeof d.reason === "string" && d.reason.trim() ? d.reason : null;
}
