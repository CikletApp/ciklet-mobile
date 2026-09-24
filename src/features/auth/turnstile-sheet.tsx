import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { api } from "@/api/client";
import { Button, IconButton } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";
import { clearNativeCookies } from "@/lib/cookies";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Cloudflare Turnstile — mobil kayıt için bot koruması.
 *
 * Widget tarayıcı işi; ciklet-web onu `/mobile-captcha` sayfasında çiziyor
 * ve jetonu `ReactNativeWebView.postMessage` ile uygulamaya veriyor. Jeton
 * başlıkla muafiyet yerine seçildi: "ben mobilim" başlığını herkes uydurur.
 *
 * Sözleşme (ciklet-web `app/mobile-captcha/page.tsx`):
 *   `{type:"turnstile", status:"ok", token}`   jeton hazır (yenilenebilir; SONUNCUSU geçerli)
 *   `{type:"turnstile", status:"disabled"}`    koruma kapalı, jetonsuz gönder
 *   `{type:"turnstile", status:"error"}`       yüklenemedi
 *
 * Jeton TEK KULLANIMLIK: istek 4xx dönerse yenisi için sayfa yeniden açılır.
 */

export const TURNSTILE_FIELD = "cf-turnstile-response";

type Outcome = { token: string | null } | null;

/**
 * Widget bu sürede jeton ya da hata bildirmezse "yüklenemedi" gösterilir.
 * Alan adı izin listesinde olmayan bir site anahtarında Cloudflare widget'ı
 * hiç çizmiyor ve sayfa da haber veremiyor; süre olmadan kullanıcı boş bir
 * pencerede sonsuza kadar beklerdi.
 */
const WIDGET_TIMEOUT_MS = 20_000;

interface CaptchaConfig {
  enabled: boolean;
  path: string;
}

/**
 * `request()` jeton döndürür: koruma kapalıysa `{ token: null }`,
 * kullanıcı vazgeçtiyse `null`.
 */
export function useTurnstile(action: "signup") {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const resolver = useRef<((outcome: Outcome) => void) | null>(null);

  const settle = useCallback((outcome: Outcome) => {
    // Sayfanın bıraktığı çerezler (analitik, Cloudflare) API isteklerinin
    // kimlik başlığını ezmesin diye kavanoz boşaltılır (bkz. lib/cookies.ts).
    void clearNativeCookies();
    resolver.current?.(outcome);
    resolver.current = null;
    setUrl(null);
    setFailed(false);
  }, []);

  const request = useCallback(async (): Promise<Outcome> => {
    let config: CaptchaConfig;
    try {
      config = await api<CaptchaConfig>("/api/mobile/auth/captcha", { skipAuth: true });
    } catch {
      // Uç yoksa (eski sunucu) koruma da yok say; sunucu gerekiyorsa
      // "Captcha failed" döner ve kullanıcı hatayı görür.
      return { token: null };
    }
    if (!config.enabled) return { token: null };

    return new Promise<Outcome>((resolve) => {
      resolver.current = resolve;
      setFailed(false);
      setUrl(`${API_BASE_URL}${config.path}?action=${action}&t=${Date.now()}`);
    });
  }, [action]);

  useEffect(() => {
    if (!url || failed) return;
    const timer = setTimeout(() => setFailed(true), WIDGET_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [url, failed]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let data: { type?: string; status?: string; token?: string };
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (data.type !== "turnstile") return;
      if (data.status === "ok" && data.token) settle({ token: data.token });
      else if (data.status === "disabled") settle({ token: null });
      else if (data.status === "error") setFailed(true);
    },
    [settle]
  );

  const element = (
    <Modal visible={url !== null} transparent animationType="fade" onRequestClose={() => settle(null)}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.xl }}>
        <View
          style={{
            borderRadius: radii.xl,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
          }}
        >
          {/* Başlık ve açıklama sayfanın kendisinde; burada yalnızca kapatma. */}
          <View style={{ height: 380, backgroundColor: colors.deep }}>
            {url ? (
              <WebView
                source={{ uri: url }}
                incognito
                onMessage={onMessage}
                onError={() => setFailed(true)}
                style={{ backgroundColor: "transparent" }}
                startInLoadingState
                renderLoading={() => (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={colors.brand} />
                  </View>
                )}
              />
            ) : null}
            <View style={{ position: "absolute", top: spacing.sm, right: spacing.sm }}>
              <IconButton icon="close" label="Vazgeç" onPress={() => settle(null)} />
            </View>
          </View>

          {failed ? (
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.danger }}>
                Doğrulama yüklenemedi. Bağlantını kontrol edip tekrar dene.
              </Text>
              <Button
                label="Tekrar dene"
                variant="secondary"
                fullWidth
                onPress={() => {
                  setFailed(false);
                  setUrl((current) => (current ? current.replace(/t=\d+/, `t=${Date.now()}`) : current));
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  return { request, element };
}
