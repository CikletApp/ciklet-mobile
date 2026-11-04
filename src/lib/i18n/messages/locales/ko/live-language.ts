import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "번역",
    translating: "번역 중…",
    unsupported: "이 브라우저에서는 번역을 지원하지 않아요",
    unsupportedDevice: "이 기기에서는 번역을 지원하지 않아요",
    remove: "번역 제거",
  },
  footer: {
    translatedFrom: "{language}에서 번역됨",
    showOriginal: "원문 보기",
    showTranslation: "번역 보기",
    dismiss: "번역 닫기",
    translating: "번역 중…",
    downloading: "언어 모델을 기기에 다운로드하는 중… {percent}%",
  },
  errors: {
    same: "이 메시지는 이미 {language}로 되어 있어요.",
    unavailable: "이 언어 조합에서는 기기 내 번역을 사용할 수 없어요.",
    undetected: "메시지의 언어를 감지하지 못했어요.",
    empty: "번역할 텍스트가 없어요.",
    failed: "번역하지 못했어요.",
  },
  settings: {
    title: "번역 대상 언어",
    description: "'번역'은 메시지를 이 언어로 번역해요. 번역은 기기에서 이루어지며 메시지 내용은 Ciklet 서버로 전송되지 않아요.",
    auto: "인터페이스 언어({language})",
    unsupported: "이 브라우저는 기기 내 번역을 지원하지 않아요. 최신 버전의 Chrome이나 Edge를 사용하세요.",
    unsupportedDevice: "이 기기는 기기 내 번역을 지원하지 않아요.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "자막",
  title: "실시간 자막",
  publish: {
    label: "내 음성을 자막으로",
    description: "내 음성은 기기에서 텍스트로 변환되어 이 통화의 참여자에게만 전송돼요. 오디오는 녹음되지 않아요.",
  },
  show: {
    label: "자막 표시",
    description: "자막을 켠 참여자의 음성이 화면 하단에 표시돼요.",
  },
  language: "음성 언어",
  languageAuto: "인터페이스 언어",
  indicator: "자막 켜짐",
  indicatorHelp: "이 사람은 자신의 음성을 자막으로 송출하고 있어요.",
  status: {
    listening: "듣는 중…",
    muted: "마이크가 꺼져 있어요 — 자막이 일시 중지되었어요.",
    unsupported: "이 기기에서는 음성 인식을 지원하지 않아요.",
    denied: "마이크 또는 음성 인식 권한이 허용되지 않았어요.",
    e2eeBlocked: "이 기기는 종단 간 암호화 통화에서 자막을 암호화할 수 없어 자막 송출이 꺼져 있어요.",
    e2ee: "자막은 종단 간 암호화되어 전송돼요.",
    cloud: "브라우저가 음성 인식을 위해 자체 음성 서비스를 사용할 수 있어요. 오디오는 Ciklet 서버로 전송되지 않아요.",
    onDevice: "음성 인식은 기기에서 실행돼요.",
    error: "음성 인식이 중지되었어요.",
  },
  empty: "아직 자막이 없어요.",
} satisfies Translation<typeof liveCaptionsTr>;
