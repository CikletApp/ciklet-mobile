import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Tag du serveur {server}",
    generic: "Tag de serveur",
  },
  settings: {
    title: "Tag de serveur",
    description: "Les membres peuvent afficher ce tag à côté de leur nom. Choisis 2 à 4 lettres ou chiffres et un badge emoji.",
    tagLabel: "Étiquette",
    tagPlaceholder: "TAG",
    tagHint: "2 à 4 lettres ou chiffres",
    badgeLabel: "Badge",
    badgeHint: "Un seul emoji",
    badgeClear: "Retirer le badge",
    badgePick: "Choisir un emoji",
    preview: "Aperçu",
    previewName: "Utilisateur",
    enabledLabel: "Autoriser les membres à utiliser le tag",
    enabledDesc: "Tant que c’est désactivé, le tag n’apparaît nulle part.",
    needTag: "Définis un tag avant de l’activer.",
    invalidTag: "Le tag doit contenir 2 à 4 lettres ou chiffres.",
    save: "Enregistrer",
    saved: "Tag de serveur enregistré.",
    saveFailed: "Impossible d’enregistrer le tag de serveur.",
  },
  profile: {
    title: "Tag de serveur",
    description: "Choisis le tag de serveur affiché à côté de ton nom. Seuls les serveurs dont le tag est activé sont listés.",
    none: "Aucun",
    empty: "Tu n’es dans aucun serveur dont tu peux utiliser le tag.",
    selected: "Sélectionné",
    updated: "Ton tag de serveur a été mis à jour.",
    removed: "Ton tag de serveur a été retiré.",
    failed: "Impossible de changer ton tag de serveur.",
  },
  menu: {
    adopt: "Adopter le tag",
    remove: "Retirer le tag",
  },
} satisfies Translation<typeof serverTagTr>;
