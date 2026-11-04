import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "翻訳",
    translating: "翻訳中…",
    unsupported: "このブラウザーは翻訳に対応していません",
    unsupportedDevice: "このデバイスは翻訳に対応していません",
    remove: "翻訳を削除",
  },
  footer: {
    translatedFrom: "{language}から翻訳",
    showOriginal: "原文を表示",
    showTranslation: "翻訳を表示",
    dismiss: "翻訳を閉じる",
    translating: "翻訳中…",
    downloading: "言語モデルをデバイスにダウンロードしています… {percent}%",
  },
  errors: {
    same: "このメッセージはすでに{language}です。",
    unavailable: "この言語の組み合わせでは、デバイス上での翻訳を利用できません。",
    undetected: "メッセージの言語を検出できませんでした。",
    empty: "翻訳するテキストがありません。",
    failed: "翻訳できませんでした。",
  },
  settings: {
    title: "翻訳先の言語",
    description: "「翻訳」でメッセージをこの言語に翻訳します。翻訳はデバイス上で行われ、メッセージの内容が Ciklet のサーバーに送信されることはありません。",
    auto: "インターフェースの言語（{language}）",
    unsupported: "このブラウザーはデバイス上での翻訳に対応していません。最新版の Chrome または Edge を使用してください。",
    unsupportedDevice: "このデバイスはデバイス上での翻訳に対応していません。",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "字幕",
  title: "ライブ字幕",
  publish: {
    label: "自分の発言を字幕にする",
    description: "あなたの発言はデバイス上で文字に起こされ、この通話の参加者にのみ送信されます。音声は録音されません。",
  },
  show: {
    label: "字幕を表示",
    description: "字幕をオンにした参加者の発言が画面下部に表示されます。",
  },
  language: "話す言語",
  languageAuto: "インターフェースの言語",
  indicator: "字幕オン",
  indicatorHelp: "この人は発言を字幕として配信しています。",
  status: {
    listening: "聞き取り中…",
    muted: "マイクがオフです — 字幕は一時停止中です。",
    unsupported: "このデバイスは音声認識に対応していません。",
    denied: "マイクまたは音声認識の権限が許可されていません。",
    e2eeBlocked: "このデバイスはエンドツーエンド暗号化通話で字幕を暗号化できないため、字幕の配信はオフになっています。",
    e2ee: "字幕はエンドツーエンドで暗号化されて送信されます。",
    cloud: "ブラウザーが独自の音声サービスで発言を認識する場合があります。音声が Ciklet のサーバーに送られることはありません。",
    onDevice: "音声認識はデバイス上で行われます。",
    error: "音声認識が停止しました。",
  },
  empty: "まだ字幕はありません。",
} satisfies Translation<typeof liveCaptionsTr>;
