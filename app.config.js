/**
 * Dinamik yapılandırma — app.json'un üstüne derleme anı bilgisi ekler.
 *
 * SÜRÜM = GIT COMMIT SAYISI. `git rev-list --count HEAD` her commit'te bir
 * artar; bu yüzden hem kullanıcıya görünen sürüm (`version`) hem de
 * mağazaların artan tam sayı istediği alanlar (Android `versionCode`,
 * iOS `buildNumber`) aynı sayıdır. Mağaza kuralları:
 *   - Play: versionCode artan tam sayı (commit sayısı artar), versionName serbest.
 *   - App Store: CFBundleShortVersionString "en çok üç nokta ayrımlı tam sayı";
 *     tek sayı ("84") geçerli. CFBundleVersion = buildNumber artan.
 * Dikkat: geçmişi yeniden yazan (rebase/squash) bir ana dal sayıyı
 * KÜÇÜLTEBİLİR; mağazaya giden derlemeler düz ilerleyen bir daldan alınmalı.
 * CI'da klon TAM geçmişle alınmalı (actions/checkout `fetch-depth: 0`);
 * sığ klonda sayı 1 çıkar.
 *
 * Git yoksa (EAS derleme makinesi .git'i almaz) sıra:
 * `EXPO_PUBLIC_GIT_COMMIT_COUNT` ortam değişkeni → app.json'daki sabitler.
 * Commit hash'i (7 karakter) yalnızca `extra.gitCommit` olarak taşınır ve
 * Yardım ekranında sürümün yanında gösterilir (web/masaüstüyle aynı biçim).
 *
 * iOS FIREBASE: Firebase'de iOS uygulaması kaydı (GoogleService-Info.plist)
 * henüz yok. iOS'ta Firebase iki koşulla açılır: dosya proje kökünde VE
 * package.json `expo.autolinking.ios.exclude` Firebase'i dışlamıyor.
 * Şu an dışlanıyor: pod'lar iOS'a bağlanmaz, iOS hedefinde Firebase
 * eklentileri çıkarılır (`@react-native-firebase/app` eklentisi dosyasız
 * prebuild'i durduruyor), analitik iOS'ta sessizce kapalı kalır
 * (src/lib/analytics.ts). Android hiç etkilenmez.
 *
 * Dışlama react-native.config.js ile yapılamıyor: Expo autolinking'in
 * birleştirmesi `platforms.ios: null`'u boş nesne sayıp yutuyor ve kendi
 * iOS ayarı olan @react-native-firebase/app yine bağlanıyordu.
 *
 * iOS'ta Firebase'i açmak için: plist'i köke koy, exclude'u kaldır ve
 * RNFB'nin istediği `use_frameworks! :linkage => :dynamic` ayarını ekle
 * (expo-build-properties `ios.useFrameworks: "dynamic"`).
 *
 * iOS EXPO MODÜLLERİ KAYNAKTAN: SDK 57 Podfile şablonu Expo'nun önceden
 * derlenmiş modüllerini (xcframework) varsayılan olarak kullanıyor. Kurulu
 * expo-modules-core 57.0.10'un hazır çerçevesi expo-modules-jsi 57.0.4'e
 * göre derlenmiş; kilit dosyası JSI'yi 57.0.8'e çıkarınca çekirdek, JSI'de
 * artık dışa aktarılmayan `JavaScriptActor.assumeIsolated`'ı aradı ve
 * uygulama açılışta dyld "Symbol not found" ile düştü. Podfile özelliği
 * `EXPO_USE_PRECOMPILED_MODULES: "false"` her Expo modülünü kurulu
 * sürümlerden derletir; React Native çekirdeği hazır kalır.
 */
/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { withGradleProperties, withPodfileProperties } = require("expo/config-plugins");
const appJson = require("./app.json");
const packageJson = require("./package.json");

/** Podfile.properties.json → EXPO_USE_PRECOMPILED_MODULES=0 (bkz. üstteki not). */
function withExpoModulesFromSource(config) {
  return withPodfileProperties(config, (cfg) => {
    cfg.modResults.EXPO_USE_PRECOMPILED_MODULES = "false";
    return cfg;
  });
}

/**
 * Gradle JVM belleği. Şablonun 2 GB'ı release dex birleştirmesinde (D8)
 * yetmiyor: GitHub'ın Linux makinesinde ":app:mergeDexRelease" adımı
 * "OutOfMemoryError: Java heap space" ile düştü (yerelde şans eseri geçiyordu).
 */
const GRADLE_JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const key = "org.gradle.jvmargs";
    const existing = cfg.modResults.find((item) => item.type === "property" && item.key === key);
    if (existing) existing.value = GRADLE_JVM_ARGS;
    else cfg.modResults.push({ type: "property", key, value: GRADLE_JVM_ARGS });
    return cfg;
  });
}

const IOS_FIREBASE_PLIST = "GoogleService-Info.plist";
const FIREBASE_PLUGINS = new Set(["@react-native-firebase/app", "@react-native-firebase/analytics"]);

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function gitCommit() {
  const hash = git("rev-parse --short=7 HEAD");
  return hash ? hash.slice(0, 7) : "unknown";
}

/** Commit sayısı; bulunamazsa `null` (çağıran app.json'a düşer). */
function gitCommitCount() {
  const fromEnv = Number.parseInt(process.env.EXPO_PUBLIC_GIT_COMMIT_COUNT ?? "", 10);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  const counted = Number.parseInt(git("rev-list --count HEAD"), 10);
  return Number.isInteger(counted) && counted > 0 ? counted : null;
}

/** iOS'ta Firebase bağlı mı: plist var VE autolinking dışlamıyor. */
function iosFirebaseEnabled() {
  const excluded = new Set(packageJson.expo?.autolinking?.ios?.exclude ?? []);
  if (excluded.has("@react-native-firebase/app")) return false;
  return fs.existsSync(path.join(__dirname, IOS_FIREBASE_PLIST));
}

/**
 * Yapılandırma iOS için mi okunuyor? Derleme betiği (scripts/ios) bunu
 * ortam değişkeniyle açıkça söyler; elle `expo prebuild -p ios` ve
 * `expo run:ios` komut satırından anlaşılır.
 */
function isIosTarget() {
  if (process.env.CIKLET_PREBUILD_PLATFORM === "ios") return true;
  const args = process.argv.slice(2);
  if (args.includes("run:ios")) return true;
  const at = args.findIndex((arg) => arg === "--platform" || arg === "-p");
  return at !== -1 && args[at + 1] === "ios";
}

function pluginName(entry) {
  return Array.isArray(entry) ? entry[0] : entry;
}

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };
  const count = gitCommitCount();
  if (count === null) {
    console.warn("[app.config] git commit sayısı bulunamadı; app.json sürümü kullanılıyor");
  }

  const iosFirebase = iosFirebaseEnabled();
  const dropFirebase = !iosFirebase && isIosTarget();
  const plugins = [
    ...(base.plugins ?? []).filter(
      (entry) => !dropFirebase || !FIREBASE_PLUGINS.has(pluginName(entry))
    ),
    withExpoModulesFromSource,
    withGradleMemory,
  ];

  return {
    ...base,
    plugins,
    version: count === null ? base.version : String(count),
    android: {
      ...base.android,
      versionCode: count ?? base.android?.versionCode,
    },
    ios: {
      ...base.ios,
      buildNumber: count === null ? base.ios?.buildNumber : String(count),
      ...(iosFirebase ? { googleServicesFile: `./${IOS_FIREBASE_PLIST}` } : {}),
    },
    extra: {
      ...appJson.expo.extra,
      ...(config?.extra ?? {}),
      gitCommit: process.env.EXPO_PUBLIC_GIT_COMMIT?.trim().slice(0, 7) || gitCommit(),
      gitCommitCount: count,
      // Çalışma zamanı (lib/analytics.ts): iOS'ta Firebase bağlı mı?
      iosFirebase,
    },
  };
};
