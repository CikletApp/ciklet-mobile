import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from "react-native";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { CurrentProfile } from "@/api/types";
import { Button, Icon } from "@/components/ui";
import { AuthShell } from "@/features/auth/auth-shell";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kayıt akışının telefon doğrulama adımı — ciklet-web
 * `components/auth/verify-phone-onboarding.tsx`'in mobil karşılığı.
 *
 * Web bilgisayarda QR gösteriyor; telefon kendi ekranını tarayamayacağı için
 * burada yalnızca düğme var ve Telegram uygulaması doğrudan açılıyor.
 *
 * Oturum KISITLI (bkz. stores/auth `phonePending`): sunucu bu token'la
 * yalnızca bağlantı üretme ve profil yoklama uçlarını açıyor. Doğrulama
 * Telegram tarafında bitiyor ve bize webhook ile geliyor; bu ekranda
 * yapılacak bir şey olmadığından sonucu biz soruyoruz — aralıkla ve
 * kullanıcı Telegram'dan geri döndüğü anda.
 */

const POLL_INTERVAL_MS = 3_000;

const STEPS = [
  "Aşağıdaki düğmeyle Telegram'ı aç.",
  "Sohbeti başlat ve numaranı paylaşmayı onayla.",
  "Doğrulama tamamlanınca uygulama kendiliğinden devam eder.",
];

interface StartResponse {
  url: string;
  expiresAt: string;
}

interface VerificationLink {
  url: string;
  expiresAt: number;
}

/**
 * `https://t.me/<bot>?start=<token>` bağlantısını doğrudan Telegram
 * uygulamasında açar. https bağlantısı Android'de önce tarayıcıya ya da
 * "hangi uygulamayla açılsın" seçimine düşebiliyor; `tg://` şeması
 * uygulamaya gider. Telegram yüklü değilse şema açılamaz ve t.me sayfası
 * (indirme bağlantısıyla) açılır.
 */
async function openTelegram(url: string) {
  const match = /^https:\/\/t\.me\/(\w+)\?start=([\w-]+)$/.exec(url);
  if (match) {
    try {
      await Linking.openURL(`tg://resolve?domain=${match[1]}&start=${match[2]}`);
      return;
    } catch {
      /* Telegram yüklü değil — aşağıda web bağlantısı. */
    }
  }
  await Linking.openURL(url);
}

export default function VerifyPhoneScreen() {
  const logout = useAuth((s) => s.logout);
  const completePhoneVerification = useAuth((s) => s.completePhoneVerification);
  const [link, setLink] = useState<VerificationLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const requestLink = useCallback(async (): Promise<VerificationLink | null> => {
    setError(null);
    setLoading(true);
    try {
      const data = await api<StartResponse>(endpoints.phoneTelegramStart, { method: "POST" });
      const next = { url: data.url, expiresAt: Date.parse(data.expiresAt) };
      setLink(next);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Numara zaten doğrulanmış (başka cihazdan bitirmiş olabilir).
        setVerified(true);
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.");
      } else if (err instanceof ApiError && err.isNetwork) {
        setError("Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.");
      } else {
        setError(err instanceof ApiError && err.message ? err.message : "Bağlantı alınamadı.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bağlantı BİR KEZ isteniyor: her istek yeni bir tek kullanımlık token
  // üretip öncekini geçersiz kılar; tekrar istemek Telegram'da açılmış
  // sohbeti bozardı.
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void requestLink();
  }, [requestLink]);

  const checking = useRef(false);
  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const fresh = await api<CurrentProfile>(endpoints.currentProfile);
      // Root panelinden zorunluluk kaldırılmış olabilir: numara doğrulanmadı
      // ama hesap artık beklemede değil; /refresh o durumda da tam oturum verir.
      if (fresh?.isPhoneVerified || fresh?.phoneVerificationRequired === false) setVerified(true);
    } catch {
      // Geçici hata; bir sonraki yoklama yakalar. Oturum ölmüşse client.ts
      // çıkış yaptırır ve rota koruması giriş ekranına götürür.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    if (verified) return;
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS);
    // Telegram'dan dönüldüğü an bak: aralığı beklemek, onaylayıp geri gelen
    // kullanıcıya birkaç saniye boş ekran gösterirdi.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [verified, check]);

  const finish = useCallback(async () => {
    setError(null);
    setFinishing(true);
    // Başarılıysa durum `signedIn` olur ve rota koruması uygulamaya geçirir.
    const ok = await completePhoneVerification().catch(() => false);
    if (!ok) {
      setFinishing(false);
      setError("Numaran doğrulandı ama oturum açılamadı. Tekrar dene.");
    }
  }, [completePhoneVerification]);

  // Kısa bir onay anı, sonra uygulamaya: anında geçmek adımın
  // tamamlandığını göstermezdi.
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => void finish(), 1200);
    return () => clearTimeout(timer);
  }, [verified, finish]);

  const onVerify = async () => {
    let current = link;
    // Bağlantı 15 dakika geçerli; süresi dolduysa yenisini al.
    if (!current || Date.now() >= current.expiresAt) current = await requestLink();
    if (!current) return;
    try {
      await openTelegram(current.url);
    } catch {
      setError("Telegram açılamadı.");
    }
  };

  if (verified) {
    return (
      <AuthShell title="Numaranı doğrula">
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: authBrand.limeSoft,
            }}
          >
            <Icon name="shield" size={24} color={authBrand.lime} />
          </View>
          <Text style={{ ...typography.title, color: colors.bright }}>Numaran doğrulandı.</Text>
          {error ? (
            <Text style={{ ...typography.caption, color: colors.danger, textAlign: "center" }}>{error}</Text>
          ) : (
            <Text style={{ ...typography.caption, color: colors.muted }}>Yönlendiriliyorsun…</Text>
          )}
        </View>
        {error ? <Button label="Devam et" variant="lime" size="lg" fullWidth onPress={finish} loading={finishing} /> : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Numaranı doğrula"
      subtitle="Hesabını kullanmaya başlamadan önce telefon numaranı doğrula."
    >
      <View style={{ gap: spacing.md }}>
        {STEPS.map((step, index) => (
          <View key={step} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View
              style={{
                width: 22,
                height: 22,
                marginTop: 1,
                borderRadius: radii.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: authBrand.limeSoft,
              }}
            >
              <Text style={{ ...typography.caption, fontSize: 11, lineHeight: 14, color: authBrand.lime }}>
                {index + 1}
              </Text>
            </View>
            <Text style={{ ...typography.body, flex: 1, color: colors.muted }}>{step}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <Button
        label={link || loading ? "Telegram'da doğrula" : "Tekrar dene"}
        variant="lime"
        size="lg"
        fullWidth
        onPress={onVerify}
        loading={loading}
      />

      {link ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}
        >
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={{ ...typography.caption, color: colors.muted }}>Doğrulama bekleniyor…</Text>
        </View>
      ) : null}

      <Pressable onPress={() => void logout()} hitSlop={8} style={{ paddingTop: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
          Başka bir hesapla <Text style={{ color: authBrand.lime, ...fw(600) }}>giriş yap</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
