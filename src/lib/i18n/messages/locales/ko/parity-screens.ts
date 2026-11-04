import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** ko — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "폴더 만들기",
    settingsTitle: "폴더 설정",
    nameLabel: "폴더 이름",
    defaultName: "서버 폴더",
    colorLabel: "폴더 색상",
    currentColor: "선택한 색상",
    customColor: "사용자 지정 색상",
    pickServers: "서버",
    pickHint: "폴더에 넣을 서버를 두 개 이상 선택하세요.",
    inFolder: "폴더의 서버 ({count})",
    removeServer: "{name}을(를) 폴더에서 빼기",
    removeHint: "서버가 하나만 남으면 폴더가 삭제됩니다.",
    addServers: "서버 추가",
    addServer: "{name}을(를) 폴더에 추가",
    create: "폴더 만들기",
    done: "완료",
    createFailed: "폴더를 만들지 못했어요",
    saveFailed: "폴더를 저장하지 못했어요",
    removeFailed: "서버를 폴더에서 빼지 못했어요",
    addFailed: "서버를 폴더에 추가하지 못했어요",
    newFolder: "폴더 만들기",
    openSettings: "{name} 폴더 설정",
  },
  channelInvites: {
    title: "초대",
    subtitle: "이 채널로 연결되는 초대 링크",
    intro: "#{channel} 채널 초대 링크입니다. 참가한 사람은 바로 이 채널로 이동해요.",
  },
} satisfies Translation<typeof parityScreensTr>;
