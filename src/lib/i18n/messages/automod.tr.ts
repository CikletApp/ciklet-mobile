/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.tr.ts` (timeout, settings) ve
 * `streaming.tr.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
export const automodTr = {
  timeout: {
    none: "Zaman aşımı yok",
    s60: "60 saniye",
    m5: "5 dakika",
    m10: "10 dakika",
    h1: "1 saat",
    d1: "1 gün",
    w1: "1 hafta",
  },
  settings: {
    words: {
      title: "AutoMod — Yasaklı Kelimeler",
      description: "Virgül ya da satırla ayır; tam kelime eşleşir, sonuna * koyarsan ön ek olarak eşleşir. Yazım oyunları da yakalanır (harf tekrarı, rakam/simge, ayraç). Eşleşen mesaj gönderilemez (ağ geçidinden gelirse silinir). En fazla {max} kelime.",
      placeholder: "kelime1, kelime2, önek*",
      count: "{count} kelime",
    },
    mentions: {
      title: "AutoMod — Bahsetme Seli",
      description: "Tek mesajda bundan fazla farklı kişi ya da rol etiketlenirse mesaj engellenir. Boş bırakırsan kapalı (en fazla {max}).",
      off: "Kapalı",
    },
    linkFilter: {
      title: "AutoMod — Bağlantı Filtresi",
      description: "Açıkken yalnızca aşağıdaki alanlara (ve alt alanlarına) bağlantı paylaşılabilir; dosya ekleri her zaman serbest. En fazla {max} alan.",
      emptyWarning: "İzinli alan yok: tüm bağlantılar engellenir.",
    },
    actionsSection: {
      title: "AutoMod — Eylemler",
      description: "Bir kurala takılan mesaj her zaman engellenir. İstersen yazara zaman aşımı verilir, olay seçtiğin moderasyon kanalına ve mesajın kanalına düşer.",
      timeout: "Zaman aşımı",
      alertChannel: "Moderasyon kanalı",
      noAlert: "Bildirim yok",
    },
    preset: {
      title: "AutoMod — Türkçe Küfür Filtresi",
      description: "Hazır, kapsamlı Türkçe küfür ve hakaret sözlüğü. Yazım oyunlarını da yakalar (harf tekrarı, 4→a, 1→ı, 0→o, $→s, nokta ya da boşlukla ayırma); \"sıkıntı\", \"amaç\", \"piknik\" gibi masum kelimelere dokunmaz.",
      enable: "Tek tıkla aç",
      enabled: "Açık",
      allowTitle: "İzin verilen kelimeler",
      allowDescription: "Filtreye takılmasını istemediğin kelimeler (virgül ya da satırla ayır; sonuna * koyarsan ön ek). Hem hazır filtre hem yasaklı kelime listesi için geçerli.",
      allowPlaceholder: "amina, kelime*",
    },
    spam: {
      title: "AutoMod — Spam Sezgisi",
      description: "Kısa sürede çok mesaj atan ya da aynı içeriği tekrar tekrar gönderen üyenin mesajı engellenir.",
      maxMessages: "En fazla mesaj",
      window: "Süre (saniye)",
      duplicates: "Aynı mesaj tekrarı (60 sn)",
    },
    caps: {
      title: "AutoMod — Büyük Harf Seli",
      description: "Harflerinin belirtilen orandan fazlası büyük olan mesajlar engellenir (kısa mesajlar hariç).",
      percent: "Büyük harf oranı (%)",
      minLetters: "En az harf",
    },
    links: {
      inviteTitle: "Davet bağlantılarını engelle",
      inviteDescription: "Ciklet ve Discord sunucu davetleri paylaşılamaz.",
      blockedTitle: "Engelli alanlar",
      blockedDescription: "Bağlantı filtresi kapalı olsa bile bu alanlara (ve alt alanlarına) bağlantı paylaşılamaz.",
    },
    profile: {
      title: "AutoMod — Kullanıcı Adı ve Profil Süzgeci",
      description: "Görünen ad, kullanıcı adı, sunucu takma adı ve biyografi yasaklı kelime listesinden ve (açıksa) küfür filtresinden geçmeli. Takılan üye adını düzeltene kadar mesaj gönderemez; takma ad ve sunucu biyografisi kaydedilmez.",
    },
    actions: {
      warnTitle: "Kanalda uyarı satırı",
      warnDescription: "Engellenen mesajın kanalına kısa bir AutoMod uyarısı düşer (mesaj içeriği gösterilmez).",
      blockMessageTitle: "Gönderene gösterilecek metin",
      blockMessageDescription: "Boş bırakırsan kuralın kendi açıklaması gösterilir.",
      blockMessagePlaceholder: "Bu mesaj sunucu kurallarına aykırı.",
    },
    exempt: {
      title: "AutoMod — Muafiyetler",
      description: "Mesajları Yönet yetkisi olanlar her zaman muaf. Buradaki roller ve kanallar (alt başlıkları dahil) da denetlenmez.",
      roles: "Muaf roller",
      channels: "Muaf kanallar",
      none: "Seçili değil",
    },
  },

} as const;

export const streamingTr = {
  live: "YAYINDA",
  settings: {
    hint: "Hesabını bağla; yayına girince profilinde \"Yayında\" görünsün",
    broadcaster: "Yayıncı izinleri",
    broadcasterHint: "Bağlantılı roller için abonelerini okuma izni",
    grantBroadcaster: "Yayıncı olarak bağla",
    connect: "Bağla",
    reconnect: "Yeniden bağla",
    disconnect: "Kaldır",
    disconnected: "{platform} bağlantısı kaldırıldı.",
    disconnectFailed: "{platform} bağlantısı kaldırılamadı.",
    liveNow: "Şu an yayında",
  },
  linkedRoles: {
    title: "Bağlantılı Roller",
    description: "Bir rolü Twitch ya da Kick kanalına abonelik koşuluna bağla. Üyeler hesabını bağlayınca uygunsa rol otomatik verilir, abonelik bitince geri alınır (yarım saatte bir yeniden doğrulanır). Yalnızca sunucu sahibi, kendi kanalı için tanımlayabilir.",
    ownerOnly: "Bağlantılı rolleri yalnızca sunucu sahibi yönetebilir.",
    role: "Rol",
    platform: "Platform",
    requirement: "Koşul",
    subscriber: "Kanalımın abonesi",
    follower: "Kanalımı takip ediyor",
    followerTwitchOnly: "Takip koşulu yalnızca Twitch'te (Kick takipten çıkmayı bildirmiyor).",
    add: "Bağla",
    remove: "Kaldır",
    empty: "Henüz bağlantılı rol yok.",
    loading: "Yükleniyor…",
    needsBroadcaster: "Önce Ayarlar → Profil → Bağlantılar'dan {platform} hesabını \"Yayıncı olarak bağla\" ile bağla.",
    created: "Bağlantılı rol oluşturuldu.",
    createFailed: "Bağlantılı rol oluşturulamadı.",
    removeFailed: "Bağlantılı rol kaldırılamadı.",
    granted: "{count} üyede",
    lastSynced: "Son doğrulama: {time}",
    selectRole: "Rol seç",
  },

} as const;
