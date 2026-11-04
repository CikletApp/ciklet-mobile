import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** ko — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "퀘스트",
  subtitle: "플레이하고, 채팅하고, 탐험하세요 — 퀘스트를 완료하면 Ciklet과 보상을 받아요.",
  balance: "내 Ciklet 잔액",
  lifetime: "총 획득: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet 포인트는 앱 안에서만 사용되는 앱 내 화폐예요. 실제 금전적 가치가 없으며, 튀르키예 리라(TL)나 다른 통화로 환전할 수 없고, 판매하거나 다른 사람에게 양도할 수 없어요. Ciklet 포인트는 상점의 프로필 아이템에만 사용할 수 있어요.",
  goStore: "상점으로 가기",
  loading: "퀘스트 불러오는 중…",
  loadError: "퀘스트를 불러오지 못했어요.",
  empty: "지금은 진행 중인 퀘스트가 없어요. 곧 새로운 퀘스트가 여기에 표시될 거예요.",
  tabs: {
    open: "진행 중인 퀘스트",
    done: "완료됨",
  },
  kind: {
    playGame: "{game}을(를) {minutes}분 동안 플레이하기",
    voice: "음성 채널에서 {minutes}분 보내기",
    activity: "{app} 활동에서 {minutes}분 보내기",
    activityAny: "활동 앱에서 {minutes}분 보내기",
    createServer: "첫 서버 만들기",
    inviteFriend: "초대 링크로 서버에 {count}명 데려오기",
    streakDay: "{count}일 연속: 매일 {minutes}분 동안 {source}",
    streakWeek: "{count}주 연속: 매주 {minutes}분 동안 {source}",
  },
  source: {
    voice: "음성 채널에서 어울리기",
    game: "{game} 플레이하기",
    activity: "활동 앱 사용하기",
  },
  progress: {
    minutes: "{value} / {target}분",
    count: "{value} / {target}",
    days: "{value} / {target}일",
    weeks: "{value} / {target}주",
  },
  action: {
    enroll: "퀘스트 수락",
    claim: "보상 받기",
    claimed: "받음",
    inProgress: "진행 중",
    expired: "만료됨",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "Mentol {plan} {days}일",
    item: "{name}",
  },
  sponsor: "{name} 제공",
  endsAt: "종료: {date}",
  noEnd: "종료일 없음",
  claimUntil: "{date}까지 받기",
  toast: {
    enrolled: "퀘스트를 수락했어요 — 지금부터 진행도가 집계돼요.",
    claimed: "보상을 받았어요!",
    alreadyClaimed: "이미 이 보상을 받았어요.",
    itemOwned: "보상 아이템을 이미 보유하고 있어요. Ciklet과 다른 보상이 추가되었어요.",
    failed: "문제가 발생했어요.",
  },
  how: {
    title: "진행도는 어떻게 집계되나요?",
    enroll: "진행도는 퀘스트를 수락한 순간부터 집계되며, 그 이전은 포함되지 않아요.",
    game: "게임 시간은 데스크톱 앱이 보고하는 활동 기록을 기준으로 해요.",
    voice: "음성 시간은 채널에 최소 두 명이 있을 때만 집계돼요.",
    once: "각 퀘스트의 보상은 계정당 한 번만 받을 수 있어요.",
  },
  store: {
    buyWithPoints: "{points} Ciklet으로 받기",
    notEnough: "{points} Ciklet 필요",
    bought: "Ciklet으로 {name}을(를) 받았어요",
    earn: "퀘스트로 Ciklet 모으기",
  },
} satisfies Translation<typeof questsTr>;
