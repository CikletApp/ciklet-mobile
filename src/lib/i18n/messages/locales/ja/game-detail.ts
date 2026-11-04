import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** ja — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "ゲーム",
  close: "閉じる",
  openOnSteam: "Steamで開く",
  viewOnSteam: "Steamで見る",
  openWebsite: "公式サイトを開く",
  viewOnIgdb: "IGDBで見る",
  error: {
    gameNotFound: "このゲームの情報はありません。",
    programNotFound: "このアプリの情報はありません。",
    gameFailed: "ゲーム情報を読み込めませんでした。",
    programFailed: "アプリ情報を読み込めませんでした。",
  },
  about: {
    title: "概要",
    showMore: "もっと見る",
    showLess: "閉じる",
    source: "出典:",
    wikipediaLang: "Wikipedia（{lang}）",
  },
  details: {
    title: "詳細",
    genre: "ジャンル",
    category: "カテゴリー",
    developer: "開発元",
    publisher: "販売元",
    releaseDate: "発売日",
    firstRelease: "初回リリース",
    platform: "プラットフォーム",
    license: "ライセンス",
    website: "公式サイト",
    steamStore: "Steamストア",
  },
  license: {
    openSource: "オープンソース",
    freeware: "フリーウェア",
    proprietary: "プロプライエタリ",
  },
  sources: "出典: {list}",
  credits: {
    title: "画像: Wikimedia Commons",
    logo: "ロゴ",
    screenshot: "スクリーンショット",
    unknownLicense: "ライセンスはファイルページを参照",
  },
} satisfies Translation<typeof gameDetailTr>;
