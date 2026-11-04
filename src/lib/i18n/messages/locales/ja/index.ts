import { automod, streaming } from "./automod";
import { safety } from "./safety";
import { voiceE2ee } from "./voice-e2ee";
import { serverGuide } from "./server-guide";
import { serverTag } from "./server-tag";
import { serverRail } from "./server-rail";
import { serverBoost } from "./server-boost";
import { accountSwitcher } from "./account-switcher";
import { familyCenter } from "./family-center";
import { gameStats } from "./game-stats";
import { gameDetail } from "./game-detail";
import { compliance } from "./compliance";
import { quests } from "./quests";
import { settingsAccount } from "./settings-account";
import { settingsGeneral } from "./settings-general";
import { settingsMedia } from "./settings-media";
import { liveCaptions, translation } from "./live-language";
import { moreScreens } from "./more-screens";
import { parityScreens } from "./parity-screens";
import type { Messages } from "../../tr";
import type { Translation } from "../../translation";

/** ja sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "キャンセル",
    save: "保存",
    close: "閉じる",
    system: "システム",
    on: "オン",
    off: "オフ",
  },
  tabs: {
    chats: "チャット",
    servers: "サーバー",
    notifications: "通知",
    me: "あなた",
    unread: "{label}、未読{count}件",
  },
  messagePreview: {
    voice: "🎤 ボイスメッセージ",
    voiceWithDuration: "🎤 ボイスメッセージ（{duration}）",
    activity: "🎮 アクティビティ: {name}",
    activityUnnamed: "🎮 アクティビティへの招待",
    image: "📷 写真",
    video: "🎥 動画",
    gif: "GIF",
    sticker: "スタンプ",
    clip: "🎬 クリップ",
    file: "📎 {name}",
    attachment: "📎 添付ファイル",
  },
  activity: {
    broadcast: {
      live: "ライブ",
      game: "{game}を配信中",
      liveOn: "{platform}で配信中",
      title: "ライブ配信",
      watch: "配信を見る",
    },
  },
  appCommands: {
    commands: "コマンド",
    apps: "アプリ",
    optional: "任意",
    required: "必須",
    true: "はい",
    false: "いいえ",
    chooseFile: "ファイルを選択",
    loading: "読み込み中…",
    noSuggestions: "候補はありません",
    timedOut: "アプリが時間内に応答しませんでした",
    selectUser: "ユーザーを選択",
    selectRole: "ロールを選択",
    selectChannel: "チャンネルを選択",
    selectMentionable: "ユーザーまたはロールを選択",
    enterValue: "値を入力",
    enterNumber: "数値を入力",
    runFailed: "コマンドを実行できませんでした。",
  },
  messageComponents: {
    choose: "選択してください",
    chooseOption: "選択肢を選ぶ",
    search: "検索",
    noResults: "結果が見つかりません",
    loading: "読み込み中…",
    confirm: "選択",
    clear: "消去",
    selectedCount: "{count}件選択中",
    selectRange: "{min}〜{max}個を選択",
    unknown: "不明",
    botNoResponse: "{name}が応答しませんでした。",
    interactionFailed: "インタラクションを開始できませんでした。",
    formNoResponse: "ボットがフォームに応答しませんでした。",
    formFailed: "フォームを送信できませんでした。",
    formLabel: "ボットフォーム",
    submit: "送信",
    cancel: "キャンセル",
    requiredMark: "必須",
    uploadFile: "ファイルをアップロード",
    uploading: "アップロード中…",
    uploadFailed: "ファイルをアップロードできませんでした。",
    removeFile: "削除",
    fileLimit: "最大{max}ファイル",
    allowedTypes: "使用可能: {types}",
    fileTypeRejected: "このファイル形式は使用できません。",
    download: "ダウンロード",
    spoiler: "ネタバレ",
    show: "表示",
    openImage: "画像を拡大",
    attachment: "添付ファイル",
  },
  settings: {
    title: "設定",
    editProfile: "プロフィールを編集",
    sections: {
      account: "アカウント設定",
      app: "アプリの設定",
      support: "サポート",
      session: "セッション",
    },
    rows: {
      account: "アカウント",
      mentol: "Mentol",
      privacy: "プライバシー・データ・ソーシャル",
      friendRequests: "フレンドリクエスト",
      authorizedApps: "認証済みアプリ",
      voice: "音声・ビデオ",
      appearance: "外観",
      chat: "チャット",
      notifications: "通知",
      activity: "アクティビティステータス",
      help: "ヘルプ",
      helpSubtitle: "サポート、フィードバック、規約",
      scanLogin: "コードを読み取る",
      scanLoginSubtitle: "スマートフォンでデスクトップにサインイン",
    },
    scanLogin: {
      title: "コードを読み取る",
      hint: "デスクトップのサインイン画面で回転しているリングを枠内に収めてください。",
      permissionTitle: "カメラへのアクセスが必要です",
      permissionBody: "デスクトップに表示されたコードを読み取るためにカメラが必要です。",
      permissionAction: "許可",
      openSettings: "設定を開く",
      searching: "コードを探しています…",
      checking: "コードを確認中…",
      gone: "このコードは期限切れです。デスクトップでコードが更新されるのを待ってから、もう一度読み取ってください。",
      confirmTitle: "デスクトップにサインインしますか？",
      confirmBody: "心当たりがない場合は拒否してください。コードは絶対に共有しないでください。",
      device: "デバイス",
      location: "場所",
      ip: "IPアドレス",
      time: "時刻",
      justNow: "たった今",
      approve: "はい、サインインします",
      reject: "いいえ、私ではありません",
      approved: "承認しました。デスクトップでサインインしています。",
      rejected: "拒否しました。デスクトップのコードが更新されます。",
      failed: "承認を送信できませんでした。もう一度お試しください。",
      unknownLocation: "不明",
    },
    logout: {
      action: "ログアウト",
      title: "ログアウト",
      message: "このデバイスからログアウトします。",
    },
    memberSince: "{date}からCikletを利用中",
    appearance: {
      title: "外観",
      motion: {
        title: "視差効果を減らす",
        description:
          "トランジション、スライドするパネル、点滅するアニメーションを控えめにします。「システム」ではスマートフォンのアクセシビリティ設定に従います。",
      },
      language: {
        title: "言語",
        description: "インターフェースの言語です。翻訳は進行中のため、未翻訳のテキストは英語またはトルコ語で表示されます。",
        system: "デバイスの言語（{name}）",
        restartRtl: "新しい文字の向きを適用するには、アプリを閉じてから開き直してください。",
      },
    },
    voice: {
      title: "音声・ビデオ",
      inputMode: "入力モード",
      vad: "音声検出",
      ptt: "プッシュトゥトーク",
      pttHint:
        "プッシュトゥトークがオンの場合、ボイスチャンネルではマイクがミュート状態で始まります。話すときは画面上のボタンを長押ししてください。",
      noise: "ノイズ抑制",
      noiseOff: "オフ",
      noiseStandard: "標準",
      noiseOffHint: "音声を加工せずに送信します（楽器、スタジオマイク向け）。",
      noiseStandardHint: "デバイス内蔵のノイズ抑制。",
      noiseAdvancedNote: "高度なノイズ抑制（RNNoise）は現在ウェブとデスクトップでのみ利用できます。",
      inputVolume: "入力音量",
      outputVolume: "出力音量",
      deviceNote:
        "入力・出力デバイスはスマートフォンが自動で管理します。Bluetoothや有線のデバイスはシステムのオーディオパネルから選択してください。",
    },
    notifications: {
      title: "通知",
      permission: "通知の許可",
      master: "Cikletの通知",
      masterDescription: "このデバイスで通知を許可します。",
      permissionDenied: "システム設定で通知がオフになっています。",
      types: "通知の種類",
      messages: "メッセージとメンション",
      calls: "着信",
      friends: "フレンドリクエスト",
      sounds: "通知音",
      lockScreen: "ロック画面での着信",
      fullScreenOff: "全画面着信の許可がオフです",
      fullScreenBody:
        "アプリを閉じているときにロック画面で全画面の着信を表示するには、Androidで別の許可が必要です。許可がない場合、着信は通知としてのみ表示されます。",
      openSettings: "設定を開く",
      overrides: "サーバー・チャンネル・チャットの個別設定",
      overridesEmpty:
        "まだ個別設定はありません。サーバー、チャンネル、チャットを長押しして「通知」を選ぶと追加できます。",
      reset: "デフォルトに戻す",
    },
  },
  automod: automod,
  safety: safety,
  voiceE2ee: voiceE2ee,
  streaming: streaming,
  serverGuide: serverGuide,
  serverTag: serverTag,
  serverRail: serverRail,
  serverBoost: serverBoost,
  /** Hesap değiştirici (web ile aynı anahtarlar) — account-switcher.en.ts. */
  accountSwitcher: accountSwitcher,
  /** Aile Merkezi (web ile aynı anahtarlar) — family-center.en.ts. */
  familyCenter: familyCenter,
  gameStats: gameStats,
  gameDetail: gameDetail,
  compliance: compliance,
  quests: quests,
  settingsAccount: settingsAccount,
  settingsGeneral: settingsGeneral,
  settingsMedia: settingsMedia,
  translation: translation,
  liveCaptions: liveCaptions,
  moreScreens: moreScreens,
  parityScreens: parityScreens,
} satisfies Translation<Messages>;
