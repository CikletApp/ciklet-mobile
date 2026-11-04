import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Konto wechseln",
  manage: "Konten verwalten",
  add: "Konto hinzufügen",
  title: "Konten verwalten",
  description: "Wechsle auf diesem Gerät zwischen bis zu {max} Konten, ohne dich erneut anzumelden.",
  current: "Aktives Konto",
  switch: "Wechseln",
  switching: "Wird gewechselt …",
  remove: "Entfernen",
  removeConfirm: "{name} aus der Kontoliste dieses Geräts entfernen? Um zurückzuwechseln, musst du dich erneut anmelden.",
  needsLogin: "Erneut anmelden",
  limitReached: "Du kannst bis zu {max} Konten hinzufügen. Entferne eins, um ein weiteres hinzuzufügen.",
  failed: "Konto konnte nicht gewechselt werden. Versuch es noch mal.",
  notFound: "Dieses Konto ist nicht mehr in der Liste.",
  removed: "Konto aus der Liste entfernt.",
  addTitle: "Konto hinzufügen",
  addDescription: "Melde dich mit dem Konto an, das du hinzufügen möchtest. Dein aktuelles Konto bleibt in der Liste.",
  addCancel: "Abbrechen",
  savedTitle: "Gespeicherte Konten",
  savedDescription: "Wechsle zu einem Konto, das du auf diesem Gerät verwendet hast.",
  orSignIn: "oder mit einem anderen Konto anmelden",
  inCallWarning: "Beim Kontowechsel wird deine Sprachverbindung getrennt.",
} satisfies Translation<typeof accountSwitcherTr>;
