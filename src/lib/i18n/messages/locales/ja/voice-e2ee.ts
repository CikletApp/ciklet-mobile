import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "エンドツーエンド暗号化",
    connecting: "暗号化を設定中…",
    mixed: "暗号化されていない参加者がいます",
    unsupported: "暗号化されていない接続",
  },
  title: "エンドツーエンド暗号化",
  body: {
    encrypted:
      "あなたの音声、ビデオ、画面共有は、この通話の参加者のデバイス上でのみ復号されます。Cikletのサーバーを含め、他の誰も内容を見ることはできません。",
    connecting: "参加者と暗号鍵を交換しています。",
    mixed:
      "一部の参加者はエンドツーエンド暗号化に対応していないバージョンを使用しています。その参加者の音声は暗号化されずに送信され、暗号化された参加者の音声は聞こえません。",
    unsupported:
      "このデバイスまたはブラウザはエンドツーエンド暗号化に対応していません。あなたの音声は暗号化されずに送信され、暗号化された参加者の音声は聞こえません。Cikletを更新するか、最新のChrome、Edge、Firefox、Safariをご利用ください。",
  },
  code: {
    title: "音声プライバシーコード",
    help: "このコードを他の参加者と照合してください（例えば読み上げるなど）。全員に同じコードが表示されていれば、通話はエンドツーエンドで暗号化されており、途中で誰も盗聴していません。誰かが参加または退出するとコードが変わります。",
    copy: "コードをコピー",
    copied: "コードをコピーしました",
    waiting: "鍵の準備ができるとコードが表示されます。",
  },
  unencrypted: {
    title: "暗号化されていない参加者",
    badge: "暗号化されていない参加者",
  },
  pending: "暗号化を待機中",
} satisfies Translation<typeof voiceE2eeTr>;
