import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** fr — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Créer un dossier",
    settingsTitle: "Paramètres du dossier",
    nameLabel: "NOM DU DOSSIER",
    defaultName: "Dossier de serveurs",
    colorLabel: "COULEUR DU DOSSIER",
    currentColor: "Couleur sélectionnée",
    customColor: "Couleur personnalisée",
    pickServers: "SERVEURS",
    pickHint: "Choisis au moins deux serveurs à mettre dans le dossier.",
    inFolder: "SERVEURS DANS LE DOSSIER ({count})",
    removeServer: "Retirer {name} du dossier",
    removeHint: "Le dossier est supprimé lorsqu’il ne contient plus qu’un serveur.",
    addServers: "AJOUTER DES SERVEURS",
    addServer: "Ajouter {name} au dossier",
    create: "Créer le dossier",
    done: "Terminé",
    createFailed: "Impossible de créer le dossier",
    saveFailed: "Impossible d’enregistrer le dossier",
    removeFailed: "Impossible de retirer le serveur du dossier",
    addFailed: "Impossible d’ajouter le serveur au dossier",
    newFolder: "Créer un dossier",
    openSettings: "Paramètres du dossier {name}",
  },
  channelInvites: {
    title: "Invitations",
    subtitle: "Liens d’invitation vers ce salon",
    intro: "Liens d’invitation vers #{channel}. Les personnes qui rejoignent arrivent directement dans ce salon.",
  },
} satisfies Translation<typeof parityScreensTr>;
