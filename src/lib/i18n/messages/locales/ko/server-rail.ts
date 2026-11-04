import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** ko — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "서버",
  home: "다이렉트 메시지",
  addServer: "서버 추가",
  discover: "서버 탐색",
  download: "앱 다운로드",
  newActivity: "#{channel}에 새 활동",
  voiceCount: "음성 채널에 {count}명",
  unread: "읽지 않음 {count}",
  keyboardHint: "Alt+Shift+위/아래로 이동",
  folder: {
    defaultName: "서버 폴더",
    aria: "{name} 폴더, 서버 {count}개",
    markRead: "폴더를 읽음으로 표시",
    moveTo: "이동:",
    settings: "폴더 설정",
    closeAll: "모든 폴더 닫기",
  },
  move: {
    top: "맨 위로",
    up: "한 칸 위로",
    down: "한 칸 아래로",
    bottom: "맨 아래로",
  },
  server: {
    markRead: "읽음으로 표시",
    removeFromFolder: "폴더에서 제거",
    addToFolder: "폴더에 추가: {name}",
  },
  settings: {
    title: "폴더 설정",
    name: "폴더 이름",
    color: "폴더 색상",
    customColor: "사용자 지정 색상",
    done: "완료",
  },
  toast: {
    saveFailed: "서버 순서를 저장하지 못해 이전 배치로 되돌렸습니다.",
    folderSaveFailed: "폴더 설정을 저장하지 못했습니다.",
  },
} satisfies Translation<typeof serverRailTr>;
