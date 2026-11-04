import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** ja — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "クエスト",
  subtitle: "遊んで、話して、探検しよう — クエストを達成するとCikletと報酬がもらえます。",
  balance: "Ciklet残高",
  lifetime: "累計獲得: {points}",
  unit: "Ciklet",
  disclaimer:
    "Cikletポイントはアプリ内でのみ使用できる通貨です。現金としての価値はなく、トルコリラ（TL）やその他の通貨に換金したり、販売したり、他の人に譲渡したりすることはできません。Cikletポイントはショップのプロフィールアイテムにのみ使用できます。",
  goStore: "ショップへ",
  loading: "クエストを読み込み中…",
  loadError: "クエストを読み込めませんでした。",
  empty: "現在開催中のクエストはありません。新しいクエストがまもなくここに表示されます。",
  tabs: {
    open: "開催中のクエスト",
    done: "達成済み",
  },
  kind: {
    playGame: "{game}を{minutes}分プレイする",
    voice: "ボイスチャンネルで{minutes}分過ごす",
    activity: "{app}アクティビティで{minutes}分過ごす",
    activityAny: "アクティビティアプリで{minutes}分過ごす",
    createServer: "最初のサーバーを作成する",
    inviteFriend: "招待リンクで{count}人をサーバーに招く",
    streakDay: "{count}日連続: 毎日{minutes}分{source}",
    streakWeek: "{count}週連続: 毎週{minutes}分{source}",
  },
  source: {
    voice: "ボイスで過ごす",
    game: "{game}をプレイする",
    activity: "アクティビティアプリを使う",
  },
  progress: {
    minutes: "{value} / {target}分",
    count: "{value} / {target}",
    days: "{value} / {target}日",
    weeks: "{value} / {target}週",
  },
  action: {
    enroll: "クエストを受ける",
    claim: "報酬を受け取る",
    claimed: "受け取り済み",
    inProgress: "進行中",
    expired: "期限切れ",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "Mentol {plan} {days}日分",
    item: "{name}",
  },
  sponsor: "提供: {name}",
  endsAt: "終了: {date}",
  noEnd: "終了日なし",
  claimUntil: "{date}までに受け取ってください",
  toast: {
    enrolled: "クエストを受けました — 今から進捗がカウントされます。",
    claimed: "報酬を受け取りました！",
    alreadyClaimed: "この報酬はすでに受け取っています。",
    itemOwned: "報酬アイテムはすでに所有していたため、Cikletとその他の報酬が追加されました。",
    failed: "問題が発生しました。",
  },
  how: {
    title: "進捗はどのようにカウントされますか？",
    enroll: "進捗はクエストを受けた時点からカウントされ、それ以前の分は含まれません。",
    game: "ゲーム時間は、デスクトップアプリが報告するアクティビティ履歴に基づきます。",
    voice: "ボイスの時間は、チャンネルに2人以上いる間のみカウントされます。",
    once: "各クエストの報酬は、1アカウントにつき1回受け取れます。",
  },
  store: {
    buyWithPoints: "{points} Cikletで入手",
    notEnough: "{points} Cikletが必要です",
    bought: "Cikletで{name}を入手しました",
    earn: "クエストでCikletを獲得",
  },
} satisfies Translation<typeof questsTr>;
