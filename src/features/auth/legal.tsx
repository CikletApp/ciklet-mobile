import { router } from "expo-router";
import { EULA_EFFECTIVE_DATE, EULA_VERSION } from "@ciklet/embedded-activities-sdk/types";

/**
 * Son Kullanıcı Sözleşmesi — METNİN kendisi.
 *
 * Kaynak: ciklet-web `components/landing/eula-modal.tsx`. Aynı belge, aynı
 * bölümler, aynı sıra. Yasal metin iki istemcide ayrışamaz: kullanıcı
 * telefonda A metnini, tarayıcıda B metnini kabul ediyorsa hangisini kabul
 * ettiği belirsizdir.
 *
 * Sunum farkı bilinçli: web sürümü metnin içinde `**Ciklet**` yazıyor ve o
 * yıldızları olduğu gibi ekrana basıyor (markdown hiç işlenmiyor). Burada
 * aynı sözcükler kalın olarak işaretlenir — metin değişmez, yalnızca
 * yıldızlar ekranda görünmez.
 */

export { EULA_EFFECTIVE_DATE, EULA_VERSION };

/** Bir paragraf: düz metin ya da kalın vurgulu parçalar. */
export type LegalSpan = string | { bold: string };

export interface LegalBullet {
  title: string;
  body: string;
}

export interface LegalSection {
  heading: string;
  paragraphs?: LegalSpan[][];
  /** Kart biçiminde listelenen maddeler (yasaklar, yasal işbirliği). */
  bullets?: LegalBullet[];
  /** Bölüm sonundaki vurgulu kutu. */
  callout?: string;
}

export const EULA_TITLE = "Son Kullanıcı Sözleşmesi";
export const EULA_KICKER = "Yasal Belge";

export const EULA_INTRO: LegalSpan[] = [
  "Ciklet'i kullanmaya devam edebilmek için lütfen aşağıdaki sözleşmeyi ",
  { bold: "tamamen okuyun" },
  " ve kabul edin.",
];

export const EULA_SECTIONS: LegalSection[] = [
  {
    heading: "1. Merhaba, Ciklet'e Hoş Geldin! (Taraflar ve Kabul)",
    paragraphs: [
      [
        "Selam! Burası ",
        { bold: "Ciklet" },
        ". Eğlenmek, sohbet etmek, takılmak ve yayın yapmak için buradasın, değil mi? Harika! Ancak bu platformun güvenli ve herkes için huzurlu kalması adına bazı kurallarımız var. Bu sözleşmeyi \"Ciklet'in ev kuralları\" olarak düşünebilirsin. Buraya kayıt olduğun an, bu kurallara uymayı söz vermiş oluyorsun. Kuralları biz (Ciklet Yönetimi) koyuyoruz, sen de (Kullanıcı) bunlara uyuyorsun. Uymayanları evimizden (uygulamamızdan) dışarı alıyoruz. Anlaştık mı? O zaman okumaya devam!",
      ],
    ],
  },
  {
    heading: "2. Kesinlikle Yasak Olan Şeyler (Neleri Yapmamalısın?)",
    paragraphs: [
      [
        "Aşağıdaki şeyleri yapmak kesinlikle, istisnasız ve tartışmasız bir şekilde yasaktır. \"Şaka yapıyordum\", \"hesabım çalınmış\", \"kuzenim yazmış\" gibi bahaneleri maalesef kabul edemiyoruz. Lütfen dikkatlice oku:",
      ],
    ],
    bullets: [
      {
        title: "Çocuklarla İlgili Hassas Konular",
        body: "Bu en, EN önemli kuralımızdır. Çocukları tehlikeye atan, onlara zarar veren, çocukların uygunsuz veya cinsel içeriklerini barındıran HER TÜRLÜ paylaşım anında hesap kapatma ve yetkili mercilere şikayet sebebidir.",
      },
      {
        title: "Milletin Bilgilerini Çalma (Panelcilik, Kredi Kartı)",
        body: "'Kanka şu panelden senin TC numaranı bulayım mı?' demek veya başkalarının kişisel bilgilerini, çalıntı kredi kartlarını ifşa etmek, alıp satmak yasaktır. Veri hırsızlarına burada yer yok.",
      },
      {
        title: "Suça ve Şiddete Teşvik",
        body: "Silahlar, yasa dışı maddeler, terör örgütü propagandası yapmak, şiddeti övmek veya birilerini suça teşvik etmek yasaktır. Gerçek hayatta suç olan şey, Ciklet'te de suçtur.",
      },
      {
        title: "Siber Zorbalık, Taciz ve Şantaj",
        body: "Kimseye musallat olamazsın. İnsanların özel fotoğraflarını sızdırmakla tehdit edemez, onlara şantaj yapamaz, sürekli küfür edip onları rahatsız edemezsin. Biraz nazik olalım lütfen.",
      },
      {
        title: "Dolandırıcılık (Scam) ve Spam",
        body: "İnsanları 'Bedava coin kazan', 'Hemen tıkla hediye kazan' gibi sahte bağlantılarla (phishing) dolandırmak, oltalama siteleri atmak veya sürekli aynı mesajı atarak kafamızı şişirmek (spam) yasaktır.",
      },
      {
        title: "Kopya/Çalıntı İçerik İşleri",
        body: "Telif hakkı ile korunan, sana ait olmayan yazılımları, filmleri veya oyunları yasa dışı olarak dağıtamazsın.",
      },
    ],
  },
  {
    heading: "3. Polis veya Mahkeme Bir Şey Sorarsa (Yasal İşbirliği)",
    paragraphs: [
      [
        "Bizim işimiz platformu açık ve güvenli tutmak, kimseyi yasalardan kaçırmak veya saklamak değil. Bu yüzden bilmen gerekenler:",
      ],
    ],
    bullets: [
      {
        title: "Log Kayıtlarını Tutuyoruz",
        body: "Devlete olan sorumluluğumuz gereği, hangi IP adresinden, hangi saatte giriş yaptığını sistemimiz arka planda kayıt altına alır (Log tutar).",
      },
      {
        title: "Bilgileri Devletle Paylaşıyoruz",
        body: "Eğer savcılık veya emniyet güçleri, mahkeme kararıyla bize gelip \"Şu kullanıcı bir suç işlemiş, bize bilgilerini verin\" derse, elimizdeki bilgileri (IP adresi, giriş zamanları) onlara seve seve teslim ederiz. İtiraz etmeyiz, gizlemeyiz.",
      },
    ],
  },
  {
    heading: "4. Bizim Gücümüz (Moderasyon Haklarımız)",
    paragraphs: [
      [
        "Ciklet bir kamu alanı (park bahçe) değil, bizim yönettiğimiz özel bir platformdur (bir kafe gibi düşün). Bu kafenin kurallarını biz koyarız. Eğer kuralları çiğnersen, başka kullanıcıları rahatsız edersen veya sistemi bozmaya çalışırsan seni uyarmadan kapı dışarı edebiliriz (hesabını banlarız). Yazdığın uygunsuz mesajları silebiliriz, oluşturduğun sunucuları tamamen kapatabiliriz. Bunun için sana bir açıklama yapmak veya hesap vermek zorunda değiliz. Lütfen düzgün bir kullanıcı ol ve bizi bunları yapmak zorunda bırakma.",
      ],
    ],
  },
  {
    heading: "5. Senin Verilerin ve Gizliliğin (Kabul Ettiğin Şey)",
    paragraphs: [
      [
        "Kayıt olduğunda bize verdiğin e-posta adresini, doğum tarihini ve kullanıcı adını saklıyoruz. Sırrın bizimle güvende (şifren karmaşık şifreleme yöntemleriyle gizlenir, biz bile göremeyiz!). Ancak profil bilgilerin diğer kullanıcılara açıktır. Uygulamamıza kayıt olarak, senin verilerini sistemin düzgün çalışması, senin giriş yapabilmen ve gerektiğinde (yukarıda bahsettiğimiz gibi) yasal zorunluluklar sebebiyle saklamamıza ve işlememize izin, rıza ve onay vermiş oluyorsun.",
      ],
    ],
    callout:
      "TL;DR (Özetle): Kötü bir şey yapma, kimseyi rahatsız etme, yasak olan şeyleri paylaşma. Aksi halde hesabını kapatırız, polis sorarsa da bilgilerini veririz. Anlaştıysak, aşağı kadar kaydırıp \"Kabul Et\" butonuna basabilirsin! İyi eğlenceler!",
  },
];

/**
 * Gizlilik bölümünün indeksi. Kayıt ekranındaki "Gizlilik Bildirimi"
 * bağlantısı belgeyi açıp buraya kaydırır.
 */
export const PRIVACY_SECTION_INDEX = 4;

// ── Kayıt ekranındaki onay cümlesi ──────────────────────────────────

export const LEGAL_LINES = {
  signupPrefix: "“Hesap Oluştur” butonuna dokunduğunda Ciklet",
  terms: "Kullanıcı Sözleşmesi",
  signupMiddle: "’ni onaylamış ve",
  privacy: "Gizlilik Bildirimi",
  signupSuffix: "’mizi okuduğunu kabul etmiş olursun.",
} as const;

export type LegalDocumentKind = "terms" | "privacy";

/**
 * Yasal belgeyi salt-okunur olarak açar.
 *
 * Web'de bu iki bağlantı `href="#"` — yani hiçbir yere gitmiyor. Mobilde
 * kullanıcıyı ölü bir bağlantıya götürmek yerine kabul edeceği BELGENİN
 * KENDİSİNİ gösteriyoruz; gizlilik bağlantısı da aynı belgenin ilgili
 * bölümüne kaydırıyor (gizlilik, sözleşmenin 5. bölümü).
 */
export function openLegalDocument(kind: LegalDocumentKind) {
  router.push({ pathname: "/legal/document", params: { focus: kind } });
}
