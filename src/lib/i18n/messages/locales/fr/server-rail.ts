import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** fr — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Serveurs",
  home: "Messages privés",
  addServer: "Ajouter un serveur",
  discover: "Découvrir des serveurs",
  download: "Télécharger les applis",
  newActivity: "Nouvelle activité dans #{channel}",
  voiceCount: "{count} en vocal",
  unread: "{count} non lus",
  keyboardHint: "Alt+Maj+Haut/Bas pour déplacer",
  folder: {
    defaultName: "Dossier de serveurs",
    aria: "Dossier {name}, {count} serveurs",
    markRead: "Marquer le dossier comme lu",
    moveTo: "Déplacer vers :",
    settings: "Paramètres du dossier",
    closeAll: "Fermer tous les dossiers",
  },
  move: {
    top: "Tout en haut",
    up: "Monter d’un cran",
    down: "Descendre d’un cran",
    bottom: "Tout en bas",
  },
  server: {
    markRead: "Marquer comme lu",
    removeFromFolder: "Retirer du dossier",
    addToFolder: "Ajouter au dossier : {name}",
  },
  settings: {
    title: "Paramètres du dossier",
    name: "Nom du dossier",
    color: "Couleur du dossier",
    customColor: "Couleur personnalisée",
    done: "Terminé",
  },
  toast: {
    saveFailed: "Impossible d’enregistrer l’ordre des serveurs ; disposition précédente restaurée.",
    folderSaveFailed: "Impossible d’enregistrer les paramètres du dossier.",
  },
} satisfies Translation<typeof serverRailTr>;
