type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
import type { questsTr } from "./quests.tr";

/** English for quests.tr.ts. */
export const questsEn = {
  title: "Quests",
  subtitle: "Play, chat, explore — completed quests earn you Ciklet and rewards.",
  balance: "Your Ciklet balance",
  lifetime: "Total earned: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet points are an in-app currency used only inside the app: they have no real-money value, cannot be converted to Turkish lira (TL) or any other currency, cannot be sold and cannot be transferred to anyone else. Ciklet points can only be spent on profile items in the Shop.",
  goStore: "Go to Shop",
  loading: "Loading quests…",
  loadError: "Couldn't load quests.",
  empty: "No quests are open right now. New ones will show up here soon.",
  tabs: {
    open: "Open quests",
    done: "Completed",
  },
  kind: {
    playGame: "Play {game} for {minutes} minutes",
    voice: "Spend {minutes} minutes in a voice channel",
    activity: "Spend {minutes} minutes in the {app} activity",
    activityAny: "Spend {minutes} minutes in an activity app",
    createServer: "Create your first server",
    inviteFriend: "Bring {count} people to your server with your invite link",
    streakDay: "{count} days in a row: {source} for {minutes} minutes each day",
    streakWeek: "{count} weeks in a row: {source} for {minutes} minutes each week",
  },
  source: {
    voice: "hang out in voice",
    game: "play {game}",
    activity: "use an activity app",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} days",
    weeks: "{value} / {target} weeks",
  },
  action: {
    enroll: "Accept quest",
    claim: "Claim reward",
    claimed: "Claimed",
    inProgress: "In progress",
    expired: "Expired",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days} days of Mentol {plan}",
    item: "{name}",
  },
  sponsor: "Presented by {name}",
  endsAt: "Ends: {date}",
  noEnd: "No end date",
  claimUntil: "Claim by {date}",
  toast: {
    enrolled: "Quest accepted — progress starts counting now.",
    claimed: "Reward claimed!",
    alreadyClaimed: "You already claimed this reward.",
    itemOwned: "You already owned the reward item; Ciklet and other rewards were added.",
    failed: "Something went wrong.",
  },
  how: {
    title: "How is progress counted?",
    enroll: "Progress counts from the moment you accept a quest, never before.",
    game: "Game time comes from the activity history reported by the desktop app.",
    voice: "Voice time only counts while at least two people are in the channel.",
    once: "Each quest's reward can be claimed once per account.",
  },
  store: {
    buyWithPoints: "Get for {points} Ciklet",
    notEnough: "Needs {points} Ciklet",
    bought: "Got {name} with Ciklet",
    earn: "Earn Ciklet with quests",
  },
} satisfies Widen<typeof questsTr>;
