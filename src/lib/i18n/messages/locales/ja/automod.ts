/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "タイムアウトなし",
    s60: "60秒",
    m5: "5分",
    m10: "10分",
    h1: "1時間",
    d1: "1日",
    w1: "1週間",
  },
  settings: {
    words: {
      title: "AutoMod — 禁止ワード",
      description: "カンマまたは改行で区切ります。単語全体が一致します。前方一致にするには末尾に * を付けます。表記のごまかし（文字の繰り返し、数字・記号、区切り文字）も検出されます。一致したメッセージは送信できません（ゲートウェイ経由の場合は削除されます）。最大{max}語。",
      placeholder: "ワード1, ワード2, 前方一致*",
      count: "{count}語",
    },
    mentions: {
      title: "AutoMod — メンションスパム",
      description: "この数より多くの異なるユーザーまたはロールをメンションしたメッセージをブロックします。空欄にするとオフになります（最大{max}）。",
      off: "オフ",
    },
    linkFilter: {
      title: "AutoMod — リンクフィルター",
      description: "オンにすると、以下のドメイン（とそのサブドメイン）へのリンクのみ許可されます。添付ファイルは常に許可されます。最大{max}ドメイン。",
      emptyWarning: "許可されたドメインがありません。すべてのリンクがブロックされます。",
    },
    actionsSection: {
      title: "AutoMod — アクション",
      description: "ルールに違反したメッセージは常にブロックされます。必要に応じて投稿者をタイムアウトし、モデレーションチャンネルとメッセージのチャンネルに通知を投稿できます。",
      timeout: "タイムアウト",
      alertChannel: "モデレーションチャンネル",
      noAlert: "通知なし",
    },
    preset: {
      title: "AutoMod — トルコ語の不適切な言葉フィルター",
      description: "トルコ語の不適切な言葉や侮辱を網羅した既製のリストです。表記のごまかし（文字の繰り返し、4→a、1→ı、0→o、$→s、ドットやスペースでの分割）も検出し、「sıkıntı」「amaç」「piknik」のような無害な単語は検出しません。",
      enable: "ワンクリックで有効化",
      enabled: "オン",
      allowTitle: "許可ワード",
      allowDescription: "決して検出されるべきでない単語（カンマまたは改行で区切ります。前方一致は末尾に * ）。プリセットと禁止ワードリストの両方に適用されます。",
      allowPlaceholder: "amina, ワード*",
    },
    spam: {
      title: "AutoMod — スパム検出",
      description: "短時間に大量のメッセージを送信したり、同じ内容を繰り返したりするメンバーのメッセージをブロックします。",
      maxMessages: "最大メッセージ数",
      window: "期間（秒）",
      duplicates: "同じメッセージの繰り返し（60秒）",
    },
    caps: {
      title: "AutoMod — 大文字の多用",
      description: "大文字の割合が指定値を超えるメッセージをブロックします（短いメッセージは除く）。",
      percent: "大文字の割合（%）",
      minLetters: "最小文字数",
    },
    links: {
      inviteTitle: "招待リンクをブロック",
      inviteDescription: "CikletとDiscordのサーバー招待を共有できなくなります。",
      blockedTitle: "ブロックするドメイン",
      blockedDescription: "これらのドメイン（とサブドメイン）へのリンクは、リンクフィルターがオフでもブロックされます。",
    },
    profile: {
      title: "AutoMod — ユーザー名とプロフィールのフィルター",
      description: "表示名、ユーザー名、サーバーニックネーム、自己紹介は、禁止ワードリストと（有効な場合）不適切な言葉フィルターを通過する必要があります。通過しないメンバーは修正するまでメッセージを送信できず、そのようなニックネームやサーバー自己紹介は保存されません。",
    },
    actions: {
      warnTitle: "チャンネル内の警告行",
      warnDescription: "ブロックされたメッセージのチャンネルにAutoModの短い通知が投稿されます（内容は表示されません）。",
      blockMessageTitle: "送信者に表示するメッセージ",
      blockMessageDescription: "空欄にするとルール独自の説明が表示されます。",
      blockMessagePlaceholder: "このメッセージはサーバーのルールに違反しています。",
    },
    exempt: {
      title: "AutoMod — 除外",
      description: "メッセージの管理権限を持つメンバーは常に除外されます。以下のロールとチャンネル（スレッドを含む）もチェックされません。",
      roles: "除外するロール",
      channels: "除外するチャンネル",
      none: "選択なし",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "LIVE",
  settings: {
    hint: "アカウントを連携すると、配信中にプロフィールに「配信中」と表示されます",
    broadcaster: "配信者権限",
    broadcasterHint: "リンクロールがあなたのサブスクライバーを読み取れるようにします",
    grantBroadcaster: "配信者として連携",
    connect: "連携",
    reconnect: "再連携",
    disconnect: "削除",
    disconnected: "{platform}の連携を削除しました。",
    disconnectFailed: "{platform}の連携を削除できませんでした。",
    liveNow: "配信中",
  },
  linkedRoles: {
    title: "リンクロール",
    description: "ロールをTwitchまたはKickチャンネルのサブスクリプションに結び付けます。メンバーがアカウントを連携すると、条件を満たしていれば自動でロールが付与され、サブスクリプションが終了すると外されます（30分ごとに再確認）。設定できるのはサーバーオーナーだけで、自分のチャンネルに限ります。",
    ownerOnly: "リンクロールを管理できるのはサーバーオーナーだけです。",
    role: "ロール",
    platform: "プラットフォーム",
    requirement: "条件",
    subscriber: "自分のチャンネルをサブスクライブしている",
    follower: "自分のチャンネルをフォローしている",
    followerTwitchOnly: "フォロワー条件はTwitchのみ対応です（Kickはフォロー解除を通知しないため）。",
    add: "リンク",
    remove: "削除",
    empty: "まだリンクロールはありません。",
    loading: "読み込み中…",
    needsBroadcaster: "先に「設定 → プロフィール → 連携」の「配信者として連携」で{platform}アカウントを連携してください。",
    created: "リンクロールを作成しました。",
    createFailed: "リンクロールを作成できませんでした。",
    removeFailed: "リンクロールを削除できませんでした。",
    granted: "メンバー{count}人",
    lastSynced: "最終確認: {time}",
    selectRole: "ロールを選択",
  },

} satisfies Translation<typeof streamingTr>;
