/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "不禁言",
    s60: "60 秒",
    m5: "5 分钟",
    m10: "10 分钟",
    h1: "1 小时",
    d1: "1 天",
    w1: "1 周",
  },
  settings: {
    words: {
      title: "AutoMod — 屏蔽词",
      description: "用逗号或换行分隔；按完整单词匹配，以 * 结尾可匹配前缀。拼写花招也会被识别（重复字母、数字/符号、分隔符）。匹配的消息无法发送（若通过网关发送则会被删除）。最多 {max} 个词。",
      placeholder: "词1, 词2, 前缀*",
      count: "{count} 个词",
    },
    mentions: {
      title: "AutoMod — 提及刷屏",
      description: "拦截提及超过此数量的不同用户或身份组的消息。留空即关闭（最多 {max}）。",
      off: "关闭",
    },
    linkFilter: {
      title: "AutoMod — 链接过滤器",
      description: "开启后，只允许指向以下域名（及其子域名）的链接；附件始终允许。最多 {max} 个域名。",
      emptyWarning: "没有允许的域名：所有链接都会被拦截。",
    },
    actionsSection: {
      title: "AutoMod — 操作",
      description: "违反规则的消息总会被拦截。还可以选择禁言作者，并将事件发布到你的管理频道和该消息所在的频道。",
      timeout: "禁言",
      alertChannel: "管理频道",
      noAlert: "不发送提醒",
    },
    preset: {
      title: "AutoMod — 土耳其语脏话过滤器",
      description: "现成的、全面的土耳其语脏话和侮辱词列表。它也能识别拼写花招（重复字母、4→a、1→ı、0→o、$→s、用点或空格拆分），并且不会误伤 \"sıkıntı\"、\"amaç\" 或 \"piknik\" 等无害词语。",
      enable: "一键启用",
      enabled: "已开启",
      allowTitle: "允许的词",
      allowDescription: "永远不应被拦截的词（用逗号或换行分隔；以 * 结尾表示前缀）。同时适用于预设列表和屏蔽词列表。",
      allowPlaceholder: "amina, 词*",
    },
    spam: {
      title: "AutoMod — 刷屏检测",
      description: "拦截短时间内发送大量消息或重复相同内容的成员的消息。",
      maxMessages: "最大消息数",
      window: "时间窗口（秒）",
      duplicates: "相同消息重复次数（60 秒）",
    },
    caps: {
      title: "AutoMod — 大写过多",
      description: "拦截大写字母占比超过设定值的消息（短消息除外）。",
      percent: "大写占比（%）",
      minLetters: "最少字母数",
    },
    links: {
      inviteTitle: "拦截邀请链接",
      inviteDescription: "无法分享 Ciklet 和 Discord 的服务器邀请。",
      blockedTitle: "屏蔽的域名",
      blockedDescription: "即使链接过滤器关闭，指向这些域名（及子域名）的链接也会被拦截。",
    },
    profile: {
      title: "AutoMod — 用户名和个人资料过滤器",
      description: "显示名称、用户名、服务器昵称和个人简介必须通过屏蔽词列表以及（若已启用）脏话过滤器。未通过的成员在修改之前无法发送消息；此类昵称和服务器简介不会被保存。",
    },
    actions: {
      warnTitle: "在频道中显示警告",
      warnDescription: "在被拦截消息所在的频道中发布一条简短的 AutoMod 提示（不显示内容）。",
      blockMessageTitle: "向发送者显示的消息",
      blockMessageDescription: "留空则显示该规则自带的说明。",
      blockMessagePlaceholder: "此消息违反了服务器规则。",
    },
    exempt: {
      title: "AutoMod — 豁免",
      description: "拥有“管理消息”权限的成员始终豁免。以下身份组和频道（包括其子区）也不会被检查。",
      roles: "豁免的身份组",
      channels: "豁免的频道",
      none: "未选择",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "直播中",
  settings: {
    hint: "关联你的账号，直播时在个人资料上显示“直播中”",
    broadcaster: "主播权限",
    broadcasterHint: "允许关联身份组读取你的订阅者",
    grantBroadcaster: "以主播身份关联",
    connect: "关联",
    reconnect: "重新关联",
    disconnect: "移除",
    disconnected: "{platform} 关联已移除。",
    disconnectFailed: "无法移除 {platform} 关联。",
    liveNow: "正在直播",
  },
  linkedRoles: {
    title: "关联身份组",
    description: "将身份组与你的 Twitch 或 Kick 频道订阅绑定。成员关联账号后，若符合条件将自动获得该身份组，订阅结束时则自动移除（每半小时重新验证一次）。只有服务器所有者可以为自己的频道进行设置。",
    ownerOnly: "只有服务器所有者可以管理关联身份组。",
    role: "身份组",
    platform: "平台",
    requirement: "条件",
    subscriber: "订阅了我的频道",
    follower: "关注了我的频道",
    followerTwitchOnly: "关注条件仅适用于 Twitch（Kick 不会报告取消关注）。",
    add: "绑定",
    remove: "移除",
    empty: "还没有关联身份组。",
    loading: "加载中…",
    needsBroadcaster: "请先在“设置 → 个人资料 → 关联账号”中通过“以主播身份关联”关联你的 {platform} 账号。",
    created: "关联身份组已创建。",
    createFailed: "无法创建关联身份组。",
    removeFailed: "无法移除关联身份组。",
    granted: "{count} 位成员",
    lastSynced: "上次验证：{time}",
    selectRole: "选择身份组",
  },

} satisfies Translation<typeof streamingTr>;
