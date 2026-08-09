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

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { setAppFont } from "./fonts";

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
} as const;

/** APK'ya gömülü yüzleri yükler ve webdeki global seçimi uygular. */
export function useAppFonts() {
  const [loaded, loadError] = useFonts(FONT_ASSETS);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    void api<{ fontId: string }>(endpoints.appearance, { skipRefresh: true })
      .then(({ fontId }) => {
        if (cancelled) return;
        setAppFont(fontId);
        setRevision((value) => value + 1);
      })
      .catch(() => {
        if (cancelled) return;
        setAppFont("inter");
        setRevision((value) => value + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return { ready: loaded || Boolean(loadError), revision };
}
