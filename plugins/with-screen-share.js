/**
 * Ekran paylaşımı için yerel ayarlar (LiveKit `Track.Source.ScreenShare`).
 *
 * ANDROID — MediaProjection:
 *  - react-native-webrtc kendi manifestinde `MediaProjectionService`'i
 *    `foregroundServiceType="mediaProjection"` ile bildiriyor ve izin
 *    verilince başlatıyor (LiveKit 2.4+ `enableMediaProjectionService`'i
 *    kendisi açıyor). Android 14+ (API 34) bu türde ön plan hizmeti için
 *    uygulamanın `FOREGROUND_SERVICE_MEDIA_PROJECTION` iznini bildirmesini
 *    şart koşuyor; yoksa `startForeground` SecurityException ile düşer.
 *  - Hizmetin kalıcı bildirimi kütüphanede İngilizce; aynı adlı dizgeler
 *    uygulamada tanımlanınca kütüphaneninkini ezer (Türkçe metin).
 *  - Bildirim küçük ikonu `ic_notification` adıyla aranıyor; bulunmazsa
 *    ikon 0 kalır ve Android "geçersiz bildirim" diye ön plan hizmetini
 *    reddeder. Başka bir eklenti aynı adla ikon üretmiyorsa vektör ikon
 *    yazılır.
 *  - Sistem sesi (AudioPlaybackCapture, Android 10+) react-native-webrtc'nin
 *    `getDisplayMedia`'sında yok — yalnızca görüntü paylaşılır.
 *
 * iOS — ReplayKit Broadcast Upload Extension (LiveKit/Jitsi rehberi):
 *  - `CikletScreenShare` adlı eklenti hedefi (plugins/screen-share/ios/*.swift)
 *    Xcode projesine eklenir ve uygulamaya gömülür.
 *  - Uygulama ile eklenti aynı App Group'u (`group.com.ciklet.mobile`)
 *    paylaşır; react-native-webrtc soketi o kapsayıcıda açar.
 *  - Info.plist: `RTCAppGroupIdentifier` (soket kapsayıcısı) ve
 *    `RTCScreenSharingExtension` (sistem seçicisinde önceden seçili eklenti).
 *  - EAS kimlik bilgileri için `extra.eas.build.experimental.ios.appExtensions`.
 *  Bu makinede (Windows) iOS derlenemiyor; hedef macOS'ta doğrulanmalı.
 */
/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withStringsXml,
  withXcodeProject,
} = require("expo/config-plugins");

const ANDROID_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
];

/** react-native-webrtc MediaProjectionNotification'ın okuduğu dizgeler. */
const ANDROID_STRINGS = {
  media_projection_notification_title: "Ekranın paylaşılıyor",
  media_projection_notification_text: "Ciklet ekranını paylaşıyor. Durdurmak için uygulamaya dön.",
  ongoing_notification_channel_name: "Ekran paylaşımı",
};

const ANDROID_ICON = "ic_notification";
/** Material "screen_share" (Apache-2.0), beyaz tek renk — bildirim ikonu kuralı. */
const ANDROID_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path
      android:fillColor="#FFFFFFFF"
      android:pathData="M20,18c1.1,0 1.99,-0.9 1.99,-2L22,6c0,-1.11 -0.9,-2 -2,-2H4c-1.11,0 -2,0.89 -2,2v10c0,1.1 0.89,2 2,2H0v2h24v-2h-4zM13,14.47V12.28c-2.78,0 -4.61,0.85 -6,2.72 0.56,-2.67 2.11,-5.33 6,-5.87V7l4,3.73 -4,3.74z" />
</vector>
`;

const IOS_TARGET = "CikletScreenShare";
const IOS_SOURCES = [
  "SampleHandler.swift",
  "SocketConnection.swift",
  "SampleUploader.swift",
  "DarwinNotificationCenter.swift",
  "Atomic.swift",
];
const IOS_SOURCE_DIR = path.join(__dirname, "screen-share", "ios");
const IOS_DEPLOYMENT_TARGET = "16.4";
const APP_GROUP_KEY = "com.apple.security.application-groups";

function appGroupOf(config, props) {
  return props?.appGroup ?? `group.${config.ios?.bundleIdentifier ?? "com.ciklet.mobile"}`;
}

function extensionBundleIdOf(config) {
  return `${config.ios?.bundleIdentifier ?? "com.ciklet.mobile"}.${IOS_TARGET}`;
}

// ── Android ──────────────────────────────────────────────────────

function withScreenShareAndroid(config) {
  config = withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, ANDROID_PERMISSIONS);
    return cfg;
  });

  config = withStringsXml(config, (cfg) => {
    const items = Object.entries(ANDROID_STRINGS).map(([name, value]) =>
      AndroidConfig.Resources.buildResourceItem({ name, value })
    );
    cfg.modResults = AndroidConfig.Strings.setStringItem(items, cfg.modResults);
    return cfg;
  });

  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res");
      const taken =
        fs.existsSync(res) &&
        fs
          .readdirSync(res)
          .filter((dir) => dir.startsWith("drawable"))
          .some((dir) =>
            fs.readdirSync(path.join(res, dir)).some((file) => file.startsWith(`${ANDROID_ICON}.`))
          );
      if (!taken) {
        const dir = path.join(res, "drawable");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${ANDROID_ICON}.xml`), ANDROID_ICON_XML);
      }
      return cfg;
    },
  ]);
}

// ── iOS ──────────────────────────────────────────────────────────

function extensionInfoPlist({ version, buildNumber, appGroup }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Ciklet Ekran Paylaşımı</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${buildNumber}</string>
  <key>RTCAppGroupIdentifier</key>
  <string>${appGroup}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.broadcast-services-upload</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeSampleBuffer</string>
  </dict>
</dict>
</plist>
`;
}

function extensionEntitlements(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>${APP_GROUP_KEY}</key>
  <array>
    <string>${appGroup}</string>
  </array>
</dict>
</plist>
`;
}

function withScreenShareIos(config, props) {
  const appGroup = appGroupOf(config, props);
  const extensionBundleId = extensionBundleIdOf(config);

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.RTCAppGroupIdentifier = appGroup;
    cfg.modResults.RTCScreenSharingExtension = extensionBundleId;
    return cfg;
  });

  config = withEntitlementsPlist(config, (cfg) => {
    const groups = new Set(cfg.modResults[APP_GROUP_KEY] ?? []);
    groups.add(appGroup);
    cfg.modResults[APP_GROUP_KEY] = [...groups];
    return cfg;
  });

  // Eklenti dosyaları: Swift kaynakları + Info.plist + entitlements.
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, IOS_TARGET);
      fs.mkdirSync(dir, { recursive: true });
      for (const file of IOS_SOURCES) {
        fs.copyFileSync(path.join(IOS_SOURCE_DIR, file), path.join(dir, file));
      }
      fs.writeFileSync(
        path.join(dir, `${IOS_TARGET}-Info.plist`),
        extensionInfoPlist({
          version: cfg.version ?? "1.0.0",
          buildNumber: cfg.ios?.buildNumber ?? "1",
          appGroup,
        })
      );
      fs.writeFileSync(path.join(dir, `${IOS_TARGET}.entitlements`), extensionEntitlements(appGroup));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    // pbxTargetByName tırnaklı adı ("CikletScreenShare") eşleştirmiyor.
    const targets = project.pbxNativeTargetSection();
    const exists = Object.values(targets).some(
      (item) => typeof item === "object" && String(item.name).replace(/"/g, "") === IOS_TARGET
    );
    if (exists) return cfg;

    // node-xcode: bu bölümler yoksa addTarget bağımlılık eklerken düşüyor.
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};

    const group = project.addPbxGroup(
      [...IOS_SOURCES, `${IOS_TARGET}-Info.plist`, `${IOS_TARGET}.entitlements`],
      IOS_TARGET,
      IOS_TARGET
    );
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroupId);

    // app_extension: ana hedefe "Copy Files" (PlugIns) gömme adımı da ekler.
    const target = project.addTarget(IOS_TARGET, "app_extension", IOS_TARGET, extensionBundleId);
    project.addBuildPhase(IOS_SOURCES, "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    // ReplayKit Swift `import` ile kendiliğinden bağlanır (modules autolink).
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    const team = cfg.ios?.appleTeamId;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key]?.buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${IOS_TARGET}"`) continue;
      // addTarget yolu path.join ile kuruyor (Windows'ta ters bölü); düzelt.
      settings.INFOPLIST_FILE = `"${IOS_TARGET}/${IOS_TARGET}-Info.plist"`;
      settings.CODE_SIGN_ENTITLEMENTS = `"${IOS_TARGET}/${IOS_TARGET}.entitlements"`;
      settings.CODE_SIGN_STYLE = "Automatic";
      settings.IPHONEOS_DEPLOYMENT_TARGET = IOS_DEPLOYMENT_TARGET;
      settings.TARGETED_DEVICE_FAMILY = `"1,2"`;
      settings.SWIFT_VERSION = "5.0";
      settings.CLANG_ENABLE_MODULES = "YES";
      settings.APPLICATION_EXTENSION_API_ONLY = "YES";
      settings.GENERATE_INFOPLIST_FILE = "NO";
      settings.MARKETING_VERSION = cfg.version ?? "1.0.0";
      settings.CURRENT_PROJECT_VERSION = cfg.ios?.buildNumber ?? "1";
      if (team) settings.DEVELOPMENT_TEAM = team;
    }
    return cfg;
  });

  // EAS kimlik bilgileri eklenti hedefi için de profil üretsin.
  const extra = config.extra ?? {};
  const eas = extra.eas ?? {};
  const build = eas.build ?? {};
  const experimental = build.experimental ?? {};
  const ios = experimental.ios ?? {};
  const extensions = (ios.appExtensions ?? []).filter((item) => item.targetName !== IOS_TARGET);
  extensions.push({
    targetName: IOS_TARGET,
    bundleIdentifier: extensionBundleId,
    entitlements: { [APP_GROUP_KEY]: [appGroup] },
  });
  config.extra = {
    ...extra,
    eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: { ...ios, appExtensions: extensions } } } },
  };

  return config;
}

module.exports = function withScreenShare(config, props) {
  config = withScreenShareAndroid(config);
  config = withScreenShareIos(config, props);
  return config;
};
