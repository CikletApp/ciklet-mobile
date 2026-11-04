import { automod, streaming } from "./automod";
import { safety } from "./safety";
import { voiceE2ee } from "./voice-e2ee";
import { serverGuide } from "./server-guide";
import { serverTag } from "./server-tag";
import { serverRail } from "./server-rail";
import { serverBoost } from "./server-boost";
import { accountSwitcher } from "./account-switcher";
import { familyCenter } from "./family-center";
import { gameStats } from "./game-stats";
import { gameDetail } from "./game-detail";
import { compliance } from "./compliance";
import { quests } from "./quests";
import { settingsAccount } from "./settings-account";
import { settingsGeneral } from "./settings-general";
import { settingsMedia } from "./settings-media";
import { liveCaptions, translation } from "./live-language";
import { moreScreens } from "./more-screens";
import { parityScreens } from "./parity-screens";
import type { Messages } from "../../tr";
import type { Translation } from "../../translation";

/** ko sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "취소",
    save: "저장",
    close: "닫기",
    system: "시스템",
    on: "켜기",
    off: "끄기",
  },
  tabs: {
    chats: "채팅",
    servers: "서버",
    notifications: "알림",
    me: "나",
    unread: "{label}, 읽지 않음 {count}개",
  },
  messagePreview: {
    voice: "🎤 음성 메시지",
    voiceWithDuration: "🎤 음성 메시지 ({duration})",
    activity: "🎮 활동: {name}",
    activityUnnamed: "🎮 활동 초대",
    image: "📷 사진",
    video: "🎥 동영상",
    gif: "GIF",
    sticker: "스티커",
    clip: "🎬 클립",
    file: "📎 {name}",
    attachment: "📎 첨부 파일",
  },
  activity: {
    broadcast: {
      live: "라이브",
      game: "{game} 방송 중",
      liveOn: "{platform}에서 라이브 중",
      title: "라이브 방송",
      watch: "방송 보기",
    },
  },
  appCommands: {
    commands: "명령어",
    apps: "앱",
    optional: "선택",
    required: "필수",
    true: "참",
    false: "거짓",
    chooseFile: "파일 선택",
    loading: "불러오는 중…",
    noSuggestions: "제안 없음",
    timedOut: "앱이 제시간에 응답하지 않았어요",
    selectUser: "사용자 선택",
    selectRole: "역할 선택",
    selectChannel: "채널 선택",
    selectMentionable: "사용자 또는 역할 선택",
    enterValue: "값 입력",
    enterNumber: "숫자 입력",
    runFailed: "명령어를 실행하지 못했어요.",
  },
  messageComponents: {
    choose: "선택하세요",
    chooseOption: "선택지를 고르세요",
    search: "검색",
    noResults: "결과가 없어요",
    loading: "불러오는 중…",
    confirm: "선택",
    clear: "지우기",
    selectedCount: "{count}개 선택됨",
    selectRange: "{min}–{max}개 선택",
    unknown: "알 수 없음",
    botNoResponse: "{name}이(가) 응답하지 않았어요.",
    interactionFailed: "상호작용을 시작하지 못했어요.",
    formNoResponse: "봇이 양식에 응답하지 않았어요.",
    formFailed: "양식을 제출하지 못했어요.",
    formLabel: "봇 양식",
    submit: "제출",
    cancel: "취소",
    requiredMark: "필수",
    uploadFile: "파일 업로드",
    uploading: "업로드 중…",
    uploadFailed: "파일을 업로드하지 못했어요.",
    removeFile: "삭제",
    fileLimit: "최대 {max}개 파일",
    allowedTypes: "허용: {types}",
    fileTypeRejected: "이 파일 형식은 허용되지 않아요.",
    download: "다운로드",
    spoiler: "스포일러",
    show: "보기",
    openImage: "이미지 확대",
    attachment: "첨부 파일",
  },
  settings: {
    title: "설정",
    editProfile: "프로필 편집",
    sections: {
      account: "계정 설정",
      app: "앱 설정",
      support: "지원",
      session: "세션",
    },
    rows: {
      account: "계정",
      mentol: "Mentol",
      privacy: "개인정보, 데이터 및 소셜",
      friendRequests: "친구 요청",
      authorizedApps: "승인된 앱",
      voice: "음성 및 비디오",
      appearance: "디스플레이",
      chat: "채팅",
      notifications: "알림",
      activity: "활동 상태",
      help: "도움말",
      helpSubtitle: "지원, 피드백, 약관",
      scanLogin: "코드 스캔",
      scanLoginSubtitle: "휴대폰으로 데스크톱에 로그인",
    },
    scanLogin: {
      title: "코드 스캔",
      hint: "데스크톱 로그인 화면의 회전하는 고리를 화면에 맞추세요.",
      permissionTitle: "카메라 접근 권한 필요",
      permissionBody: "데스크톱의 코드를 읽으려면 카메라가 필요해요.",
      permissionAction: "허용",
      openSettings: "설정 열기",
      searching: "코드를 찾는 중…",
      checking: "코드를 확인하는 중…",
      gone: "코드가 만료되었어요. 데스크톱에서 코드가 새로 고쳐지면 다시 스캔하세요.",
      confirmTitle: "데스크톱에 로그인할까요?",
      confirmBody: "직접 시작한 것이 아니라면 거절하세요. 코드는 절대 공유하지 마세요.",
      device: "기기",
      location: "위치",
      ip: "IP 주소",
      time: "시간",
      justNow: "방금",
      approve: "네, 로그인할게요",
      reject: "아니요, 제가 아니에요",
      approved: "승인했어요. 데스크톱에 로그인하는 중이에요.",
      rejected: "거절했어요. 데스크톱 코드가 새로 고쳐져요.",
      failed: "승인을 보내지 못했어요. 다시 시도하세요.",
      unknownLocation: "알 수 없음",
    },
    logout: {
      action: "로그아웃",
      title: "로그아웃",
      message: "이 기기에서 로그아웃돼요.",
    },
    memberSince: "{date}부터 Ciklet 이용 중",
    appearance: {
      title: "디스플레이",
      motion: {
        title: "동작 줄이기",
        description:
          "전환 효과, 슬라이드 패널, 깜박이는 애니메이션을 줄여요. 시스템을 선택하면 휴대폰의 손쉬운 사용 설정을 따라요.",
      },
      language: {
        title: "언어",
        description: "인터페이스 언어예요. 번역이 진행 중이라 번역되지 않은 텍스트는 영어나 튀르키예어로 표시돼요.",
        system: "기기 언어({name})",
        restartRtl: "새 텍스트 방향을 적용하려면 앱을 닫았다가 다시 열어 주세요.",
      },
    },
    voice: {
      title: "음성 및 비디오",
      inputMode: "입력 모드",
      vad: "음성 감지",
      ptt: "눌러서 말하기",
      pttHint:
        "눌러서 말하기가 켜져 있으면 음성 채널에서 마이크가 음소거된 상태로 시작돼요. 말하려면 화면의 버튼을 누르고 있으세요.",
      noise: "소음 억제",
      noiseOff: "끄기",
      noiseStandard: "표준",
      noiseOffHint: "음성이 처리되지 않은 채로 전송돼요(악기, 스튜디오 마이크).",
      noiseStandardHint: "기기에 내장된 소음 억제예요.",
      noiseAdvancedNote: "고급 소음 억제(RNNoise)는 현재 웹과 데스크톱에서만 사용할 수 있어요.",
      inputVolume: "입력 음량",
      outputVolume: "출력 음량",
      deviceNote:
        "휴대폰이 입력 및 출력 기기를 자동으로 관리해요. 블루투스나 유선 기기는 시스템 오디오 패널에서 선택하세요.",
    },
    notifications: {
      title: "알림",
      permission: "알림 권한",
      master: "Ciklet 알림",
      masterDescription: "이 기기에서 알림을 허용해요.",
      permissionDenied: "시스템 설정에서 알림이 꺼져 있어요.",
      types: "알림 유형",
      messages: "메시지 및 멘션",
      calls: "수신 전화",
      friends: "친구 요청",
      sounds: "알림음",
      lockScreen: "잠금 화면 통화",
      fullScreenOff: "전체 화면 통화 권한이 꺼져 있어요",
      fullScreenBody:
        "앱이 닫혀 있을 때 잠금 화면에서 전체 화면으로 전화가 울리려면 Android에서 별도의 권한이 필요해요. 권한이 없으면 전화가 알림으로만 표시돼요.",
      openSettings: "설정 열기",
      overrides: "서버, 채널 및 채팅별 설정",
      overridesEmpty:
        "아직 개별 설정이 없어요. 서버, 채널 또는 채팅을 길게 누르고 알림을 선택해서 추가하세요.",
      reset: "기본값으로 초기화",
    },
  },
  automod: automod,
  safety: safety,
  voiceE2ee: voiceE2ee,
  streaming: streaming,
  serverGuide: serverGuide,
  serverTag: serverTag,
  serverRail: serverRail,
  serverBoost: serverBoost,
  /** Hesap değiştirici (web ile aynı anahtarlar) — account-switcher.en.ts. */
  accountSwitcher: accountSwitcher,
  /** Aile Merkezi (web ile aynı anahtarlar) — family-center.en.ts. */
  familyCenter: familyCenter,
  gameStats: gameStats,
  gameDetail: gameDetail,
  compliance: compliance,
  quests: quests,
  settingsAccount: settingsAccount,
  settingsGeneral: settingsGeneral,
  settingsMedia: settingsMedia,
  translation: translation,
  liveCaptions: liveCaptions,
  moreScreens: moreScreens,
  parityScreens: parityScreens,
} satisfies Translation<Messages>;
