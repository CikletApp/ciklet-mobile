import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** ja: game-stats.tr.ts (web locales/ja/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "ゲーム統計",
    updated: "{time}に更新",
    by: "{app}より",
  },
  verified: {
    label: "認証済み",
    tooltip: "認証済みのゲーム — 開発者は Ciklet によって認証されています",
  },
  privacy: {
    title: "ゲーム統計",
    description: "ゲームやアプリがプロフィールの「ゲーム」セクションに書き込む統計です。非表示のカードは誰にも表示されません。",
    empty: "プロフィールに統計を書き込んだゲームはまだありません。",
    show: "プロフィールに表示",
    remove: "削除",
    hidden: "非表示",
  },
} satisfies Translation<typeof gameStatsTr>;
