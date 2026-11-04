import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** zh-CN — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "服务器",
  home: "私信",
  addServer: "添加服务器",
  discover: "探索服务器",
  download: "下载应用",
  newActivity: "#{channel} 有新动态",
  voiceCount: "语音中 {count} 人",
  unread: "{count} 条未读",
  keyboardHint: "按 Alt+Shift+上/下 移动",
  folder: {
    defaultName: "服务器文件夹",
    aria: "{name} 文件夹，{count} 个服务器",
    markRead: "将文件夹标为已读",
    moveTo: "移动到：",
    settings: "文件夹设置",
    closeAll: "关闭所有文件夹",
  },
  move: {
    top: "移到最上",
    up: "上移一位",
    down: "下移一位",
    bottom: "移到最下",
  },
  server: {
    markRead: "标记为已读",
    removeFromFolder: "移出文件夹",
    addToFolder: "添加到文件夹：{name}",
  },
  settings: {
    title: "文件夹设置",
    name: "文件夹名称",
    color: "文件夹颜色",
    customColor: "自定义颜色",
    done: "完成",
  },
  toast: {
    saveFailed: "无法保存服务器顺序，已恢复之前的布局。",
    folderSaveFailed: "无法保存文件夹设置。",
  },
} satisfies Translation<typeof serverRailTr>;
