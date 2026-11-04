import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Van account wisselen",
  manage: "Accounts beheren",
  add: "Een account toevoegen",
  title: "Accounts beheren",
  description: "Wissel op dit apparaat tussen maximaal {max} accounts zonder opnieuw in te loggen.",
  current: "Actief account",
  switch: "Wisselen",
  switching: "Bezig met wisselen…",
  remove: "Verwijderen",
  removeConfirm: "{name} verwijderen uit de accountlijst van dit apparaat? Je moet opnieuw inloggen om terug te wisselen.",
  needsLogin: "Opnieuw inloggen",
  limitReached: "Je kunt maximaal {max} accounts toevoegen. Verwijder er een om een ander toe te voegen.",
  failed: "Kon niet van account wisselen. Probeer het opnieuw.",
  notFound: "Dit account staat niet meer in de lijst.",
  removed: "Account verwijderd uit de lijst.",
  addTitle: "Een account toevoegen",
  addDescription: "Log in met het account dat je wilt toevoegen. Je huidige account blijft in de lijst staan.",
  addCancel: "Annuleren",
  savedTitle: "Opgeslagen accounts",
  savedDescription: "Wissel naar een account dat je op dit apparaat hebt gebruikt.",
  orSignIn: "of log in met een ander account",
  inCallWarning: "Als je van account wisselt, wordt je spraakverbinding verbroken.",
} satisfies Translation<typeof accountSwitcherTr>;
