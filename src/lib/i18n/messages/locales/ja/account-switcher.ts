import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "アカウントを切り替え",
  manage: "アカウントを管理",
  add: "アカウントを追加",
  title: "アカウントを管理",
  description: "このデバイスで最大{max}個のアカウントを、再ログインせずに切り替えられます。",
  current: "使用中のアカウント",
  switch: "切り替え",
  switching: "切り替え中…",
  remove: "削除",
  removeConfirm: "{name}をこのデバイスのアカウント一覧から削除しますか？元に戻すには再度ログインが必要です。",
  needsLogin: "再ログイン",
  limitReached: "追加できるアカウントは最大{max}個です。別のアカウントを追加するには、いずれかを削除してください。",
  failed: "アカウントを切り替えられませんでした。もう一度お試しください。",
  notFound: "このアカウントはもう一覧にありません。",
  removed: "アカウントを一覧から削除しました。",
  addTitle: "アカウントを追加",
  addDescription: "追加したいアカウントでログインしてください。現在のアカウントは一覧に残ります。",
  addCancel: "キャンセル",
  savedTitle: "保存済みアカウント",
  savedDescription: "このデバイスで使用したアカウントに切り替えます。",
  orSignIn: "または別のアカウントでログイン",
  inCallWarning: "アカウントを切り替えると音声接続が切断されます。",
} satisfies Translation<typeof accountSwitcherTr>;
