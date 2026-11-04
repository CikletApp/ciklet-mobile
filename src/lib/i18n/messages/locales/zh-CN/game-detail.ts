import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** zh-CN — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "游戏",
  close: "关闭",
  openOnSteam: "在 Steam 中打开",
  viewOnSteam: "在 Steam 上查看",
  openWebsite: "打开官方网站",
  viewOnIgdb: "在 IGDB 上查看",
  error: {
    gameNotFound: "暂无此游戏的信息。",
    programNotFound: "暂无此应用的信息。",
    gameFailed: "无法加载游戏信息。",
    programFailed: "无法加载应用信息。",
  },
  about: {
    title: "简介",
    showMore: "显示更多",
    showLess: "收起",
    source: "来源：",
    wikipediaLang: "维基百科（{lang}）",
  },
  details: {
    title: "详情",
    genre: "类型",
    category: "分类",
    developer: "开发商",
    publisher: "发行商",
    releaseDate: "发行日期",
    firstRelease: "首次发布",
    platform: "平台",
    license: "许可证",
    website: "官方网站",
    steamStore: "Steam 商店",
  },
  license: {
    openSource: "开源",
    freeware: "免费软件",
    proprietary: "专有软件",
  },
  sources: "来源：{list}",
  credits: {
    title: "图片：Wikimedia Commons",
    logo: "标志",
    screenshot: "截图",
    unknownLicense: "许可证见文件页面",
  },
} satisfies Translation<typeof gameDetailTr>;
