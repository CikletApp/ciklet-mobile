/**
 * Görüntülü görüşmenin resim içinde resim (PiP) penceresi — yerel ayarlar.
 *
 * ANDROID: ana etkinliğe `android:supportsPictureInPicture="true"`; PiP'e
 * geçiş/çıkışta etkinlik yeniden yaratılmasın diye `configChanges`'e
 * `screenSize|smallestScreenSize|screenLayout|orientation` (Google'ın PiP
 * rehberi). Geçişin kendisi modules/ciklet-calls (CallPictureInPicture.kt).
 *
 * iOS: AVPictureInPictureController (react-native-webrtc RTCPIPView,
 * `VideoTrack iosPIP`) yalnızca "Audio, AirPlay, and Picture in Picture"
 * arka plan kipiyle çalışır → UIBackgroundModes `audio` (zaten ses için
 * var; burada güvence). Kamera arka planda iOS 16+ "multitasking camera
 * access" yetkisi (Apple'dan istenen entitlement) olmadan durur — PiP'te
 * karşı tarafın görüntüsü sürer, kendi kameran karşı tarafta duraklar.
 */
const { AndroidConfig, withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

const CONFIG_CHANGES = ["screenSize", "smallestScreenSize", "screenLayout", "orientation"];

function withCallPipAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$["android:supportsPictureInPicture"] = "true";
    activity.$["android:resizeableActivity"] = "true";
    const current = new Set(
      String(activity.$["android:configChanges"] ?? "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    );
    for (const change of CONFIG_CHANGES) current.add(change);
    activity.$["android:configChanges"] = [...current].join("|");
    return cfg;
  });
}

function withCallPipIos(config) {
  return withInfoPlist(config, (cfg) => {
    const modes = new Set(cfg.modResults.UIBackgroundModes ?? []);
    modes.add("audio");
    cfg.modResults.UIBackgroundModes = [...modes];
    return cfg;
  });
}

module.exports = function withCallPip(config) {
  return withCallPipIos(withCallPipAndroid(config));
};
