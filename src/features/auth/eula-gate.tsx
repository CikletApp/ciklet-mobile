import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Icon } from "@/components/ui";
import { LegalDocument } from "@/features/auth/legal-document";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Son Kullanıcı Sözleşmesi kapısı.
 *
 * Web'de bu kapı bir SUNUCU bileşenidir (`app/redirect/page.tsx`): profil
 * okunur, `eulaAccepted` false ise uygulamaya hiç girilmez. Mobilde eşdeğer
 * bir sunucu adımı yok.
 *
 * ── Neden rota değil, kapatılamayan bir modal ───────────────────────
 * İlk tasarım bunu ayrı bir korumalı rota yapıyordu. Sorun şu: o durumda
 * yığında `index` diye bir ekran kalmıyor ve yönlendiricinin hangi ekranı
 * açacağı, bilerek yaslanmak istemediğim bir geri düşme davranışına
 * kalıyordu. Modal yönlendiriciden tamamen bağımsız: `pendingEula` olduğu
 * sürece ekranı kaplar ve sistem geri tuşu dahil hiçbir yolla kapanmaz
 * (`onRequestClose` bilerek boş). Kapı ancak Kabul ya da Çıkış ile açılır.
 *
 * Kabul düğmesi, web'deki gibi belge sonuna kadar kaydırılmadan
 * etkinleşmez. Reddetmek oturumu kapatır: sözleşmeyi kabul etmeyen bir
 * hesabın uygulamada işi yok.
 */
export function EulaGate() {
  const status = useAuth((s) => s.status);
  // İçerik ayrı bileşende: kapı kapalıyken sözleşme metni ve kaydırma
  // durumu hiç kurulmasın.
  if (status !== "pendingEula") return null;
  return <EulaGateContent />;
}

function EulaGateContent() {
  const acceptEula = useAuth((s) => s.acceptEula);
  const logout = useAuth((s) => s.logout);

  const [readToEnd, setReadToEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setError(null);
    setAccepting(true);
    try {
      await acceptEula();
      // Kabul, store'daki durumu `signedIn`'e çevirir ve bu bileşen
      // kendiliğinden kaybolur — elle yönlendirme gerekmez.
    } catch {
      setError("Bir hata oluştu, lütfen tekrar dene.");
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    await logout();
  };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      // Geri tuşu kapıyı AÇMAMALI: kullanıcı sözleşmeyi ya kabul eder ya da
      // çıkar. Boş işleyici, Android'de geri tuşunun modalı kapatmasını
      // engellemenin desteklenen yolu.
      onRequestClose={() => {}}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bentoShell }}
        edges={["top", "bottom"]}
      >
        <View style={{ flex: 1 }}>
          <LegalDocument
            onReachedEnd={() => setReadToEnd(true)}
            contentPaddingBottom={spacing["2xl"]}
          />
        </View>

        <View
          style={{
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.bentoBorder,
            backgroundColor: colors.bentoShell,
          }}
        >
          {!readToEnd ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radii.md,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.warning,
                backgroundColor: colors.bento,
              }}
            >
              <Icon name="chevron-down" size={16} color={colors.warning} />
              <Text style={{ ...typography.caption, color: colors.warning, flex: 1 }}>
                Kabul Et düğmesi, sözleşmeyi en alta kadar kaydırdığında etkinleşir.
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
          ) : null}

          {confirmDecline ? (
            <>
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
                Reddedersen oturumun kapatılacak ve platforma erişimin sonlanacak. Emin misin?
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Geri Dön"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onPress={() => setConfirmDecline(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Evet, Reddet"
                    variant="danger"
                    size="lg"
                    fullWidth
                    loading={declining}
                    onPress={() => void handleDecline()}
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Reddet"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={() => setConfirmDecline(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Kabul Et"
                  size="lg"
                  fullWidth
                  loading={accepting}
                  disabled={!readToEnd}
                  onPress={() => void handleAccept()}
                />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
