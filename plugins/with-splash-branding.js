/**
 * Açılış ekranının altındaki "ciklet" kelime logosu (WhatsApp'taki "from Meta"
 * yerinde). expo-splash-screen yalnızca ortadaki ikonu kuruyor; bu eklenti
 * altı ekler — açık/koyu sürümleriyle, böylece logo JS yüklenmeden ilk karede
 * görünür.
 *
 *  - Android 12+: `android:windowSplashScreenBrandingImage` (alttaki marka
 *    görseli). Sistem bu görseli 200×80 dp'lik kutuya ESNETEREK çizer (alt
 *    kenarı ekranın 60 dp üstünde); bu yüzden Android'e logo, 200×80 dp'lik
 *    şeffaf tuvalin alt ortasına yerleştirilmiş hâliyle verilir
 *    (android-branding-*.png). Gece sürümü `drawable-night-*` klasöründen
 *    kendiliğinden seçilir. Android 11 ve altı bu alanı desteklemiyor; orada
 *    yalnızca ikon görünür.
 *  - iOS: storyboard'a güvenli alanın altına yaslı ikinci bir görsel; görsel
 *    seti açık/koyu görünüm varyantlı.
 *
 * SIRA: app.json'da expo-splash-screen'den ÖNCE yazılmalı. Expo modları ters
 * sırada çalıştırır; splash eklentisi storyboard kısıtlamalarını ve görsel
 * kaynaklarını sıfırladığı için bizimkiler ONDAN SONRA uygulanmalı. Ayrıca
 * splash eklentisi storyboard sağlayıcısını hemen eklediği için ondan sonra
 * kaydedilen mod reddediliyor.
 *
 * Kaynak görseller (assets/images/splash, 1x + @2x/@3x/@4x):
 * wordmark-{light,dark} 88×20 dp (iOS ve JS), android-branding-{light,dark}
 * 200×80 dp (logo alt ortada). JS'teki açılış ekranı (BrandSplash) aynı logoyu
 * aynı yerde çizer; ölçü veya konum değişirse orayı da güncelle.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { withAndroidStyles, withDangerousMod, withMod } = require("expo/config-plugins");

const SOURCE_DIR = "assets/images/splash";
const ANDROID_DRAWABLE = "splashscreen_branding";
const IOS_IMAGE = "SplashScreenBranding";
const IOS_VIEW_ID = "CIKLET-SplashBranding";
/** iOS: logonun güvenli alanın altından uzaklığı (pt). JS'te de aynı değer. */
const IOS_BOTTOM_GAP = 16;

const ANDROID_DENSITIES = { mdpi: 1, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** `name-mode.png` (1x) ya da `name-mode@Nx.png` — Metro'nun ölçek adlandırması. */
function source(projectRoot, name, mode, scale) {
  const base = `${name}-${mode}`;
  return path.join(projectRoot, SOURCE_DIR, scale === 1 ? `${base}.png` : `${base}@${scale}x.png`);
}

// ── Android ─────────────────────────────────────────────────────────

function withAndroidBrandingImages(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      const res = path.join(platformProjectRoot, "app/src/main/res");
      for (const [density, scale] of Object.entries(ANDROID_DENSITIES)) {
        for (const [mode, folder] of [
          ["light", `drawable-${density}`],
          ["dark", `drawable-night-${density}`],
        ]) {
          const dir = path.join(res, folder);
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.copyFile(source(projectRoot, "android-branding", mode, scale), path.join(dir, `${ANDROID_DRAWABLE}.png`));
        }
      }
      return cfg;
    },
  ]);
}

function withAndroidBrandingStyle(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style ?? [];
    const splash = styles.find((style) => style.$?.name === "Theme.App.SplashScreen");
    if (!splash) {
      throw new Error("with-splash-branding: Theme.App.SplashScreen bulunamadı (expo-splash-screen eklentisi app.json plugins listesinde, BU eklentiden SONRA olmalı).");
    }
    const name = "android:windowSplashScreenBrandingImage";
    splash.item = (splash.item ?? []).filter((item) => item.$?.name !== name);
    splash.item.push({ $: { name, "tools:targetApi": "31" }, _: `@drawable/${ANDROID_DRAWABLE}` });
    return cfg;
  });
}

// ── iOS ─────────────────────────────────────────────────────────────

function withIosBrandingImageSet(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const { projectRoot, platformProjectRoot, projectName } = cfg.modRequest;
      const dir = path.join(platformProjectRoot, projectName, "Images.xcassets", `${IOS_IMAGE}.imageset`);
      await fs.promises.mkdir(dir, { recursive: true });
      const images = [];
      for (const scale of [1, 2, 3]) {
        for (const mode of ["light", "dark"]) {
          const filename = `${mode}@${scale}x.png`;
          await fs.promises.copyFile(source(projectRoot, "wordmark", mode, scale), path.join(dir, filename));
          images.push({
            idiom: "universal",
            filename,
            scale: `${scale}x`,
            ...(mode === "dark" ? { appearances: [{ appearance: "luminosity", value: "dark" }] } : {}),
          });
        }
      }
      await fs.promises.writeFile(
        path.join(dir, "Contents.json"),
        JSON.stringify({ images, info: { version: 1, author: "expo" } }, null, 2)
      );
      return cfg;
    },
  ]);
}

const constraintId = (...parts) => crypto.createHash("sha1").update(parts.join("-")).digest("hex");

function withIosBrandingStoryboard(config) {
  return withMod(config, {
    platform: "ios",
    mod: "splashScreenStoryboard",
    action: (cfg) => {
      const xml = cfg.modResults;
      const view = xml.document.scenes[0]?.scene[0]?.objects[0]?.viewController[0]?.view[0];
      if (!view) throw new Error("with-splash-branding: SplashScreen.storyboard görünümü bulunamadı.");
      const containerId = view.$.id;

      // Güvenli alan kılavuzu: şablonda var; yoksa eklenir.
      view.viewLayoutGuide = view.viewLayoutGuide ?? [];
      let safeArea = view.viewLayoutGuide.find((guide) => guide.$?.key === "safeArea");
      if (!safeArea) {
        safeArea = { $: { key: "safeArea", id: "CIKLET-SafeArea" } };
        view.viewLayoutGuide.push(safeArea);
      }
      const safeAreaId = safeArea.$.id;

      view.subviews = view.subviews?.length ? view.subviews : [{}];
      const subviews = view.subviews[0];
      subviews.imageView = (subviews.imageView ?? []).filter((item) => item.$?.id !== IOS_VIEW_ID);
      subviews.imageView.push({
        $: {
          id: IOS_VIEW_ID,
          userLabel: IOS_IMAGE,
          image: IOS_IMAGE,
          contentMode: "scaleAspectFit",
          clipsSubviews: true,
          userInteractionEnabled: false,
          translatesAutoresizingMaskIntoConstraints: false,
        },
        rect: [{ $: { key: "frame", x: 152.5, y: 798, width: 88, height: 20 } }],
      });

      view.constraints = view.constraints?.length ? view.constraints : [{ constraint: [] }];
      const constraints = view.constraints[0];
      constraints.constraint = (constraints.constraint ?? []).filter(
        (item) => item.$?.firstItem !== IOS_VIEW_ID && item.$?.secondItem !== IOS_VIEW_ID
      );
      constraints.constraint.push(
        {
          $: {
            firstItem: IOS_VIEW_ID,
            firstAttribute: "centerX",
            secondItem: containerId,
            secondAttribute: "centerX",
            id: constraintId(IOS_VIEW_ID, "centerX", containerId),
          },
        },
        {
          $: {
            firstItem: safeAreaId,
            firstAttribute: "bottom",
            secondItem: IOS_VIEW_ID,
            secondAttribute: "bottom",
            constant: IOS_BOTTOM_GAP,
            id: constraintId(safeAreaId, "bottom", IOS_VIEW_ID),
          },
        }
      );

      const resources = xml.document.resources[0];
      resources.image = (resources.image ?? []).filter((image) => image.$?.name !== IOS_IMAGE);
      resources.image.push({ $: { name: IOS_IMAGE, width: 88, height: 20 } });
      return cfg;
    },
  });
}

module.exports = function withSplashBranding(config) {
  config = withAndroidBrandingImages(config);
  config = withAndroidBrandingStyle(config);
  config = withIosBrandingImageSet(config);
  config = withIosBrandingStoryboard(config);
  return config;
};
