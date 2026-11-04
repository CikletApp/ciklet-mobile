import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "翻译",
    translating: "正在翻译…",
    unsupported: "此浏览器不支持翻译",
    unsupportedDevice: "此设备不支持翻译",
    remove: "移除翻译",
  },
  footer: {
    translatedFrom: "译自{language}",
    showOriginal: "显示原文",
    showTranslation: "显示译文",
    dismiss: "关闭翻译",
    translating: "正在翻译…",
    downloading: "正在将语言模型下载到你的设备… {percent}%",
  },
  errors: {
    same: "这条消息已经是{language}。",
    unavailable: "此语言组合不支持设备端翻译。",
    undetected: "无法识别消息的语言。",
    empty: "没有可翻译的文本。",
    failed: "翻译失败。",
  },
  settings: {
    title: "翻译目标语言",
    description: "“翻译”会将消息翻译成此语言。翻译在你的设备上完成，消息内容绝不会发送到 Ciklet 服务器。",
    auto: "界面语言（{language}）",
    unsupported: "此浏览器不支持设备端翻译，请使用最新版本的 Chrome 或 Edge。",
    unsupportedDevice: "此设备不支持设备端翻译。",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "字幕",
  title: "实时字幕",
  publish: {
    label: "为我的语音生成字幕",
    description: "你的语音会在你的设备上转写为文字，且只发送给本次通话中的人。不会录制任何音频。",
  },
  show: {
    label: "显示字幕",
    description: "开启字幕的参与者所说的话会显示在屏幕底部。",
  },
  language: "语音语言",
  languageAuto: "界面语言",
  indicator: "字幕已开启",
  indicatorHelp: "此人正在以字幕形式广播自己的语音。",
  status: {
    listening: "正在聆听…",
    muted: "你的麦克风已关闭——字幕已暂停。",
    unsupported: "此设备不支持语音识别。",
    denied: "未授予麦克风或语音识别权限。",
    e2eeBlocked: "此设备无法在端到端加密通话中加密字幕，字幕广播已关闭。",
    e2ee: "字幕以端到端加密方式发送。",
    cloud: "你的浏览器可能会使用自己的语音服务识别你的语音；音频绝不会发送到 Ciklet 服务器。",
    onDevice: "语音识别在你的设备上运行。",
    error: "语音识别已停止。",
  },
  empty: "暂无字幕。",
} satisfies Translation<typeof liveCaptionsTr>;
