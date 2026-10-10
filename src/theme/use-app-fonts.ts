import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Poppins_400Regular,
  Poppins_400Regular_Italic,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Figtree_400Regular,
  Figtree_400Regular_Italic,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import {
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { parseAppFontId, setAppFont, type AppFontId } from "./fonts";

// Son bilinen web font seçimi: açılışta ilk kare doğru yüzle çizilir,
// sunucu yanıtı geldiğinde navigator yeniden kurulmaz.
const FONT_CACHE_KEY = "ciklet.appFont";
// Önbellek yokken (ilk açılış) sunucuyu en fazla bu kadar bekle.
const FIRST_FONT_TIMEOUT_MS = 2500;

const FONT_ASSETS = {
  "CikletInter-400": Inter_400Regular,
  "CikletInter-400Italic": Inter_400Regular_Italic,
  "CikletInter-500": Inter_500Medium,
  "CikletInter-600": Inter_600SemiBold,
  "CikletInter-700": Inter_700Bold,
  "CikletPoppins-400": Poppins_400Regular,
  "CikletPoppins-400Italic": Poppins_400Regular_Italic,
  "CikletPoppins-500": Poppins_500Medium,
  "CikletPoppins-600": Poppins_600SemiBold,
  "CikletPoppins-700": Poppins_700Bold,
  "CikletPlusJakartaSans-400": PlusJakartaSans_400Regular,
  "CikletPlusJakartaSans-400Italic": PlusJakartaSans_400Regular_Italic,
  "CikletPlusJakartaSans-500": PlusJakartaSans_500Medium,
  "CikletPlusJakartaSans-600": PlusJakartaSans_600SemiBold,
  "CikletPlusJakartaSans-700": PlusJakartaSans_700Bold,
  "CikletFigtree-400": Figtree_400Regular,
  "CikletFigtree-400Italic": Figtree_400Regular_Italic,
  "CikletFigtree-500": Figtree_500Medium,
  "CikletFigtree-600": Figtree_600SemiBold,
  "CikletFigtree-700": Figtree_700Bold,
  "CikletDMSans-400": DMSans_400Regular,
  "CikletDMSans-400Italic": DMSans_400Regular_Italic,
  "CikletDMSans-500": DMSans_500Medium,
  "CikletDMSans-600": DMSans_600SemiBold,
  "CikletDMSans-700": DMSans_700Bold,
  // Dokimorji bayrakları yazı kutusunda (bkz. lib/emoji.ts `DOKIMORJI_FONT`).
  Dokimorji: require("../../assets/fonts/dokimorji.ttf"),
} as const;

/** APK'ya gömülü yüzleri yükler ve webdeki global seçimi uygular. */
export function useAppFonts() {
  const [loaded, loadError] = useFonts(FONT_ASSETS);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let applied: AppFontId | null = null;
    const apply = (id: AppFontId) => {
      if (cancelled || id === applied) return;
      applied = id;
      setAppFont(id);
      setRevision((value) => value + 1);
    };

    void (async () => {
      const cached = await AsyncStorage.getItem(FONT_CACHE_KEY).catch(() => null);
      if (cancelled) return;
      if (cached) apply(parseAppFontId(cached));
      try {
        const { fontId } = await api<{ fontId: string }>(endpoints.appearance, {
          skipRefresh: true,
          ...(cached ? {} : { timeoutMs: FIRST_FONT_TIMEOUT_MS }),
        });
        const id = parseAppFontId(fontId);
        // Yalnızca seçim değiştiyse yeniden çizilir (revision artar).
        apply(id);
        if (id !== cached) void AsyncStorage.setItem(FONT_CACHE_KEY, id).catch(() => {});
      } catch {
        if (!applied) apply("inter");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  // Yüzler yüklendiyse seçim uygulanana kadar beklenir; yüklenemediyse
  // sistem fontuyla açılır.
  return { ready: loaded ? revision > 0 : Boolean(loadError), revision };
}
