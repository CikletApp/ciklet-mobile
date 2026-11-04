import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** zh-CN — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "创建文件夹",
    settingsTitle: "文件夹设置",
    nameLabel: "文件夹名称",
    defaultName: "服务器文件夹",
    colorLabel: "文件夹颜色",
    currentColor: "已选颜色",
    customColor: "自定义颜色",
    pickServers: "服务器",
    pickHint: "至少选择两个服务器放入文件夹。",
    inFolder: "文件夹中的服务器 ({count})",
    removeServer: "将 {name} 移出文件夹",
    removeHint: "文件夹中只剩一个服务器时会被移除。",
    addServers: "添加服务器",
    addServer: "将 {name} 添加到文件夹",
    create: "创建文件夹",
    done: "完成",
    createFailed: "无法创建文件夹",
    saveFailed: "无法保存文件夹",
    removeFailed: "无法将服务器移出文件夹",
    addFailed: "无法将服务器添加到文件夹",
    newFolder: "创建文件夹",
    openSettings: "{name} 文件夹设置",
  },
  channelInvites: {
    title: "邀请",
    subtitle: "指向此频道的邀请链接",
    intro: "#{channel} 的邀请链接。加入的人会直接进入此频道。",
  },
} satisfies Translation<typeof parityScreensTr>;
