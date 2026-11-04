import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "{server} 服务器标签",
    generic: "服务器标签",
  },
  settings: {
    title: "服务器标签",
    description: "成员可以在名字旁显示此标签。请选择 2–4 个字母或数字，以及一个表情符号徽章。",
    tagLabel: "标签",
    tagPlaceholder: "TAG",
    tagHint: "2–4 个字母或数字",
    badgeLabel: "徽章",
    badgeHint: "单个表情符号",
    badgeClear: "移除徽章",
    badgePick: "选择表情符号",
    preview: "预览",
    previewName: "用户",
    enabledLabel: "允许成员使用标签",
    enabledDesc: "关闭时，标签不会在任何地方显示。",
    needTag: "请先设置标签再开启。",
    invalidTag: "标签必须为 2–4 个字母或数字。",
    save: "保存",
    saved: "服务器标签已保存。",
    saveFailed: "无法保存服务器标签。",
  },
  profile: {
    title: "服务器标签",
    description: "选择显示在你名字旁的服务器标签。仅列出已开启标签的服务器。",
    none: "无",
    empty: "你所在的服务器中没有可使用其标签的服务器。",
    selected: "已选择",
    updated: "你的服务器标签已更新。",
    removed: "你的服务器标签已移除。",
    failed: "无法更改你的服务器标签。",
  },
  menu: {
    adopt: "使用标签",
    remove: "移除标签",
  },
} satisfies Translation<typeof serverTagTr>;
