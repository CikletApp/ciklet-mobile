import ExpoModulesCore
import UIKit

/**
 * PushKit kaydı süreç açılır açılmaz yapılmalı: uygulama kapalıyken gelen
 * VoIP push süreci arka planda başlatır ve push yalnızca o anda kayıtlı bir
 * PKPushRegistry'ye teslim edilir. JS (ve modül) o sırada henüz yok.
 */
public class CikletCallsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CikletCallController.shared.startPushRegistry()
    return true
  }
}
