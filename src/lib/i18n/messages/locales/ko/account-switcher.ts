import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "계정 전환",
  manage: "계정 관리",
  add: "계정 추가",
  title: "계정 관리",
  description: "다시 로그인하지 않고 이 기기에서 최대 {max}개의 계정을 전환할 수 있어요.",
  current: "활성 계정",
  switch: "전환",
  switching: "전환 중…",
  remove: "삭제",
  removeConfirm: "이 기기의 계정 목록에서 {name}을(를) 제거할까요? 다시 전환하려면 다시 로그인해야 해요.",
  needsLogin: "다시 로그인",
  limitReached: "계정은 최대 {max}개까지 추가할 수 있어요. 다른 계정을 추가하려면 하나를 제거하세요.",
  failed: "계정을 전환하지 못했어요. 다시 시도해 주세요.",
  notFound: "이 계정은 더 이상 목록에 없어요.",
  removed: "계정을 목록에서 제거했어요.",
  addTitle: "계정 추가",
  addDescription: "추가할 계정으로 로그인하세요. 현재 계정은 목록에 그대로 남아요.",
  addCancel: "취소",
  savedTitle: "저장된 계정",
  savedDescription: "이 기기에서 사용한 계정으로 전환하세요.",
  orSignIn: "또는 다른 계정으로 로그인",
  inCallWarning: "계정을 전환하면 음성 연결이 끊겨요.",
} satisfies Translation<typeof accountSwitcherTr>;
