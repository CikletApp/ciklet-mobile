import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "切换账号",
  manage: "管理账号",
  add: "添加账号",
  title: "管理账号",
  description: "在此设备上最多可在 {max} 个账号之间切换，无需重新登录。",
  current: "当前账号",
  switch: "切换",
  switching: "正在切换…",
  remove: "移除",
  removeConfirm: "要从此设备的账号列表中移除 {name} 吗？之后如需切换回来，需要重新登录。",
  needsLogin: "重新登录",
  limitReached: "最多可添加 {max} 个账号。请先移除一个再添加。",
  failed: "无法切换账号。请重试。",
  notFound: "此账号已不在列表中。",
  removed: "已从列表中移除账号。",
  addTitle: "添加账号",
  addDescription: "登录你要添加的账号。你当前的账号会保留在列表中。",
  addCancel: "取消",
  savedTitle: "已保存的账号",
  savedDescription: "切换到你在此设备上用过的账号。",
  orSignIn: "或使用其他账号登录",
  inCallWarning: "切换账号会断开你的语音连接。",
} satisfies Translation<typeof accountSwitcherTr>;
