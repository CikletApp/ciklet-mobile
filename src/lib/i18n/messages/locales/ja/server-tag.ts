import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "{server}のサーバータグ",
    generic: "サーバータグ",
  },
  settings: {
    title: "サーバータグ",
    description: "メンバーは名前の横にこのタグを表示できます。2〜4文字の英数字と絵文字バッジを選んでください。",
    tagLabel: "タグ",
    tagPlaceholder: "TAG",
    tagHint: "2〜4文字の英数字",
    badgeLabel: "バッジ",
    badgeHint: "絵文字1つ",
    badgeClear: "バッジを削除",
    badgePick: "絵文字を選択",
    preview: "プレビュー",
    previewName: "ユーザー",
    enabledLabel: "メンバーにタグの使用を許可",
    enabledDesc: "オフの間、タグはどこにも表示されません。",
    needTag: "オンにする前にタグを設定してください。",
    invalidTag: "タグは2〜4文字の英数字にしてください。",
    save: "保存",
    saved: "サーバータグを保存しました。",
    saveFailed: "サーバータグを保存できませんでした。",
  },
  profile: {
    title: "サーバータグ",
    description: "名前の横に表示するサーバータグを選びます。タグがオンになっているサーバーのみ表示されます。",
    none: "なし",
    empty: "タグを使用できるサーバーに参加していません。",
    selected: "選択中",
    updated: "サーバータグを更新しました。",
    removed: "サーバータグを削除しました。",
    failed: "サーバータグを変更できませんでした。",
  },
  menu: {
    adopt: "タグを使用",
    remove: "タグを外す",
  },
} satisfies Translation<typeof serverTagTr>;
