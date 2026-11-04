/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Susdurma yoxdur",
    s60: "60 saniyə",
    m5: "5 dəqiqə",
    m10: "10 dəqiqə",
    h1: "1 saat",
    d1: "1 gün",
    w1: "1 həftə",
  },
  settings: {
    words: {
      title: "AutoMod — Qadağan Olunmuş Sözlər",
      description: "Vergül və ya yeni sətirlə ayır; tam söz uyğunlaşır, sonuna * qoysan, söz başlanğıcı kimi uyğunlaşır. Yazı hiylələri də tutulur (hərf təkrarı, rəqəm/simvol, ayırıcılar). Uyğun gələn mesaj göndərilə bilməz (şlüzdən gəlsə, silinir). Ən çox {max} söz.",
      placeholder: "söz1, söz2, başlanğıc*",
      count: "{count} söz",
    },
    mentions: {
      title: "AutoMod — Qeyd Etmə Seli",
      description: "Bir mesajda bundan çox fərqli şəxs və ya rol qeyd edilərsə, mesaj bloklanır. Boş qoysan, söndürülür (ən çox {max}).",
      off: "Deaktiv",
    },
    linkFilter: {
      title: "AutoMod — Keçid Filtri",
      description: "Aktiv olanda yalnız aşağıdakı domenlərə (və onların alt domenlərinə) keçid paylaşmaq olar; fayl əlavələrinə həmişə icazə var. Ən çox {max} domen.",
      emptyWarning: "İcazəli domen yoxdur: bütün keçidlər bloklanır.",
    },
    actionsSection: {
      title: "AutoMod — Əməliyyatlar",
      description: "Qaydanı pozan mesaj həmişə bloklanır. İstəsən, müəllifə susdurma verilir və hadisə seçdiyin moderasiya kanalına və mesajın kanalına düşür.",
      timeout: "Susdurma",
      alertChannel: "Moderasiya kanalı",
      noAlert: "Bildiriş yoxdur",
    },
    preset: {
      title: "AutoMod — Türkcə Söyüş Filtri",
      description: "Hazır, geniş türkcə söyüş və təhqir lüğəti. Yazı hiylələrini də tutur (hərf təkrarı, 4→a, 1→ı, 0→o, $→s, nöqtə və ya boşluqla ayırma); \"sıkıntı\", \"amaç\", \"piknik\" kimi zərərsiz sözlərə toxunmur.",
      enable: "Bir kliklə aktiv et",
      enabled: "Aktiv",
      allowTitle: "İcazə verilən sözlər",
      allowDescription: "Filtrə düşməsini istəmədiyin sözlər (vergül və ya yeni sətirlə ayır; sonuna * qoysan, söz başlanğıcı). Həm hazır filtrə, həm də qadağan olunmuş söz siyahısına aiddir.",
      allowPlaceholder: "amina, söz*",
    },
    spam: {
      title: "AutoMod — Spam Aşkarlanması",
      description: "Qısa müddətdə çox mesaj göndərən və ya eyni məzmunu təkrar-təkrar göndərən üzvün mesajları bloklanır.",
      maxMessages: "Ən çox mesaj",
      window: "Müddət (saniyə)",
      duplicates: "Eyni mesaj təkrarı (60 san)",
    },
    caps: {
      title: "AutoMod — Böyük Hərf Seli",
      description: "Hərflərinin göstərilən nisbətdən çoxu böyük olan mesajlar bloklanır (qısa mesajlar istisnadır).",
      percent: "Böyük hərf nisbəti (%)",
      minLetters: "Ən az hərf",
    },
    links: {
      inviteTitle: "Dəvət keçidlərini blokla",
      inviteDescription: "Ciklet və Discord server dəvətləri paylaşıla bilməz.",
      blockedTitle: "Bloklanmış domenlər",
      blockedDescription: "Keçid filtri söndürülü olsa belə, bu domenlərə (və alt domenlərinə) keçidlər bloklanır.",
    },
    profile: {
      title: "AutoMod — İstifadəçi Adı və Profil Filtri",
      description: "Görünən ad, istifadəçi adı, server ləqəbi və bioqrafiya qadağan olunmuş söz siyahısından və (aktivdirsə) söyüş filtrindən keçməlidir. Filtrə düşən üzv adını düzəldənə qədər mesaj göndərə bilməz; belə ləqəb və server bioqrafiyası yadda saxlanmır.",
    },
    actions: {
      warnTitle: "Kanalda xəbərdarlıq sətri",
      warnDescription: "Bloklanmış mesajın kanalına qısa AutoMod xəbərdarlığı düşür (mesajın məzmunu göstərilmir).",
      blockMessageTitle: "Göndərənə göstəriləcək mətn",
      blockMessageDescription: "Boş qoysan, qaydanın öz izahı göstərilir.",
      blockMessagePlaceholder: "Bu mesaj server qaydalarına ziddir.",
    },
    exempt: {
      title: "AutoMod — İstisnalar",
      description: "Mesajları İdarə Et icazəsi olanlar həmişə istisnadır. Buradakı rollar və kanallar (alt mövzuları daxil olmaqla) da yoxlanmır.",
      roles: "İstisna rollar",
      channels: "İstisna kanallar",
      none: "Seçilməyib",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "CANLI",
  settings: {
    hint: "Yayın edərkən profilində \"Canlı\" göstərmək üçün hesabını bağla",
    broadcaster: "Yayımçı icazələri",
    broadcasterHint: "Bağlı rollara abunəçilərini oxumağa imkan verir",
    grantBroadcaster: "Yayımçı kimi bağla",
    connect: "Bağla",
    reconnect: "Yenidən bağla",
    disconnect: "Sil",
    disconnected: "{platform} bağlantısı silindi.",
    disconnectFailed: "{platform} bağlantısını silmək mümkün olmadı.",
    liveNow: "İndi canlıdadır",
  },
  linkedRoles: {
    title: "Bağlı Rollar",
    description: "Rolu Twitch və ya Kick kanalına abunəliyə bağla. Üzvlər hesablarını bağlayanda şərtlərə uyğun gəlirlərsə rol avtomatik verilir, abunəlik bitəndə isə götürülür (hər yarım saatdan bir yenidən yoxlanılır). Bunu yalnız server sahibi öz kanalı üçün qura bilər.",
    ownerOnly: "Bağlı rolları yalnız server sahibi idarə edə bilər.",
    role: "Rol",
    platform: "Platforma",
    requirement: "Şərt",
    subscriber: "Kanalıma abunədir",
    follower: "Kanalımı izləyir",
    followerTwitchOnly: "İzləyici şərti yalnız Twitch üçündür (Kick izləməni dayandırmağı bildirmir).",
    add: "Bağla",
    remove: "Sil",
    empty: "Hələ bağlı rol yoxdur.",
    loading: "Yüklənir…",
    needsBroadcaster: "Əvvəlcə Ayarlar → Profil → Bağlantılar bölməsində \"Yayımçı kimi bağla\" ilə {platform} hesabını bağla.",
    created: "Bağlı rol yaradıldı.",
    createFailed: "Bağlı rolu yaratmaq mümkün olmadı.",
    removeFailed: "Bağlı rolu silmək mümkün olmadı.",
    granted: "{count} üzv",
    lastSynced: "Son yoxlama: {time}",
    selectRole: "Rol seç",
  },

} satisfies Translation<typeof streamingTr>;
