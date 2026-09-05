import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { LegalDocument, type LegalDocumentHandle } from "@/features/auth/legal-document";
import type { LegalDocumentKind } from "@/features/auth/legal";
import { colors, spacing } from "@/theme/tokens";

/**
 * Yasal belgenin salt-okunur hâli.
 *
 * Kayıt ekranındaki "Kullanıcı Sözleşmesi" ve "Gizlilik Bildirimi"
 * bağlantıları buraya gelir. Web'de bu iki bağlantı `href="#"` — hiçbir
 * yere gitmiyor; kullanıcı onaylamak üzere olduğu metni okuyamıyor. Mobilde
 * belge okunabilir, `focus=privacy` ile gizlilik bölümüne kaydırılır.
 *
 * Bu ekran oturum GEREKTİRMEZ: kayıt olmadan önce de açılabilmeli.
 */
export default function LegalDocumentScreen() {
  const { focus } = useLocalSearchParams<{ focus?: LegalDocumentKind }>();
  const documentRef = useRef<LegalDocumentHandle>(null);

  useEffect(() => {
    if (focus !== "privacy") return;
    // Bölüm konumları ancak ilk yerleşimden sonra bilinir; bir kare bekle.
    const timer = setTimeout(() => documentRef.current?.scrollToPrivacy(), 250);
    return () => clearTimeout(timer);
  }, [focus]);

  return (
    <>
      <Stack.Screen options={{ title: "Yasal Belge" }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bentoShell }} edges={["bottom"]}>
        <View style={{ flex: 1 }}>
          <LegalDocument
            ref={documentRef}
            showIntro={false}
            contentPaddingBottom={spacing["3xl"]}
          />
        </View>
      </SafeAreaView>
    </>
  );
}
