import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "{server} 서버 태그",
    generic: "서버 태그",
  },
  settings: {
    title: "서버 태그",
    description: "멤버가 이름 옆에 이 태그를 표시할 수 있어요. 2–4자의 문자나 숫자와 이모지 배지를 골라 주세요.",
    tagLabel: "태그",
    tagPlaceholder: "TAG",
    tagHint: "2–4자의 문자 또는 숫자",
    badgeLabel: "배지",
    badgeHint: "이모지 하나",
    badgeClear: "배지 제거",
    badgePick: "이모지 선택",
    preview: "미리 보기",
    previewName: "사용자",
    enabledLabel: "멤버가 태그를 사용하도록 허용",
    enabledDesc: "꺼져 있으면 태그가 어디에도 표시되지 않아요.",
    needTag: "켜기 전에 태그를 설정하세요.",
    invalidTag: "태그는 2–4자의 문자 또는 숫자여야 해요.",
    save: "저장",
    saved: "서버 태그를 저장했어요.",
    saveFailed: "서버 태그를 저장하지 못했어요.",
  },
  profile: {
    title: "서버 태그",
    description: "이름 옆에 표시할 서버 태그를 선택하세요. 태그를 켠 서버만 목록에 표시돼요.",
    none: "없음",
    empty: "태그를 사용할 수 있는 서버에 참여하고 있지 않아요.",
    selected: "선택됨",
    updated: "서버 태그를 업데이트했어요.",
    removed: "서버 태그를 제거했어요.",
    failed: "서버 태그를 변경하지 못했어요.",
  },
  menu: {
    adopt: "태그 사용하기",
    remove: "태그 제거",
  },
} satisfies Translation<typeof serverTagTr>;
