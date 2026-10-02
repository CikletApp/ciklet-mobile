import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as WebBrowser from "expo-web-browser";

import { Divider, ListGroup, ListRow, showToast } from "@/components/ui";
import { BrandMark } from "@/features/auth/auth-shell";
import { API_BASE_URL } from "@/lib/config";
import { CLIENT_COMMIT } from "@/lib/device";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Yardım — uygulama sürümü, destek, geri bildirim ve hukuki metinler.
 *
 * Web'de kullanıcıya yönelik bir yardım merkezi henüz yok; `docs.ciklet.xyz`
 * GELİŞTİRİCİ belgeleri (bot, aktivite, OAuth2). Bu yüzden "Yardım Merkezi"
 * diye oraya göndermiyoruz; ayrı ve adıyla duruyor.
 *
 * Web sayfaları uygulama İÇİ tarayıcıda açılır (Custom Tabs /
 * SFSafariViewController): kullanıcı kapatınca doğrudan buraya döner.
 */

const DEVELOPER_DOCS_URL = "https://docs.ciklet.xyz/";
const SUPPORT_ADDRESS = "destek@ciklet.app";

const version = Application.nativeApplicationVersion ?? "0.0.0-dev";
const build = Application.nativeBuildVersion;
// Sürüm = git commit sayısı (app.config.js); derleme numarası da aynı sayı
// olduğundan ayrıca yazılmaz, yalnızca farklıysa parantezde gösterilir.
// Commit hash'i 7 karakter; web ve masaüstüyle aynı biçim.
const buildSuffix = build && build !== version ? ` (${build})` : "";
const versionLabel = `Sürüm ${version}${buildSuffix} · ${CLIENT_COMMIT}`;

function openPage(url: string) {
  void WebBrowser.openBrowserAsync(url, {
    toolbarColor: colors.bg,
    controlsColor: authBrand.lime,
    showTitle: true,
  }).catch(() => showToast("Sayfa açılamadı.", "error"));
}

/**
 * Geri bildirim e-postası — tanı bilgisi önceden doldurulur ki kullanıcı
 * "hangi sürüm, hangi telefon" sorularına ayrıca yanıt vermek zorunda
 * kalmasın. Kişisel veri yok: yalnızca uygulama ve cihaz modeli.
 */
function sendFeedback() {
  const lines = [
    "",
    "",
    "— Aşağıdaki bilgiler sorunu çözmemize yardımcı olur, lütfen silme —",
    `Ciklet ${version}${buildSuffix} · ${CLIENT_COMMIT}`,
    `${Platform.OS === "ios" ? "iOS" : "Android"} ${Device.osVersion ?? Platform.Version}`,
    `${Device.manufacturer ?? ""} ${Device.modelName ?? ""}`.trim(),
  ];
  const subject = encodeURIComponent("Ciklet mobil — geri bildirim");
  const body = encodeURIComponent(lines.join("\n"));
  Linking.openURL(`mailto:${SUPPORT_ADDRESS}?subject=${subject}&body=${body}`).catch(() =>
    showToast(`E-posta uygulaması bulunamadı. ${SUPPORT_ADDRESS} adresine yazabilirsin.`, "error")
  );
}

export default function HelpScreen() {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ alignItems: "center" }}>
              <Text style={{ ...typography.title, color: colors.bright }}>Ciklet</Text>
              <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>{versionLabel}</Text>
            </View>
          ),
          headerTitleAlign: "center",
        }}
      />

      <View style={{ alignItems: "center", paddingVertical: spacing["3xl"] }}>
        <View
          style={{
            width: 200,
            height: 200,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.bento,
            boxShadow: `0 0 60px ${authBrand.lime}22`,
          }}
        >
          <BrandMark size={112} />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl }}>
        <ListGroup>
          <ListRow
            icon="help"
            title="Bize ulaş"
            subtitle={SUPPORT_ADDRESS}
            onPress={() =>
              Linking.openURL(`mailto:${SUPPORT_ADDRESS}`).catch(() =>
                showToast(`E-posta uygulaması bulunamadı. ${SUPPORT_ADDRESS} adresine yazabilirsin.`, "error")
              )
            }
          />
          <Divider inset={52} />
          <ListRow
            icon="message"
            title="Geri bildirim gönder"
            subtitle="Teknik sorunları bildir"
            onPress={sendFeedback}
          />
        </ListGroup>

        <ListGroup>
          <ListRow icon="file" title="Kullanıcı Sözleşmesi" onPress={() => openPage(`${API_BASE_URL}/terms`)} />
          <Divider inset={52} />
          <ListRow icon="shield" title="Gizlilik Bildirimi" onPress={() => openPage(`${API_BASE_URL}/privacy`)} />
          <Divider inset={52} />
          <ListRow icon="flag" title="Son Kullanıcı Sözleşmesi" onPress={() => openPage(`${API_BASE_URL}/eula`)} />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon="file"
            title="Açık kaynak lisansları"
            subtitle="Kullandığımız kütüphaneler ve atıflar"
            onPress={() => openPage(`${API_BASE_URL}/licenses`)}
          />
          <Divider inset={52} />
          <ListRow
            icon="link"
            title="Geliştirici belgeleri"
            subtitle="Botlar, aktiviteler ve OAuth2"
            onPress={() => openPage(DEVELOPER_DOCS_URL)}
          />
        </ListGroup>

        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>© {new Date().getFullYear()} Ciklet</Text>
          {/* Twemoji grafikleri CC-BY 4.0: atıf zorunlu. */}
          <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>
            Emoji grafikleri: Twemoji (jdecked/twemoji), CC-BY 4.0.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
