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
 *
 * Git yoksa (EAS derleme makinesi .git'i almaz) sıra:
 * `EXPO_PUBLIC_GIT_COMMIT_COUNT` ortam değişkeni → app.json'daki sabitler.
 * Commit hash'i (7 karakter) yalnızca `extra.gitCommit` olarak taşınır ve
 * Yardım ekranında sürümün yanında gösterilir (web/masaüstüyle aynı biçim).
 */
const { execSync } = require("node:child_process");
const appJson = require("./app.json");

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

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };
  const count = gitCommitCount();
  if (count === null) {
    console.warn("[app.config] git commit sayısı bulunamadı; app.json sürümü kullanılıyor");
  }
  return {
    ...base,
    version: count === null ? base.version : String(count),
    android: {
      ...base.android,
      versionCode: count ?? base.android?.versionCode,
    },
    ios: {
      ...base.ios,
      buildNumber: count === null ? base.ios?.buildNumber : String(count),
    },
    extra: {
      ...appJson.expo.extra,
      ...(config?.extra ?? {}),
      gitCommit: process.env.EXPO_PUBLIC_GIT_COMMIT?.trim().slice(0, 7) || gitCommit(),
      gitCommitCount: count,
    },
  };
};
