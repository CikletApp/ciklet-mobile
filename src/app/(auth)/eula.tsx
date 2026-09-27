import { useRef, useState } from "react";
import { ScrollView, Text, View, type NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, CikletLogo } from "@/components/ui";
import { AuthBackdrop } from "@/features/auth/auth-shell";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Son Kullanıcı Sözleşmesi adımı — ciklet-web `components/landing/eula-modal.tsx`.
 *
 * Web girişten sonra `/redirect`'te, telefon doğrulamasından ÖNCE gösteriyor;
 * mobilde bu adım hiç yoktu ve uygulamadan kaydolan kullanıcı sözleşmeyi
 * görmeden içeri giriyordu. Metin web'deki DOSTANE metnin birebir kopyası;
 * orası değişirse burası da değişmeli (resmi metin /eula sayfasında).
 *
 * Kurallar web'le aynı: "Kabul Et" metnin sonuna gelindiğinde açılır ve bir
 * kez açıldıktan sonra geri kaydırmak onu kapatmaz; "Reddet" onay ister ve
 * oturumu kapatır.
 */

/** Sona bu kadar kala "okundu" sayılır. */
const END_THRESHOLD_PX = 40;

const RULES = [
  { title: "Çocuklarla İlgili Hassas Konular", desc: "Bu, sözleşmedeki en önemli kuraldır ve istisnası yoktur. Çocukları tehlikeye atan, onlara zarar veren, çocukların uygunsuz veya cinsel içeriklerini barındıran HER TÜRLÜ paylaşım anında hesap kapatma ve yetkili mercilere şikayet sebebidir." },
  { title: "Milletin Bilgilerini Çalma (Panelcilik, Kredi Kartı)", desc: "'Kanka şu panelden senin TC numaranı bulayım mı?' demek veya başkalarının kişisel bilgilerini, çalıntı kredi kartlarını ifşa etmek, alıp satmak yasaktır. Veri hırsızlarına burada yer yok." },
  { title: "Suça ve Şiddete Teşvik", desc: "Silahlar, yasa dışı maddeler, terör örgütü propagandası yapmak, şiddeti övmek veya birilerini suça teşvik etmek yasaktır. Gerçek hayatta suç olan şey, Ciklet'te de suçtur." },
  { title: "Siber Zorbalık, Taciz ve Şantaj", desc: "Kimseye musallat olamazsın. İnsanların özel fotoğraflarını sızdırmakla tehdit edemez, onlara şantaj yapamaz, sürekli küfür edip onları rahatsız edemezsin. Biraz nazik olalım lütfen." },
  { title: "Dolandırıcılık (Scam) ve Spam", desc: "İnsanları 'Bedava coin kazan', 'Hemen tıkla hediye kazan' gibi sahte bağlantılarla (phishing) dolandırmak, oltalama siteleri atmak veya sürekli aynı mesajı atarak kafamızı şişirmek (spam) yasaktır." },
  { title: "Kopya/Çalıntı İçerik İşleri", desc: "Telif hakkı ile korunan, sana ait olmayan yazılımları, filmleri veya oyunları yasa dışı olarak dağıtamazsın." },
];

const LEGAL = [
  { title: "Log Kayıtlarını Tutuyoruz", desc: "Devlete olan sorumluluğumuz gereği, hangi IP adresinden, hangi saatte giriş yaptığını sistemimiz arka planda kayıt altına alır (Log tutar)." },
  { title: "Bilgileri Devletle Paylaşıyoruz", desc: "Eğer savcılık veya emniyet güçleri, mahkeme kararıyla bize gelip \"Şu kullanıcı bir suç işlemiş, bize bilgilerini verin\" derse, elimizdeki bilgileri (IP adresi, giriş zamanları) vermek zorundayız ve veririz. Bunu saklamayız." },
];

function Heading({ children }: { children: string }) {
  return <Text style={{ ...typography.title, color: colors.bright }}>{children}</Text>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={{ ...typography.body, color: colors.text }}>{children}</Text>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={{ ...fw(700), color: colors.bright }}>{children}</Text>;
}

function Bullet({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={{ width: 6, height: 6, marginTop: 8, borderRadius: radii.full, backgroundColor: authBrand.lime, boxShadow: `0 0 10px ${authBrand.lime}88` }} />
      <View style={{ flex: 1 }}>
        <Body>
          <Strong>{title}:</Strong> {desc}
        </Body>
      </View>
    </View>
  );
}

export default function EulaScreen() {
  const acceptEula = useAuth((s) => s.acceptEula);
  const logout = useAuth((s) => s.logout);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const measure = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
    // Bir kez sona gelindiyse geri kaydırmak düğmeyi yeniden kapatmaz.
    if (contentSize.height - (contentOffset.y + layoutMeasurement.height) < END_THRESHOLD_PX) setReachedEnd(true);
  };

  const sizes = useRef({ viewport: 0, content: 0 });
  const checkFits = () => {
    const { viewport, content } = sizes.current;
    if (viewport > 0 && content > 0 && content - viewport < END_THRESHOLD_PX) setReachedEnd(true);
  };

  const accept = async () => {
    setError(null);
    setAccepting(true);
    try {
      // Başarılıysa durum değişir ve rota koruması sıradaki adıma geçirir.
      await acceptEula();
    } catch {
      setError("Bir hata oluştu, lütfen tekrar dene.");
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bentoShell }} edges={["top", "bottom"]}>
      <AuthBackdrop />
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xs }}>
        <CikletLogo height={22} color={colors.bright} />
        <Text style={{ ...typography.overline, letterSpacing: 1.6, color: authBrand.lime, marginTop: spacing.md }}>YASAL BELGE</Text>
        <Text style={{ ...typography.display, color: colors.bright }}>Son Kullanıcı Sözleşmesi</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Ciklet&apos;i kullanmaya devam edebilmek için sözleşmeyi <Strong>sonuna kadar oku</Strong> ve kabul et.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: spacing.md }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl }}
        onScroll={(event) => measure(event.nativeEvent)}
        // Metin ekrana sığıyorsa (tablet) kaydırma olayı hiç gelmez; ölçülmezse
        // "Kabul Et" sonsuza dek kapalı kalırdı. İki ölçü de gelince bakılır.
        onLayout={(event) => {
          sizes.current.viewport = event.nativeEvent.layout.height;
          checkFits();
        }}
        onContentSizeChange={(_, height) => {
          sizes.current.content = height;
          checkFits();
        }}
        scrollEventThrottle={64}
      >
        <View style={{ gap: spacing.sm }}>
          <Heading>1. Merhaba, Ciklet&apos;e Hoş Geldin! (Taraflar ve Kabul)</Heading>
          <Body>
            Selam! Burası <Strong>Ciklet</Strong>. Eğlenmek, sohbet etmek, takılmak ve yayın yapmak için buradasın, değil mi? Harika! Ancak bu platformun güvenli ve herkes için huzurlu kalması adına bazı kurallarımız var. Bu sözleşmeyi &quot;Ciklet&apos;in ev kuralları&quot; olarak düşünebilirsin. Buraya kayıt olduğun an, bu kurallara uymayı söz vermiş oluyorsun. Kuralları biz (Ciklet Yönetimi) koyuyoruz, sen de (Kullanıcı) bunlara uyuyorsun. Uymayanları evimizden (uygulamamızdan) dışarı alıyoruz. Anlaştık mı? O zaman okumaya devam!
          </Body>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Heading>2. Kesinlikle Yasak Olan Şeyler (Neleri Yapmamalısın?)</Heading>
          <Body>
            <Strong>
              Aşağıdaki şeyleri yapmak kesinlikle, istisnasız ve tartışmasız bir şekilde yasaktır. &quot;Şaka yapıyordum&quot;, &quot;hesabım çalınmış&quot;, &quot;kuzenim yazmış&quot; gibi bahaneleri maalesef kabul edemiyoruz. Lütfen dikkatlice oku:
            </Strong>
          </Body>
          {RULES.map((rule) => <Bullet key={rule.title} {...rule} />)}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Heading>3. Polis veya Mahkeme Bir Şey Sorarsa (Yasal İşbirliği)</Heading>
          <Body>
            Bizim işimiz platformu açık ve güvenli tutmak, kimseyi yasalardan kaçırmak veya saklamak değil. Bu yüzden bilmen gerekenler:
          </Body>
          {LEGAL.map((item) => <Bullet key={item.title} {...item} />)}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Heading>4. Bizim Gücümüz (Moderasyon Haklarımız)</Heading>
          <Body>
            Ciklet bir kamu alanı (park bahçe) değil, bizim yönettiğimiz özel bir platformdur (bir kafe gibi düşün). Bu kafenin kurallarını biz koyarız. Eğer kuralları çiğnersen, başka kullanıcıları rahatsız edersen veya sistemi bozmaya çalışırsan seni uyarmadan kapı dışarı edebiliriz (hesabını banlarız). Yazdığın uygunsuz mesajları silebiliriz, oluşturduğun sunucuları tamamen kapatabiliriz. Bunun için sana bir açıklama yapmak veya hesap vermek zorunda değiliz. Lütfen düzgün bir kullanıcı ol ve bizi bunları yapmak zorunda bırakma.
          </Body>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Heading>5. Senin Verilerin ve Gizliliğin (Kabul Ettiğin Şey)</Heading>
          <Body>
            Kayıt olduğunda bize verdiğin e-posta adresini, doğum tarihini ve kullanıcı adını saklıyoruz. Sırrın bizimle güvende (şifren karmaşık şifreleme yöntemleriyle gizlenir, biz bile göremeyiz!). Ancak profil bilgilerin diğer kullanıcılara açıktır. Uygulamamıza kayıt olarak, senin verilerini sistemin düzgün çalışması, senin giriş yapabilmen ve gerektiğinde (yukarıda bahsettiğimiz gibi) yasal zorunluluklar sebebiyle saklamamıza ve işlememize izin, rıza ve onay vermiş oluyorsun.
          </Body>
          <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: authBrand.limeSoft, borderWidth: 1, borderColor: authBrand.limeBorder }}>
            <Text style={{ ...typography.overline, letterSpacing: 1.6, color: authBrand.lime }}>KISACA</Text>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
              Kötü bir şey yapma, kimseyi rahatsız etme, yasak olan şeyleri paylaşma. Aksi halde hesabını kapatırız, yetkili merciler sorarsa da bilgilerini veririz. Anlaştıysak, aşağı kadar kaydırıp &quot;Kabul Et&quot; butonuna basabilirsin.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.bentoBorder,
          backgroundColor: colors.bento,
        }}
      >
        {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
        {declineConfirm ? (
          <>
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
              Reddedersen <Strong>oturumun kapatılır</Strong> ve Ciklet&apos;i kullanamazsın. Emin misin?
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button label="Geri dön" variant="secondary" fullWidth style={{ flex: 1 }} onPress={() => setDeclineConfirm(false)} />
              <Button
                label="Evet, reddet ve çık"
                variant="danger"
                fullWidth
                style={{ flex: 1 }}
                loading={declining}
                onPress={() => {
                  setDeclining(true);
                  void logout();
                }}
              />
            </View>
          </>
        ) : (
          <>
            {!reachedEnd ? (
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
                &quot;Kabul Et&quot; sözleşmenin sonuna geldiğinde açılır.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button label="Reddet" variant="secondary" fullWidth style={{ flex: 1 }} onPress={() => setDeclineConfirm(true)} />
              <Button label="Kabul Et" variant="lime" fullWidth style={{ flex: 1 }} loading={accepting} disabled={!reachedEnd} onPress={accept} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
