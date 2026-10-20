import ExpoModulesCore
import UIKit

/**
 * PushKit kaydı süreç açılır açılmaz yapılmalı: uygulama kapalıyken gelen
 * VoIP push süreci arka planda başlatır ve push yalnızca o anda kayıtlı bir
 * PKPushRegistry'ye teslim edilir. JS (ve modül) o sırada henüz yok.
 *
 * Son Aramalar'dan geri arama da buradan (INStartCallIntent): soğuk
 * açılışta JS hazır olmadan gelir, olay kuyruğa girer.
 */
public class CikletCallsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CikletCallController.shared.startPushRegistry()
    return true
  }

  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // Başka abonelerin (expo-linking, expo-router) etkinlikleri burada yok sayılır.
    return CikletCallController.shared.handleStartCallActivity(userActivity)
  }
}
