import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** ko — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "게임",
  close: "닫기",
  openOnSteam: "Steam에서 열기",
  viewOnSteam: "Steam에서 보기",
  openWebsite: "공식 사이트 열기",
  viewOnIgdb: "IGDB에서 보기",
  error: {
    gameNotFound: "이 게임에 대한 정보가 없어요.",
    programNotFound: "이 앱에 대한 정보가 없어요.",
    gameFailed: "게임 정보를 불러오지 못했어요.",
    programFailed: "앱 정보를 불러오지 못했어요.",
  },
  about: {
    title: "정보",
    showMore: "더 보기",
    showLess: "간략히",
    source: "출처:",
    wikipediaLang: "위키백과 ({lang})",
  },
  details: {
    title: "세부 정보",
    genre: "장르",
    category: "카테고리",
    developer: "개발사",
    publisher: "배급사",
    releaseDate: "출시일",
    firstRelease: "최초 출시",
    platform: "플랫폼",
    license: "라이선스",
    website: "공식 사이트",
    steamStore: "Steam 상점",
  },
  license: {
    openSource: "오픈 소스",
    freeware: "프리웨어",
    proprietary: "독점 소프트웨어",
  },
  sources: "출처: {list}",
  credits: {
    title: "이미지: 위키미디어 공용",
    logo: "로고",
    screenshot: "스크린샷",
    unknownLicense: "파일 페이지의 라이선스",
  },
} satisfies Translation<typeof gameDetailTr>;
