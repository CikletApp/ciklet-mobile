import type { accountSwitcherTr } from "./account-switcher.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** English for account-switcher.tr.ts. */
export const accountSwitcherEn = {
  menuItem: "Switch Accounts",
  manage: "Manage Accounts",
  add: "Add an Account",
  title: "Manage Accounts",
  description: "Switch between up to {max} accounts on this device without logging in again.",
  current: "Active account",
  switch: "Switch",
  switching: "Switching…",
  remove: "Remove",
  removeConfirm: "Remove {name} from this device's account list? You'll need to log in again to switch back.",
  needsLogin: "Log in again",
  limitReached: "You can add up to {max} accounts. Remove one to add another.",
  failed: "Couldn't switch accounts. Try again.",
  notFound: "This account is no longer in the list.",
  removed: "Account removed from the list.",
  addTitle: "Add an account",
  addDescription: "Log in with the account you want to add. Your current account stays in the list.",
  addCancel: "Cancel",
  savedTitle: "Saved accounts",
  savedDescription: "Switch to an account you've used on this device.",
  orSignIn: "or log in with another account",
  inCallWarning: "Switching accounts disconnects your voice connection.",
} satisfies Widen<typeof accountSwitcherTr>;
