// Ciklet ekran paylaşımı — ReplayKit Broadcast Upload Extension.
//
// Jitsi Meet SDK örneğinden (Apache-2.0) uyarlandı; react-native-webrtc'nin
// iOS ekran yakalayıcısı (ScreenCapturer.m) aynı protokolü bekler: ana
// uygulama App Group kapsayıcısında "rtc_SSFD" adlı Unix soketini açar,
// bu eklenti kareleri JPEG olarak HTTP benzeri çerçevelerle oraya yazar.
// App Group kimliği eklentinin Info.plist'inde (RTCAppGroupIdentifier).

import ReplayKit

private enum Constants {
  static let socketFileName = "rtc_SSFD"
  static let appGroupKey = "RTCAppGroupIdentifier"
  /// Ana uygulama soketi kapatınca kullanıcıya gösterilen hata kodu.
  static let stoppedErrorCode = 10001
}

class SampleHandler: RPBroadcastSampleHandler {
  private var clientConnection: SocketConnection?
  private var uploader: SampleUploader?
  private var frameCount = 0

  private var socketFilePath: String {
    guard
      let group = Bundle.main.object(forInfoDictionaryKey: Constants.appGroupKey) as? String,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { return "" }
    return container.appendingPathComponent(Constants.socketFileName).path
  }

  override init() {
    super.init()
    if let connection = SocketConnection(filePath: socketFilePath) {
      clientConnection = connection
      setupConnection()
      uploader = SampleUploader(connection: connection)
    }
  }

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    frameCount = 0
    DarwinNotificationCenter.shared.postNotification(.broadcastStarted)
    openConnection()
  }

  override func broadcastPaused() {}

  override func broadcastResumed() {}

  override func broadcastFinished() {
    DarwinNotificationCenter.shared.postNotification(.broadcastStopped)
    clientConnection?.close()
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    switch sampleBufferType {
    case .video:
      // Her üç kareden biri (~20 fps): eklentinin 50 MB bellek sınırı
      // ve JPEG kodlama maliyeti için yeterli akıcılık.
      frameCount += 1
      if frameCount % 3 == 0 {
        uploader?.send(sample: sampleBuffer)
      }
    default:
      break
    }
  }
}

private extension SampleHandler {
  func setupConnection() {
    clientConnection?.didClose = { [weak self] error in
      if let error = error {
        self?.finishBroadcastWithError(error)
      } else {
        let stopped = NSError(
          domain: RPRecordingErrorDomain,
          code: Constants.stoppedErrorCode,
          userInfo: [NSLocalizedDescriptionKey: "Ekran paylaşımı durduruldu."]
        )
        self?.finishBroadcastWithError(stopped)
      }
    }
  }

  func openConnection() {
    let queue = DispatchQueue(label: "ciklet.broadcast.connectTimer")
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
    timer.setEventHandler { [weak self] in
      guard self?.clientConnection?.open() == true else { return }
      timer.cancel()
    }
    timer.resume()
  }
}
