import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Changer de compte",
  manage: "Gérer les comptes",
  add: "Ajouter un compte",
  title: "Gérer les comptes",
  description: "Passe d’un compte à l’autre (jusqu’à {max}) sur cet appareil sans te reconnecter.",
  current: "Compte actif",
  switch: "Changer",
  switching: "Changement…",
  remove: "Retirer",
  removeConfirm: "Retirer {name} de la liste des comptes de cet appareil ? Tu devras te reconnecter pour y revenir.",
  needsLogin: "Se reconnecter",
  limitReached: "Tu peux ajouter jusqu’à {max} comptes. Retires-en un pour en ajouter un autre.",
  failed: "Impossible de changer de compte. Réessaie.",
  notFound: "Ce compte n’est plus dans la liste.",
  removed: "Compte retiré de la liste.",
  addTitle: "Ajouter un compte",
  addDescription: "Connecte-toi avec le compte à ajouter. Ton compte actuel reste dans la liste.",
  addCancel: "Annuler",
  savedTitle: "Comptes enregistrés",
  savedDescription: "Passe à un compte que tu as déjà utilisé sur cet appareil.",
  orSignIn: "ou connecte-toi avec un autre compte",
  inCallWarning: "Changer de compte coupe ta connexion vocale.",
} satisfies Translation<typeof accountSwitcherTr>;
