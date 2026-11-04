import ExpoModulesCore
import NaturalLanguage
import SwiftUI
import UIKit
#if canImport(Translation)
import Translation
#endif

/**
 * Cihaz üstü mesaj çevirisi (iOS) — Apple Translation (iOS 18+) ve
 * NaturalLanguage (dil algılama). Çeviri cihazda yapılır; dil indirilmemişse
 * sistem kendi indirme sayfasını gösterir. JS tarafı:
 * modules/ciklet-translate/index.ts, src/lib/translation/native.ts.
 *
 * iOS 18'de TranslationSession yalnızca SwiftUI `.translationTask` ile
 * alınabiliyor; bu yüzden görünmez 1×1'lik bir barındırıcı görünüm kök
 * görünüm denetleyicisine eklenir ve işler sırayla ona verilir.
 */
public class CikletTranslateModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CikletTranslate")

    Function("isSupported") { () -> Bool in
      #if canImport(Translation)
      if #available(iOS 18.0, *) { return true }
      #endif
      return false
    }

    AsyncFunction("detectLanguage") { (text: String) -> String? in
      let recognizer = NLLanguageRecognizer()
      recognizer.processString(text)
      guard let (language, confidence) = recognizer.languageHypotheses(withMaximum: 1).first,
            language != .undetermined, confidence >= 0.4 else { return nil }
      return language.rawValue
    }

    AsyncFunction("translate") { (text: String, source: String, target: String, promise: Promise) in
      #if canImport(Translation)
      if #available(iOS 18.0, *) {
        Task { @MainActor in
          TranslationHost.shared.translate(text: text, source: source, target: target) { result in
            switch result {
            case .success(let value): promise.resolve(value)
            case .failure(let error): promise.reject("ERR_TRANSLATE", error.localizedDescription)
            }
          }
        }
        return
      }
      #endif
      promise.reject("ERR_UNSUPPORTED", "Cihaz üstü çeviri iOS 18 gerektirir")
    }
  }
}

#if canImport(Translation)
@available(iOS 18.0, *)
@MainActor
final class TranslationHostModel: ObservableObject {
  struct Job {
    let text: String
    let source: String
    let target: String
    let done: (Result<String, Error>) -> Void
  }

  @Published var configuration: TranslationSession.Configuration?
  private var queue: [Job] = []
  private var current: Job?

  func enqueue(_ job: Job) {
    queue.append(job)
    startNext()
  }

  private func startNext() {
    guard current == nil, !queue.isEmpty else { return }
    let job = queue.removeFirst()
    current = job
    let next = TranslationSession.Configuration(
      source: Locale.Language(identifier: job.source),
      target: Locale.Language(identifier: job.target)
    )
    if configuration == next {
      // Aynı çift: görev yeniden tetiklensin.
      configuration?.invalidate()
    } else {
      configuration = next
    }
  }

  func run(_ session: TranslationSession) async {
    guard let job = current else { return }
    do {
      let response = try await session.translate(job.text)
      job.done(.success(response.targetText))
    } catch {
      job.done(.failure(error))
    }
    current = nil
    startNext()
  }

  /** Barındırıcı eklenemedi: bekleyen her işi düşür. */
  func failAll(_ error: Error) {
    let jobs = (current.map { [$0] } ?? []) + queue
    current = nil
    queue.removeAll()
    jobs.forEach { $0.done(.failure(error)) }
  }
}

@available(iOS 18.0, *)
struct TranslationHostView: View {
  @ObservedObject var model: TranslationHostModel

  var body: some View {
    Color.clear
      .frame(width: 1, height: 1)
      .translationTask(model.configuration) { session in
        await model.run(session)
      }
  }
}

@available(iOS 18.0, *)
@MainActor
final class TranslationHost {
  static let shared = TranslationHost()
  private let model = TranslationHostModel()
  private var controller: UIHostingController<TranslationHostView>?

  func translate(text: String, source: String, target: String, done: @escaping (Result<String, Error>) -> Void) {
    model.enqueue(.init(text: text, source: source, target: target, done: done))
    attachIfNeeded()
  }

  private func attachIfNeeded() {
    if let controller, controller.view.window != nil { return }
    controller?.view.removeFromSuperview()
    controller?.removeFromParent()
    controller = nil
    let root = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?
      .rootViewController
    guard let root else {
      model.failAll(NSError(domain: "CikletTranslate", code: 1, userInfo: [NSLocalizedDescriptionKey: "pencere yok"]))
      return
    }
    let hosting = UIHostingController(rootView: TranslationHostView(model: model))
    hosting.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
    hosting.view.backgroundColor = .clear
    hosting.view.isUserInteractionEnabled = false
    root.addChild(hosting)
    root.view.addSubview(hosting.view)
    hosting.didMove(toParent: root)
    controller = hosting
  }
}
#endif
