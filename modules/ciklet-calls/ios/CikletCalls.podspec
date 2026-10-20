Pod::Spec.new do |s|
  s.name           = 'CikletCalls'
  s.version        = '1.0.0'
  s.summary        = 'Ciklet CallKit + PushKit köprüsü'
  s.description    = 'Gelen/giden DM aramalarını sistemin arama arayüzüne (CallKit) bildirir, VoIP push alır.'
  s.license        = 'MIT'
  s.author         = 'Ciklet'
  s.homepage       = 'https://ciklet.xyz'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  # RTCAudioSession: CallKit'in etkinleştirdiği ses oturumu WebRTC'ye
  # (LiveKit) elle verilir. Sürüm livekit-react-native-webrtc'nin sabitlediği
  # sürüme çözülür; burada ayrıca sabitlenmez.
  s.dependency 'WebRTC-SDK'

  s.frameworks = 'CallKit', 'PushKit', 'AVFoundation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
