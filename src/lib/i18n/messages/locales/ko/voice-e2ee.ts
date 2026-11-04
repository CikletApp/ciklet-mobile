import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "종단 간 암호화됨",
    connecting: "암호화 설정 중…",
    mixed: "암호화되지 않은 참가자 있음",
    unsupported: "암호화되지 않은 연결",
  },
  title: "종단 간 암호화",
  body: {
    encrypted:
      "음성, 영상, 화면 공유는 이 통화에 참여한 사람들의 기기에서만 복호화돼요. Ciklet 서버를 포함해 그 누구도 내용을 볼 수 없어요.",
    connecting: "참가자들과 암호화 키를 교환하는 중이에요.",
    mixed:
      "일부 참가자가 종단 간 암호화를 지원하지 않는 버전을 사용 중이에요. 이들의 오디오는 암호화되지 않은 채 전송되며, 암호화된 참가자의 소리를 들을 수 없어요.",
    unsupported:
      "이 기기 또는 브라우저는 종단 간 암호화를 지원하지 않아요. 오디오가 암호화되지 않은 채 전송되며, 암호화된 참가자의 소리를 들을 수 없어요. Ciklet을 업데이트하거나 최신 Chrome, Edge, Firefox 또는 Safari를 사용하세요.",
  },
  code: {
    title: "음성 개인정보 보호 코드",
    help: "이 코드를 다른 참가자들과 비교해 보세요(예: 소리 내어 읽기). 모두 같은 코드가 보인다면 통화는 종단 간 암호화되어 있고 중간에서 엿듣는 사람이 없어요. 누군가 참가하거나 나가면 코드가 바뀌어요.",
    copy: "코드 복사",
    copied: "코드를 복사했어요",
    waiting: "키가 준비되면 코드가 표시돼요.",
  },
  unencrypted: {
    title: "암호화되지 않은 참가자",
    badge: "암호화되지 않은 참가자",
  },
  pending: "암호화 대기 중",
} satisfies Translation<typeof voiceE2eeTr>;
