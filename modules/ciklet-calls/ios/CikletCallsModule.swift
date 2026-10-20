import ExpoModulesCore
import UIKit

/**
 * iOS tarafı — yalnızca yakınlık sensörü. Gelen arama bildirimi ve ön plan
 * hizmeti Android'e özgü (JS `nativeIncomingCalls`'ı Android'le sınırlar);
 * iOS'ta onların karşılığı arka plan ses kipi.
 *
 * `isProximityMonitoringEnabled` açıkken telefon yüze yaklaşınca sistem
 * ekranı karartır ve dokunuşları keser — telefon uygulamasıyla aynı.
 */
public class CikletCallsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CikletCalls")

    Events("onCallAction")

    // Android'deki gelen arama yardımcıları burada yok: JS onları iOS'ta hiç
    // çağırmıyor, ama yanlışlıkla çağrılırsa "işlev yok" yerine `false`.
    Function("isSupported") { false }

    Function("setProximityScreenOff") { (enabled: Bool) in
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = enabled
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = false
      }
    }
  }
}
