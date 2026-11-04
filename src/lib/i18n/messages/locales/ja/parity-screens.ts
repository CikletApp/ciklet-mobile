import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** ja — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "フォルダーを作成",
    settingsTitle: "フォルダー設定",
    nameLabel: "フォルダー名",
    defaultName: "サーバーフォルダー",
    colorLabel: "フォルダーの色",
    currentColor: "選択中の色",
    customColor: "カスタムカラー",
    pickServers: "サーバー",
    pickHint: "フォルダーに入れるサーバーを2つ以上選んでください。",
    inFolder: "フォルダー内のサーバー ({count})",
    removeServer: "{name}をフォルダーから外す",
    removeHint: "サーバーが1つだけになるとフォルダーは削除されます。",
    addServers: "サーバーを追加",
    addServer: "{name}をフォルダーに追加",
    create: "フォルダーを作成",
    done: "完了",
    createFailed: "フォルダーを作成できませんでした",
    saveFailed: "フォルダーを保存できませんでした",
    removeFailed: "サーバーをフォルダーから外せませんでした",
    addFailed: "サーバーをフォルダーに追加できませんでした",
    newFolder: "フォルダーを作成",
    openSettings: "{name}のフォルダー設定",
  },
  channelInvites: {
    title: "招待",
    subtitle: "このチャンネルへの招待リンク",
    intro: "#{channel} への招待リンクです。参加した人はこのチャンネルに直接移動します。",
  },
} satisfies Translation<typeof parityScreensTr>;
