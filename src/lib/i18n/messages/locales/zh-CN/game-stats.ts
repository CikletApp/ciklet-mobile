import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** zh-CN: game-stats.tr.ts (web locales/zh-CN/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "游戏统计",
    updated: "更新于 {time}",
    by: "来自 {app}",
  },
  verified: {
    label: "已认证",
    tooltip: "已认证的游戏——其开发者已通过 Ciklet 认证",
  },
  privacy: {
    title: "游戏统计",
    description: "游戏和应用写入你个人资料“游戏”部分的统计数据。隐藏的卡片不会向任何人显示。",
    empty: "还没有游戏向你的个人资料写入统计数据。",
    show: "在我的个人资料中显示",
    remove: "移除",
    hidden: "已隐藏",
  },
} satisfies Translation<typeof gameStatsTr>;
