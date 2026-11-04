import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "端到端加密",
    connecting: "正在设置加密…",
    mixed: "有未加密的参与者",
    unsupported: "未加密的连接",
  },
  title: "端到端加密",
  body: {
    encrypted:
      "你的语音、视频和屏幕共享只会在本次通话参与者的设备上解密。其他任何人，包括 Ciklet 的服务器，都无法看到内容。",
    connecting: "正在与参与者交换加密密钥。",
    mixed:
      "部分参与者使用的版本不支持端到端加密。他们的音频以未加密方式发送，并且他们听不到已加密的参与者。",
    unsupported:
      "此设备或浏览器不支持端到端加密：你的音频将以未加密方式发送，并且你听不到已加密的参与者。请更新 Ciklet，或使用最新版的 Chrome、Edge、Firefox 或 Safari。",
  },
  code: {
    title: "语音隐私码",
    help: "与其他参与者核对此代码（例如大声念出来）。如果所有人看到的代码相同，则通话为端到端加密，中间没有人在窃听。有人加入或离开时代码会变化。",
    copy: "复制代码",
    copied: "代码已复制",
    waiting: "密钥就绪后将显示代码。",
  },
  unencrypted: {
    title: "未加密的参与者",
    badge: "未加密的参与者",
  },
  pending: "等待加密",
} satisfies Translation<typeof voiceE2eeTr>;
