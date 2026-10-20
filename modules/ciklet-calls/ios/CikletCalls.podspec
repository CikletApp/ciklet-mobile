Pod::Spec.new do |s|
  s.name           = 'CikletCalls'
  s.version        = '1.0.0'
  s.summary        = 'Ciklet görüşme yardımcıları (iOS: yakınlık sensörü).'
  s.description    = 'Sesli görüşmede ahize kullanılırken yakınlık sensörüyle ekranı karartır.'
  s.license        = 'MIT'
  s.author         = 'Ciklet'
  s.homepage       = 'https://ciklet.xyz'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
