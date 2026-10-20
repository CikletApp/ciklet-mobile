import AVFoundation
import CallKit
import Foundation
import PushKit
import UIKit
import WebRTC

/**
 * iOS'ta DM aramalarının sistem tarafı: PushKit (VoIP push) + CallKit.
 *
 * NEDEN YERELDE: Uygulama kapalıyken VoIP push süreci arka planda başlatır
 * ve Apple, push işleyicisi bitmeden `reportNewIncomingCall` çağrılmasını
 * şart koşar (çağrılmazsa süreç sonlandırılır, tekrarında VoIP push'lar
 * kesilir). JS o anda henüz yüklenmemiş olabilir; bu yüzden çağrı burada,
 * push'un yükünden bildirilir. JS sonra `takePendingEvents` ile durumu alır.
 *
 * Bütün durum ana kuyrukta: PKPushRegistry `.main` ile, CXProvider kuyruksuz
 * (ana kuyruk) kurulur; modül işlevleri de ana kuyruğa geçer.
 *
 * SES: CallKit ses oturumunu kendisi etkinleştirir. WebRTC'nin ses birimi
 * çağrı süresince `useManualAudio` ile kapalı tutulur, `didActivate`'te
 * açılır (WebRTC'nin CallKit örneğindeki sıra). Görüşme yokken (sesli
 * kanallar) WebRTC her zamanki gibi kendi kendine çalışır.
 */
final class CikletCallController: NSObject {
  static let shared = CikletCallController()

  // MARK: Kayıtlar

  final class CallRecord {
    let key: String
    let uuid: UUID
    let incoming: Bool
    var info: [String: Any]
    var answered = false
    var connected = false
    var muted = false
    var expiryTimer: Timer?

    init(key: String, uuid: UUID, incoming: Bool, info: [String: Any]) {
      self.key = key
      self.uuid = uuid
      self.incoming = incoming
      self.info = info
    }

    var declineUrl: String? {
      let value = info["declineUrl"] as? String
      return (value?.isEmpty ?? true) ? nil : value
    }

    var video: Bool { (info["callType"] as? String) == "video" || (info["video"] as? Bool) == true }
  }

  private lazy var provider: CXProvider = {
    let config = CXProviderConfiguration()
    config.supportsVideo = true
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    // Son aramalar listesinden geri arama (INStartCallIntent) henüz
    // karşılanmıyor; oraya düşmesin.
    config.includesCallsInRecents = false
    // expo-notifications eklentisi assets/sounds'u ana pakete kopyalıyor.
    if Bundle.main.url(forResource: "ringtone", withExtension: "wav") != nil {
      config.ringtoneSound = "ringtone.wav"
    }
    let provider = CXProvider(configuration: config)
    provider.setDelegate(self, queue: nil)
    return provider
  }()

  private let callController = CXCallController()
  private var registry: PKPushRegistry?

  private(set) var voipToken: String?
  private var calls: [String: CallRecord] = [:]
  /** Biten çağrılar (10 dk): geç gelen push ya da JS onları yeniden çaldırmasın. */
  private var finished: [String: Date] = [:]
  /** Uygulamanın kendi istediği eylemler — JS'e geri yankılanmaz. */
  private var appEnded: Set<UUID> = []
  private var appAnswered: Set<UUID> = []
  private var appMuted: Set<UUID> = []

  /** JS dinliyor mu (takePendingEvents çağrıldı, modül yaşıyor). */
  private var listening = false
  private var pending: [(name: String, body: [String: Any])] = []
  var emitter: ((String, [String: Any]) -> Void)?

  // MARK: Başlatma

  /** AppDelegate `didFinishLaunching`'den: VoIP push'u süreç açılır açılmaz karşılamak için. */
  func startPushRegistry() {
    onMain {
      guard self.registry == nil else { return }
      _ = self.provider
      let registry = PKPushRegistry(queue: .main)
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
      self.registry = registry
      if let data = registry.pushToken(for: .voIP) {
        self.voipToken = Self.hex(data)
      }
    }
  }

  // MARK: JS köprüsü

  func attach(emitter: @escaping (String, [String: Any]) -> Void) {
    self.emitter = emitter
  }

  func detach() {
    emitter = nil
    listening = false
  }

  /** JS dinleyicileri kuruldu: birikmiş olayları ver, sonrakileri doğrudan gönder. */
  func takePendingEvents() -> [[String: Any]] {
    listening = true
    let out = pending.map { ["name": $0.name, "body": $0.body] as [String: Any] }
    pending.removeAll()
    return out
  }

  func stopListening() {
    listening = false
  }

  private func emit(_ name: String, _ body: [String: Any]) {
    if listening, let emitter = emitter {
      emitter(name, body)
    } else {
      pending.append((name, body))
      if pending.count > 50 { pending.removeFirst(pending.count - 50) }
    }
  }

  // MARK: Gelen arama

  /**
   * Gelen aramayı CallKit'e bildirir. Aynı `callId` ikinci kez (push + ağ
   * geçidi) gelirse yalnızca tamamlanır. `fromPush`: JS'e haber verilir
   * (JS yoksa kuyruğa girer); JS'in kendi bildirimi geri yankılanmaz.
   */
  func reportIncoming(info: [String: Any], fromPush: Bool, completion: (() -> Void)? = nil) {
    pruneFinished()
    guard let callId = info["callId"] as? String, !callId.isEmpty else {
      reportPlaceholderAndEnd(completion: completion)
      return
    }
    if calls[callId] != nil {
      completion?()
      return
    }
    if finished[callId] != nil {
      // Bu çağrı burada zaten bitti (reddedildi / iptal geldi). Push'tan
      // geldiyse Apple kuralı gereği yine bildirilip hemen kapatılır.
      if fromPush {
        reportPlaceholderAndEnd(completion: completion)
      } else {
        completion?()
      }
      return
    }

    let uuid = UUID(uuidString: callId) ?? UUID()
    let record = CallRecord(key: callId, uuid: uuid, incoming: true, info: info)
    calls[callId] = record
    prepareManualAudio()

    let update = CXCallUpdate()
    let callerId = (info["callerId"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? callId
    update.remoteHandle = CXHandle(type: .generic, value: callerId)
    update.localizedCallerName = Self.callerName(info)
    update.hasVideo = record.video
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false

    provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
      guard let self = self else {
        completion?()
        return
      }
      if let error = error {
        // Rahatsız Etmeyin / engellenen arayan / zaten çağrıda: sistem
        // çağrıyı kabul etmedi. Kayıt düşer; JS uygulama içi zile döner.
        NSLog("[CikletCalls] reportNewIncomingCall failed: \(error.localizedDescription)")
        self.calls.removeValue(forKey: callId)
        self.releaseManualAudioIfIdle()
        self.emit("onCallAction", ["action": "rejected", "callId": callId])
      } else {
        self.scheduleExpiry(record)
      }
      completion?()
    }

    if fromPush {
      emit("onIncomingCall", Self.jsInfo(info))
    }
  }

  /**
   * Push'un ait olduğu çağrı yok/bitmiş: kural gereği bir çağrı bildirilip
   * aynı anda kapatılır (ekranda en fazla bir an görünür).
   */
  private func reportPlaceholderAndEnd(completion: (() -> Void)?) {
    let uuid = UUID()
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: "ciklet")
    update.localizedCallerName = "Ciklet"
    update.hasVideo = false
    provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] _ in
      self?.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      completion?()
    }
  }

  private func scheduleExpiry(_ record: CallRecord) {
    record.expiryTimer?.invalidate()
    guard let expiresAt = Self.number(record.info["expiresAt"]) else { return }
    let delay = expiresAt / 1000 - Date().timeIntervalSince1970
    let interval = max(1, min(delay, 120))
    record.expiryTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
      guard let self = self, let current = self.calls[record.key], current === record, !record.answered else { return }
      self.provider.reportCall(with: record.uuid, endedAt: Date(), reason: .unanswered)
      self.finish(record)
      self.emit("onCallAction", ["action": "ended", "callId": record.key])
    }
  }

  /** Sunucunun "çağrı bitti" push'u (iptal, başka cihazda yanıt). */
  private func handleEndedPush(_ payload: [String: Any], completion: @escaping () -> Void) {
    let callId = payload["callId"] as? String ?? ""
    if let record = calls[callId] {
      if !record.answered {
        let reason: CXCallEndedReason
        switch payload["reason"] as? String {
        case "accepted": reason = .answeredElsewhere
        case "denied": reason = .declinedElsewhere
        default: reason = .remoteEnded
        }
        provider.reportCall(with: record.uuid, endedAt: Date(), reason: reason)
        finish(record)
        emit("onCallAction", ["action": "ended", "callId": callId])
      }
      // Bu cihazda açılmış görüşme: kendi kabulümüzün yankısı, dokunulmaz.
      completion()
      return
    }
    if !callId.isEmpty { finished[callId] = Date() }
    reportPlaceholderAndEnd(completion: completion)
  }

  // MARK: Giden arama ve durum

  func startOutgoing(key: String, name: String, video: Bool) {
    guard calls[key] == nil else { return }
    let record = CallRecord(key: key, uuid: UUID(), incoming: false, info: ["callerName": name, "video": video])
    calls[key] = record
    prepareManualAudio()
    let handle = CXHandle(type: .generic, value: name.isEmpty ? "Ciklet" : name)
    let action = CXStartCallAction(call: record.uuid, handle: handle)
    action.isVideo = video
    action.contactIdentifier = name
    callController.request(CXTransaction(action: action)) { [weak self] error in
      guard let self = self, let error = error else { return }
      onMain {
        NSLog("[CikletCalls] start call failed: \(error.localizedDescription)")
        if self.calls[key] === record { self.finish(record) }
      }
    }
  }

  /** Görüşme bağlandı: giden aramada "bağlandı", uygulamadan kabulde CallKit'e kabul. */
  func reportConnected(key: String) {
    guard let record = calls[key], !record.connected else { return }
    record.connected = true
    record.expiryTimer?.invalidate()
    if record.incoming {
      guard !record.answered else { return }
      record.answered = true
      appAnswered.insert(record.uuid)
      callController.request(CXTransaction(action: CXAnswerCallAction(call: record.uuid))) { [weak self] error in
        guard let error = error else { return }
        onMain {
          NSLog("[CikletCalls] answer failed: \(error.localizedDescription)")
          self?.appAnswered.remove(record.uuid)
        }
      }
    } else {
      provider.reportOutgoingCall(with: record.uuid, connectedAt: Date())
    }
  }

  /**
   * JS çağrıyı bitirdi. `local`: kullanıcı kapattı/reddetti (CXEndCallAction);
   * diğerleri karşı taraftan/başka cihazdan gelen bitişi sisteme bildirir.
   */
  func endCall(key: String, reason: String) {
    guard let record = calls[key] else {
      finished[key] = Date()
      return
    }
    switch reason {
    case "local":
      appEnded.insert(record.uuid)
      callController.request(CXTransaction(action: CXEndCallAction(call: record.uuid))) { [weak self] error in
        guard let error = error else { return }
        onMain {
          guard let self = self else { return }
          NSLog("[CikletCalls] end call failed: \(error.localizedDescription)")
          self.appEnded.remove(record.uuid)
          self.provider.reportCall(with: record.uuid, endedAt: Date(), reason: .remoteEnded)
          if self.calls[key] === record { self.finish(record) }
        }
      }
    default:
      let ended: CXCallEndedReason
      switch reason {
      case "elsewhere": ended = .answeredElsewhere
      case "declined-elsewhere": ended = .declinedElsewhere
      case "unanswered": ended = .unanswered
      case "failed": ended = .failed
      default: ended = .remoteEnded
      }
      provider.reportCall(with: record.uuid, endedAt: Date(), reason: ended)
      finish(record)
    }
  }

  func setMuted(key: String, muted: Bool) {
    guard let record = calls[key], record.muted != muted else { return }
    record.muted = muted
    appMuted.insert(record.uuid)
    callController.request(CXTransaction(action: CXSetMutedCallAction(call: record.uuid, muted: muted))) { [weak self] error in
      guard error != nil else { return }
      onMain { _ = self?.appMuted.remove(record.uuid) }
    }
  }

  func activeCalls() -> [[String: Any]] {
    calls.values.map { record in
      var out = Self.jsInfo(record.info)
      out["key"] = record.key
      out["incoming"] = record.incoming
      out["answered"] = record.answered
      out["connected"] = record.connected
      return out
    }
  }

  // MARK: Yardımcılar

  private func record(for uuid: UUID) -> CallRecord? {
    calls.values.first { $0.uuid == uuid }
  }

  private func finish(_ record: CallRecord) {
    record.expiryTimer?.invalidate()
    record.expiryTimer = nil
    calls.removeValue(forKey: record.key)
    finished[record.key] = Date()
    appAnswered.remove(record.uuid)
    appMuted.remove(record.uuid)
    releaseManualAudioIfIdle()
  }

  private func pruneFinished() {
    let limit = Date().addingTimeInterval(-600)
    finished = finished.filter { $0.value > limit }
  }

  /** CallKit ses oturumunu verene dek WebRTC ses birimini başlatmasın. */
  private func prepareManualAudio() {
    let rtc = RTCAudioSession.sharedInstance()
    // Sesli kanalda (CallKit dışı oturum açık) ses birimi kesilmesin; CallKit
    // oturumu devralınca didActivate yine WebRTC'ye bildirilir.
    if !rtc.useManualAudio && !rtc.isActive {
      rtc.useManualAudio = true
      rtc.isAudioEnabled = false
    }
  }

  private func releaseManualAudioIfIdle() {
    guard calls.isEmpty else { return }
    let rtc = RTCAudioSession.sharedInstance()
    rtc.useManualAudio = false
    rtc.isAudioEnabled = true
  }

  /** Kabul/başlatma anında kategori — etkinleştirmeyi CallKit yapar. */
  private func configureAudioCategory(video: Bool) {
    let session = AVAudioSession.sharedInstance()
    #if swift(>=6.2)
    let options: AVAudioSession.CategoryOptions = [.allowBluetoothHFP, .allowBluetoothA2DP]
    #else
    let options: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP]
    #endif
    do {
      try session.setCategory(.playAndRecord, mode: video ? .videoChat : .voiceChat, options: options)
    } catch {
      NSLog("[CikletCalls] audio category failed: \(error.localizedDescription)")
    }
  }

  /** Süreç ölüyken "Reddet": push'un tek kullanımlık adresine POST. */
  private func postDecline(_ urlString: String) {
    guard let url = URL(string: urlString), url.scheme == "https" || url.scheme == "http" else { return }
    var request = URLRequest(url: url, timeoutInterval: 8)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var body: [String: Any] = [:]
    // Sunucu "başka yerde yanıtlandı" push'unu bu cihaza atlamasın diye.
    if let token = voipToken { body["voipToken"] = token }
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    var task: UIBackgroundTaskIdentifier = .invalid
    task = UIApplication.shared.beginBackgroundTask(withName: "ciklet-call-decline") {
      UIApplication.shared.endBackgroundTask(task)
      task = .invalid
    }
    URLSession.shared.dataTask(with: request) { _, response, error in
      if let error = error {
        NSLog("[CikletCalls] decline url failed: \(error.localizedDescription)")
      } else if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
        NSLog("[CikletCalls] decline url responded \(http.statusCode)")
      }
      onMain {
        if task != .invalid {
          UIApplication.shared.endBackgroundTask(task)
          task = .invalid
        }
      }
    }.resume()
  }

  static func hex(_ data: Data) -> String {
    data.map { String(format: "%02x", $0) }.joined()
  }

  static func number(_ value: Any?) -> Double? {
    if let n = value as? NSNumber { return n.doubleValue }
    if let s = value as? String { return Double(s) }
    return nil
  }

  static func callerName(_ info: [String: Any]) -> String {
    let name = (info["callerName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return name.isEmpty ? "Ciklet" : name
  }

  /** JS'e giden biçim (index.ts NativeIncomingCall). */
  static func jsInfo(_ info: [String: Any]) -> [String: Any] {
    var out: [String: Any] = [:]
    for key in ["callId", "callerId", "callerName", "callerAvatar", "callType", "directId", "declineUrl"] {
      if let value = info[key] as? String { out[key] = value }
    }
    if let expires = number(info["expiresAt"]) { out["expiresAt"] = expires }
    return out
  }
}

// MARK: - PushKit

extension CikletCallController: PKPushRegistryDelegate {
  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else { return }
    let token = Self.hex(pushCredentials.token)
    guard token != voipToken else { return }
    voipToken = token
    emit("onVoipToken", ["token": token])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else { return }
    voipToken = nil
    emit("onVoipToken", ["token": NSNull()])
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    var data: [String: Any] = [:]
    for (key, value) in payload.dictionaryPayload {
      if let key = key as? String, key != "aps" { data[key] = value }
    }
    let kind = (data["type"] as? String)?.lowercased() ?? "call"
    if kind == "call.ended" || kind == "call_ended" {
      handleEndedPush(data, completion: completion)
    } else {
      reportIncoming(info: data, fromPush: true, completion: completion)
    }
  }
}

// MARK: - CallKit

extension CikletCallController: CXProviderDelegate {
  func providerDidReset(_ provider: CXProvider) {
    for record in Array(calls.values) {
      finish(record)
      emit("onCallAction", ["action": record.answered || !record.incoming ? "hangup" : "ended", "callId": record.key])
    }
    appEnded.removeAll()
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    if let record = record(for: action.callUUID) {
      configureAudioCategory(video: record.video)
    }
    action.fulfill()
    provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard let record = record(for: action.callUUID) else {
      action.fail()
      return
    }
    record.answered = true
    record.expiryTimer?.invalidate()
    configureAudioCategory(video: record.video)
    action.fulfill()
    if appAnswered.remove(action.callUUID) == nil {
      var body = Self.jsInfo(record.info)
      body["action"] = "accept"
      body["callId"] = record.key
      emit("onCallAction", body)
    }
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    guard let record = record(for: action.callUUID) else {
      appEnded.remove(action.callUUID)
      action.fulfill()
      return
    }
    let byApp = appEnded.remove(action.callUUID) != nil
    let ringing = record.incoming && !record.answered
    finish(record)
    action.fulfill()
    guard !byApp else { return }

    if ringing {
      // Reddet. Tek kullanımlık adres varsa ret buradan gider (JS ölü de
      // olabilir; oturum çerezi yalnızca JS'te) — JS yalnızca yerelde kapatır.
      if let url = record.declineUrl {
        postDecline(url)
        emit("onCallAction", ["action": "decline", "callId": record.key, "handled": true])
      } else {
        emit("onCallAction", ["action": "decline", "callId": record.key, "handled": false])
      }
    } else {
      emit("onCallAction", ["action": "hangup", "callId": record.key])
    }
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    action.fulfill()
    guard let record = record(for: action.callUUID) else { return }
    record.muted = action.isMuted
    if appMuted.remove(action.callUUID) == nil {
      emit("onCallAction", ["action": action.isMuted ? "mute" : "unmute", "callId": record.key])
    }
  }

  func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
    // Bekletme desteklenmiyor (supportsHolding = false); başka bir arama
    // gelince sistem yine de isteyebilir.
    action.fail()
  }

  func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) {
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    let rtc = RTCAudioSession.sharedInstance()
    rtc.audioSessionDidActivate(audioSession)
    rtc.isAudioEnabled = true
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    let rtc = RTCAudioSession.sharedInstance()
    rtc.audioSessionDidDeactivate(audioSession)
    rtc.isAudioEnabled = false
    releaseManualAudioIfIdle()
  }
}

func onMain(_ block: @escaping () -> Void) {
  if Thread.isMainThread {
    block()
  } else {
    DispatchQueue.main.async(execute: block)
  }
}
