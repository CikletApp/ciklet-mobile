import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** ja — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "サーバー",
  home: "ダイレクトメッセージ",
  addServer: "サーバーを追加",
  discover: "サーバーを探す",
  download: "アプリをダウンロード",
  newActivity: "#{channel} に新しいアクティビティ",
  voiceCount: "ボイスに{count}人",
  unread: "未読 {count}",
  keyboardHint: "Alt+Shift+上/下で移動",
  folder: {
    defaultName: "サーバーフォルダー",
    aria: "{name} フォルダー、{count}サーバー",
    markRead: "フォルダーを既読にする",
    moveTo: "移動先:",
    settings: "フォルダー設定",
    closeAll: "すべてのフォルダーを閉じる",
  },
  move: {
    top: "一番上へ",
    up: "1つ上へ",
    down: "1つ下へ",
    bottom: "一番下へ",
  },
  server: {
    markRead: "既読にする",
    removeFromFolder: "フォルダーから削除",
    addToFolder: "フォルダーに追加: {name}",
  },
  settings: {
    title: "フォルダー設定",
    name: "フォルダー名",
    color: "フォルダーの色",
    customColor: "カスタムカラー",
    done: "完了",
  },
  toast: {
    saveFailed: "サーバーの並び順を保存できませんでした。以前の配置に戻しました。",
    folderSaveFailed: "フォルダー設定を保存できませんでした。",
  },
} satisfies Translation<typeof serverRailTr>;
