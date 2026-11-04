import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** zh-CN — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "任务",
  subtitle: "玩游戏、聊天、探索——完成任务即可获得 Ciklet 和奖励。",
  balance: "你的 Ciklet 余额",
  lifetime: "累计获得：{points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet 点数是仅在应用内使用的虚拟货币：不具有任何真实货币价值，不能兑换为土耳其里拉（TL）或其他任何货币，不能出售，也不能转让给他人。Ciklet 点数只能用于在商店中购买个人资料物品。",
  goStore: "前往商店",
  loading: "正在加载任务…",
  loadError: "无法加载任务。",
  empty: "目前没有开放的任务。新任务很快就会出现在这里。",
  tabs: {
    open: "进行中的任务",
    done: "已完成",
  },
  kind: {
    playGame: "玩 {game} {minutes} 分钟",
    voice: "在语音频道中待 {minutes} 分钟",
    activity: "在 {app} 活动中待 {minutes} 分钟",
    activityAny: "在活动应用中待 {minutes} 分钟",
    createServer: "创建你的第一个服务器",
    inviteFriend: "通过你的邀请链接带 {count} 人加入你的服务器",
    streakDay: "连续 {count} 天：每天{source} {minutes} 分钟",
    streakWeek: "连续 {count} 周：每周{source} {minutes} 分钟",
  },
  source: {
    voice: "在语音中闲聊",
    game: "玩 {game}",
    activity: "使用活动应用",
  },
  progress: {
    minutes: "{value} / {target} 分钟",
    count: "{value} / {target}",
    days: "{value} / {target} 天",
    weeks: "{value} / {target} 周",
  },
  action: {
    enroll: "接受任务",
    claim: "领取奖励",
    claimed: "已领取",
    inProgress: "进行中",
    expired: "已过期",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days} 天 Mentol {plan}",
    item: "{name}",
  },
  sponsor: "由 {name} 呈现",
  endsAt: "结束：{date}",
  noEnd: "无结束日期",
  claimUntil: "请在 {date} 前领取",
  toast: {
    enrolled: "任务已接受——现在开始计算进度。",
    claimed: "奖励已领取！",
    alreadyClaimed: "你已经领取过此奖励。",
    itemOwned: "你已拥有该奖励物品；Ciklet 和其他奖励已添加。",
    failed: "出了点问题。",
  },
  how: {
    title: "进度如何计算？",
    enroll: "进度从你接受任务的那一刻开始计算，之前的不计入。",
    game: "游戏时长来自桌面应用上报的活动记录。",
    voice: "只有频道中至少有两个人时，语音时长才会计入。",
    once: "每个任务的奖励每个账号只能领取一次。",
  },
  store: {
    buyWithPoints: "用 {points} Ciklet 获取",
    notEnough: "需要 {points} Ciklet",
    bought: "已用 Ciklet 获得 {name}",
    earn: "通过任务赚取 Ciklet",
  },
} satisfies Translation<typeof questsTr>;
