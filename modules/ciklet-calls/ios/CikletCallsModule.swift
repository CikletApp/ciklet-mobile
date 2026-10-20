import ExpoModulesCore
import UIKit

/**
 * iOS: CallKit + PushKit köprüsü. JS tarafı: modules/ciklet-calls/index.ts
 * (`CikletCallKitModule`) ve src/features/call/callkit.ts.
 *
 * Asıl iş CikletCallController'da; modül yalnızca olayları JS'e taşır.
 * Durum değiştiren işlevler ana kuyrukta çalışır (CallKit/PushKit orada).
 */
public class CikletCallsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CikletCalls")

    Events("onVoipToken", "onIncomingCall", "onCallAction")

    OnCreate {
      CikletCallController.shared.startPushRegistry()
      CikletCallController.shared.attach { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnDestroy {
      CikletCallController.shared.detach()
    }

    Function("isSupported") { true }

    Function("isCallKitSupported") { true }

    /** "development" (Xcode/dev client imzası) ya da "production" (TestFlight/App Store). */
    Function("getApsEnvironment") { () -> String in
      CikletCallsModule.apsEnvironment()
    }

    AsyncFunction("getVoipToken") { () -> String? in
      CikletCallController.shared.voipToken
    }.runOnQueue(.main)

    /** JS dinleyicileri kuruldu: süreç JS'siz başladıysa biriken olaylar. */
    AsyncFunction("takePendingEvents") { () -> [[String: Any]] in
      CikletCallController.shared.takePendingEvents()
    }.runOnQueue(.main)

    AsyncFunction("stopListening") {
      CikletCallController.shared.stopListening()
    }.runOnQueue(.main)

    AsyncFunction("getActiveCalls") { () -> [[String: Any]] in
      CikletCallController.shared.activeCalls()
    }.runOnQueue(.main)

    AsyncFunction("reportIncomingCall") { (info: [String: Any]) in
      CikletCallController.shared.reportIncoming(info: info, fromPush: false)
    }.runOnQueue(.main)

    AsyncFunction("startOutgoingCall") { (key: String, name: String, video: Bool) in
      CikletCallController.shared.startOutgoing(key: key, name: name, video: video)
    }.runOnQueue(.main)

    AsyncFunction("reportConnected") { (key: String) in
      CikletCallController.shared.reportConnected(key: key)
    }.runOnQueue(.main)

    AsyncFunction("endCall") { (key: String, reason: String) in
      CikletCallController.shared.endCall(key: key, reason: reason)
    }.runOnQueue(.main)

    AsyncFunction("setMuted") { (key: String, muted: Bool) in
      CikletCallController.shared.setMuted(key: key, muted: muted)
    }.runOnQueue(.main)

    /// Sesli görüşmede ahizedeyken yakınlık sensörü: telefon yüze yaklaşınca
    /// sistem ekranı karartır ve dokunuşları keser (telefon uygulaması gibi).
    Function("setProximityScreenOff") { (enabled: Bool) in
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = enabled
      }
    }
  }

  /**
   * APNs ortamı imzadan okunur: dev client ve Xcode derlemeleri sandbox'a,
   * TestFlight/App Store derlemeleri (embedded.mobileprovision yok)
   * üretime kayıtlı token alır. Sunucu VoIP push'u doğru uca göndermek
   * için bunu cihaz kaydıyla saklar.
   */
  static func apsEnvironment() -> String {
    #if targetEnvironment(simulator)
    return "development"
    #else
    guard
      let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
      let data = try? Data(contentsOf: url),
      let text = String(data: data, encoding: .isoLatin1)
    else {
      return "production"
    }
    guard let keyRange = text.range(of: "<key>aps-environment</key>") else { return "production" }
    let rest = text[keyRange.upperBound...]
    guard
      let open = rest.range(of: "<string>"),
      let close = rest.range(of: "</string>", range: open.upperBound..<rest.endIndex)
    else {
      return "production"
    }
    let value = rest[open.upperBound..<close.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
    return value == "development" ? "development" : "production"
    #endif
  }
}
