import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** ko: game-stats.tr.ts (web locales/ko/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "게임 통계",
    updated: "{time} 업데이트됨",
    by: "{app} 제공",
  },
  verified: {
    label: "인증됨",
    tooltip: "인증된 게임 — Ciklet이 개발자를 인증했어요",
  },
  privacy: {
    title: "게임 통계",
    description: "게임과 앱이 내 프로필의 게임 섹션에 기록하는 통계예요. 숨긴 카드는 아무에게도 보이지 않아요.",
    empty: "아직 프로필에 통계를 기록한 게임이 없어요.",
    show: "내 프로필에 표시",
    remove: "제거",
    hidden: "숨김",
  },
} satisfies Translation<typeof gameStatsTr>;
