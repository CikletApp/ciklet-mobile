/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "타임아웃 없음",
    s60: "60초",
    m5: "5분",
    m10: "10분",
    h1: "1시간",
    d1: "1일",
    w1: "1주",
  },
  settings: {
    words: {
      title: "AutoMod — 금지어",
      description: "쉼표나 줄바꿈으로 구분하세요. 단어 전체가 일치해야 하며, 끝에 *를 붙이면 접두어로 일치해요. 철자 꼼수도 잡아내요(글자 반복, 숫자/기호, 구분자). 일치하는 메시지는 보낼 수 없어요(게이트웨이를 통해 들어오면 삭제돼요). 최대 {max}개 단어.",
      placeholder: "단어1, 단어2, 접두어*",
      count: "단어 {count}개",
    },
    mentions: {
      title: "AutoMod — 멘션 스팸",
      description: "한 메시지에서 이보다 많은 서로 다른 사람이나 역할을 태그하면 차단해요. 비워 두면 꺼져요(최대 {max}).",
      off: "끄기",
    },
    linkFilter: {
      title: "AutoMod — 링크 필터",
      description: "켜져 있으면 아래 도메인(및 하위 도메인)으로의 링크만 허용돼요. 첨부 파일은 항상 허용돼요. 최대 {max}개 도메인.",
      emptyWarning: "허용된 도메인이 없어요: 모든 링크가 차단돼요.",
    },
    actionsSection: {
      title: "AutoMod — 조치",
      description: "규칙을 어긴 메시지는 항상 차단돼요. 선택적으로 작성자에게 타임아웃을 적용하고, 이벤트를 모더레이션 채널과 메시지가 있던 채널에 게시할 수 있어요.",
      timeout: "타임아웃",
      alertChannel: "모더레이션 채널",
      noAlert: "알림 없음",
    },
    preset: {
      title: "AutoMod — 튀르키예어 욕설 필터",
      description: "미리 준비된 포괄적인 튀르키예어 욕설 및 모욕 목록이에요. 철자 꼼수(글자 반복, 4→a, 1→ı, 0→o, $→s, 점이나 공백으로 나누기)도 잡아내며, \"sıkıntı\", \"amaç\", \"piknik\" 같은 무해한 단어는 건드리지 않아요.",
      enable: "클릭 한 번으로 켜기",
      enabled: "켜기",
      allowTitle: "허용된 단어",
      allowDescription: "절대 걸리면 안 되는 단어예요(쉼표나 줄바꿈으로 구분, 접두어는 끝에 *). 프리셋과 금지어 목록 모두에 적용돼요.",
      allowPlaceholder: "amina, 단어*",
    },
    spam: {
      title: "AutoMod — 스팸 감지",
      description: "짧은 시간에 많은 메시지를 보내거나 같은 내용을 반복하는 멤버의 메시지를 차단해요.",
      maxMessages: "최대 메시지 수",
      window: "시간 범위(초)",
      duplicates: "같은 메시지 반복 횟수(60초)",
    },
    caps: {
      title: "AutoMod — 과도한 대문자",
      description: "글자 중 대문자 비율이 지정한 값을 넘는 메시지를 차단해요(짧은 메시지 제외).",
      percent: "대문자 비율(%)",
      minLetters: "최소 글자 수",
    },
    links: {
      inviteTitle: "초대 링크 차단",
      inviteDescription: "Ciklet 및 Discord 서버 초대 링크를 공유할 수 없어요.",
      blockedTitle: "차단된 도메인",
      blockedDescription: "링크 필터가 꺼져 있어도 이 도메인(및 하위 도메인)으로의 링크는 차단돼요.",
    },
    profile: {
      title: "AutoMod — 사용자 이름 및 프로필 필터",
      description: "표시 이름, 사용자 이름, 서버 별명, 소개는 금지어 목록과 (켜져 있다면) 욕설 필터를 통과해야 해요. 통과하지 못한 멤버는 수정할 때까지 메시지를 보낼 수 없으며, 그런 별명과 서버 소개는 저장되지 않아요.",
    },
    actions: {
      warnTitle: "채널에 경고 줄 표시",
      warnDescription: "차단된 메시지의 채널에 짧은 AutoMod 알림이 게시돼요(내용은 표시되지 않아요).",
      blockMessageTitle: "보낸 사람에게 표시할 메시지",
      blockMessageDescription: "비워 두면 규칙 자체의 설명이 표시돼요.",
      blockMessagePlaceholder: "이 메시지는 서버 규칙을 위반해요.",
    },
    exempt: {
      title: "AutoMod — 예외",
      description: "메시지 관리 권한이 있는 멤버는 항상 예외예요. 이 역할과 채널(스레드 포함)도 검사하지 않아요.",
      roles: "예외 역할",
      channels: "예외 채널",
      none: "선택 안 함",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "라이브",
  settings: {
    hint: "계정을 연결하면 방송 중일 때 프로필에 \"라이브\"가 표시돼요",
    broadcaster: "방송인 권한",
    broadcasterHint: "연동 역할이 구독자 정보를 읽을 수 있게 해요",
    grantBroadcaster: "방송인으로 연결",
    connect: "연결",
    reconnect: "다시 연결",
    disconnect: "삭제",
    disconnected: "{platform} 연결을 제거했어요.",
    disconnectFailed: "{platform} 연결을 제거하지 못했어요.",
    liveNow: "지금 라이브 중",
  },
  linkedRoles: {
    title: "연동 역할",
    description: "역할을 내 Twitch 또는 Kick 채널 구독과 연결하세요. 멤버가 계정을 연결하면 조건을 충족할 경우 역할이 자동으로 부여되고, 구독이 끝나면 제거돼요(30분마다 재확인). 서버 소유자만 자신의 채널에 대해 설정할 수 있어요.",
    ownerOnly: "서버 소유자만 연동 역할을 관리할 수 있어요.",
    role: "역할",
    platform: "플랫폼",
    requirement: "조건",
    subscriber: "내 채널 구독 중",
    follower: "내 채널 팔로우 중",
    followerTwitchOnly: "팔로워 조건은 Twitch 전용이에요(Kick은 팔로우 취소를 알려 주지 않아요).",
    add: "연결",
    remove: "삭제",
    empty: "아직 연동 역할이 없어요.",
    loading: "불러오는 중…",
    needsBroadcaster: "먼저 설정 → 프로필 → 연결에서 \"방송인으로 연결\"로 {platform} 계정을 연결하세요.",
    created: "연동 역할을 만들었어요.",
    createFailed: "연동 역할을 만들지 못했어요.",
    removeFailed: "연동 역할을 제거하지 못했어요.",
    granted: "멤버 {count}명",
    lastSynced: "마지막 확인: {time}",
    selectRole: "역할 선택",
  },

} satisfies Translation<typeof streamingTr>;
