import mobileAds, {
  AdEventType,
  AdsConsent,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

/**
 * Ödüllü reklam (Google AdMob) — bkz. docs/REKLAM-PLANI.txt.
 *
 * Ödülü uygulama VERMEZ. Reklam tamamlanınca AdMob, ciklet-web'deki SSV
 * ucunu imzalı olarak çağırır ve Plus süresini sunucu yazar. Burada yalnızca
 * reklam gösterilir ve SSV'nin eşleştirebilmesi için profil kimliği
 * (`userId`) ile sunucunun verdiği tek kullanımlık nonce (`customData`)
 * isteğe eklenir. Aksi hâlde istemciyi değiştiren herkes reklam izlemeden
 * ödül alırdı.
 *
 * Reklamlar her zaman KİŞİSELLEŞTİRİLMEMİŞ istenir: hedefleme için kişisel
 * veri kullanılmaz.
 */

/** Reklam bu sürede yüklenmezse vazgeçilir; kullanıcı dönen düğmede kalmasın. */
const LOAD_TIMEOUT_MS = 30_000;

let prepared: Promise<boolean> | null = null;

/** Onay formu (UMP, gerekiyorsa) + SDK başlatma — ilk reklamda bir kez. */
function prepare(): Promise<boolean> {
  prepared ??= (async () => {
    try {
      const consent = await AdsConsent.gatherConsent();
      if (!consent.canRequestAds) return false;
    } catch {
      // AdMob konsolunda gizlilik mesajı tanımlı değilse UMP hata verebilir;
      // bu reklam istemeyi engellemez.
    }
    await mobileAds().initialize();
    return true;
  })().catch(() => {
    prepared = null;
    return false;
  });
  return prepared;
}

/** `earned`: reklam sonuna kadar izlendi; ödül sunucuya AdMob üzerinden gider. */
export type RewardedOutcome = "earned" | "dismissed" | "unavailable";

export async function showRewardedAd({
  adUnitId,
  userId,
  customData,
}: {
  /** Root panelinden; yoksa Google'ın test birimi. */
  adUnitId: string | null;
  userId: string;
  customData: string;
}): Promise<RewardedOutcome> {
  if (!(await prepare())) return "unavailable";

  const ad = RewardedAd.createForAdRequest(adUnitId || TestIds.REWARDED, {
    requestNonPersonalizedAdsOnly: true,
    serverSideVerificationOptions: { userId, customData },
  });

  return new Promise<RewardedOutcome>((resolve) => {
    let earned = false;
    let settled = false;
    const unsubscribe: (() => void)[] = [];
    const timer = setTimeout(() => finish("unavailable"), LOAD_TIMEOUT_MS);

    function finish(outcome: RewardedOutcome) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe.forEach((off) => off());
      resolve(outcome);
    }

    unsubscribe.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        // Gösterildiği andan sonra süre sınırı yok: izleme uzun sürebilir.
        clearTimeout(timer);
        ad.show().catch(() => finish("unavailable"));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? "earned" : "dismissed")),
      ad.addAdEventListener(AdEventType.ERROR, () => finish("unavailable"))
    );

    ad.load();
  });
}
