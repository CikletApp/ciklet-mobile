import { automod, streaming } from "./automod";
import { safety } from "./safety";
import { voiceE2ee } from "./voice-e2ee";
import { serverGuide } from "./server-guide";
import { serverTag } from "./server-tag";
import { serverBoost } from "./server-boost";
import { accountSwitcher } from "./account-switcher";
import { familyCenter } from "./family-center";
import { gameStats } from "./game-stats";
import { gameDetail } from "./game-detail";
import { compliance } from "./compliance";
import { quests } from "./quests";
import { settingsAccount } from "./settings-account";
import { settingsGeneral } from "./settings-general";
import { settingsMedia } from "./settings-media";
import { liveCaptions, translation } from "./live-language";
import { moreScreens } from "./more-screens";
import { parityScreens } from "./parity-screens";
import type { Messages } from "../../tr";
import type { Translation } from "../../translation";

/** fr sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "Annuler",
    save: "Enregistrer",
    close: "Fermer",
    system: "Système",
    on: "Activé",
    off: "Désactivé",
  },
  tabs: {
    chats: "Discussions",
    servers: "Serveurs",
    notifications: "Notifications",
    me: "Toi",
    unread: "{count, plural, one {{label}, # non lu} many {{label}, # non lus} other {{label}, # non lus}}",
  },
  messagePreview: {
    voice: "🎤 Message vocal",
    voiceWithDuration: "🎤 Message vocal ({duration})",
    activity: "🎮 Activité : {name}",
    activityUnnamed: "🎮 Invitation à une activité",
    image: "📷 Photo",
    video: "🎥 Vidéo",
    gif: "GIF",
    sticker: "Autocollant",
    clip: "🎬 Clip",
    file: "📎 {name}",
    attachment: "📎 Pièce jointe",
  },
  activity: {
    broadcast: {
      live: "En direct",
      game: "Stream {game}",
      liveOn: "En direct sur {platform}",
      title: "Diffusion en direct",
      watch: "Regarder le stream",
    },
  },
  appCommands: {
    commands: "Commandes",
    apps: "Applications",
    optional: "Facultatif",
    required: "Obligatoire",
    true: "Vrai",
    false: "Faux",
    chooseFile: "Choisir un fichier",
    loading: "Chargement…",
    noSuggestions: "Aucune suggestion",
    timedOut: "L’application n’a pas répondu à temps",
    selectUser: "Sélectionne un utilisateur",
    selectRole: "Sélectionne un rôle",
    selectChannel: "Sélectionne un salon",
    selectMentionable: "Sélectionne un utilisateur ou un rôle",
    enterValue: "Saisis une valeur",
    enterNumber: "Saisis un nombre",
    runFailed: "Impossible d’exécuter la commande.",
  },
  messageComponents: {
    choose: "Fais une sélection",
    chooseOption: "Choisis une option",
    search: "Rechercher",
    noResults: "Aucun résultat",
    loading: "Chargement…",
    confirm: "Sélectionner",
    clear: "Effacer",
    selectedCount: "{count, plural, one {# sélectionné} many {# sélectionnés} other {# sélectionnés}}",
    selectRange: "{min} à {max} sélections",
    unknown: "Inconnu",
    botNoResponse: "{name} n’a pas répondu.",
    interactionFailed: "Impossible de lancer l’interaction.",
    formNoResponse: "Le bot n’a pas répondu au formulaire.",
    formFailed: "Impossible d’envoyer le formulaire.",
    formLabel: "Formulaire du bot",
    submit: "Envoyer",
    cancel: "Annuler",
    requiredMark: "Obligatoire",
    uploadFile: "Importer un fichier",
    uploading: "Envoi…",
    uploadFailed: "Impossible d’envoyer le fichier.",
    removeFile: "Retirer",
    fileLimit: "{max, plural, one {Jusqu’à # fichier} many {Jusqu’à # fichiers} other {Jusqu’à # fichiers}}",
    allowedTypes: "Autorisés : {types}",
    fileTypeRejected: "Ce type de fichier n’est pas accepté.",
    download: "Télécharger",
    spoiler: "Spoiler",
    show: "Afficher",
    openImage: "Agrandir l’image",
    attachment: "Pièce jointe",
  },
  settings: {
    title: "Paramètres",
    editProfile: "Modifier ton profil",
    sections: {
      account: "PARAMÈTRES DU COMPTE",
      app: "PARAMÈTRES DE L’APPLICATION",
      support: "ASSISTANCE",
      session: "SESSION",
    },
    rows: {
      account: "Compte",
      mentol: "Mentol",
      privacy: "Confidentialité, données et social",
      friendRequests: "Demandes d’ami",
      authorizedApps: "Applications autorisées",
      voice: "Voix et vidéo",
      appearance: "Apparence",
      chat: "Discussion",
      notifications: "Notifications",
      activity: "Statut d’activité",
      help: "Aide",
      helpSubtitle: "Assistance, commentaires, conditions",
      scanLogin: "Scanner un code",
      scanLoginSubtitle: "Connecte-toi sur ordinateur avec ton téléphone",
    },
    scanLogin: {
      title: "Scanner un code",
      hint: "Cadre l’anneau qui tourne sur l’écran de connexion de l’ordinateur.",
      permissionTitle: "Accès à la caméra nécessaire",
      permissionBody: "Nous avons besoin de la caméra pour lire le code affiché sur ton ordinateur.",
      permissionAction: "Autoriser",
      openSettings: "Ouvrir les paramètres",
      searching: "Recherche d’un code…",
      checking: "Vérification du code…",
      gone: "Ce code a expiré. Attends que l’ordinateur l’actualise et scanne à nouveau.",
      confirmTitle: "Se connecter sur l’ordinateur ?",
      confirmBody: "Si tu n’es pas à l’origine de cette demande, refuse-la. Ne partage jamais le code.",
      device: "Appareil",
      location: "Emplacement",
      ip: "Adresse IP",
      time: "Heure",
      justNow: "À l’instant",
      approve: "Oui, me connecter",
      reject: "Non, ce n’est pas moi",
      approved: "Approuvé. Connexion sur l’ordinateur en cours.",
      rejected: "Refusé. Le code de l’ordinateur va être actualisé.",
      failed: "Impossible d’envoyer l’approbation. Réessaie.",
      unknownLocation: "Inconnu",
    },
    logout: {
      action: "Déconnexion",
      title: "Se déconnecter",
      message: "Tu vas être déconnecté sur cet appareil.",
    },
    memberSince: "Sur Ciklet depuis le {date}",
    appearance: {
      title: "Apparence",
      motion: {
        title: "RÉDUIRE LES ANIMATIONS",
        description:
          "Atténue les transitions, les panneaux coulissants et les animations pulsées. Système suit le réglage d’accessibilité de ton téléphone.",
      },
      language: {
        title: "LANGUE",
        description: "Langue de l’interface. La traduction est en cours ; les textes non traduits s’affichent en anglais ou en turc.",
        system: "Langue de l’appareil ({name})",
        restartRtl: "Ferme puis rouvre l’application pour appliquer le nouveau sens d’écriture.",
      },
    },
    voice: {
      title: "Voix et vidéo",
      inputMode: "MODE D’ENTRÉE",
      vad: "Détection de la voix",
      ptt: "Appuyer pour parler",
      pttHint:
        "Quand Appuyer pour parler est activé, ton micro est coupé au départ dans les salons vocaux ; maintiens le bouton à l’écran pour parler.",
      noise: "SUPPRESSION DU BRUIT",
      noiseOff: "Désactivée",
      noiseStandard: "Standard",
      noiseOffHint: "Ta voix est envoyée sans traitement (instruments, micros de studio).",
      noiseStandardHint: "La suppression du bruit intégrée à ton appareil.",
      noiseAdvancedNote: "La suppression avancée du bruit (RNNoise) n’est disponible que sur le web et l’ordinateur pour l’instant.",
      inputVolume: "VOLUME D’ENTRÉE",
      outputVolume: "VOLUME DE SORTIE",
      deviceNote:
        "Ton téléphone gère automatiquement les périphériques d’entrée et de sortie. Choisis les appareils Bluetooth ou filaires depuis le panneau audio du système.",
    },
    notifications: {
      title: "Notifications",
      permission: "AUTORISATION DES NOTIFICATIONS",
      master: "Notifications Ciklet",
      masterDescription: "Autoriser les notifications sur cet appareil.",
      permissionDenied: "Les notifications sont désactivées dans les paramètres du système.",
      types: "TYPES DE NOTIFICATIONS",
      messages: "Messages et mentions",
      calls: "Appels entrants",
      friends: "Demandes d’ami",
      sounds: "Sons de notification",
      lockScreen: "APPELS SUR L’ÉCRAN DE VERROUILLAGE",
      fullScreenOff: "L’autorisation d’appel en plein écran est désactivée",
      fullScreenBody:
        "Android a besoin d’une autorisation distincte pour sonner en plein écran sur l’écran de verrouillage quand l’application est fermée. Sans elle, les appels s’affichent seulement sous forme de notification.",
      openSettings: "Ouvrir les paramètres",
      overrides: "PARAMÈTRES PERSONNALISÉS DES SERVEURS, SALONS ET DISCUSSIONS",
      overridesEmpty:
        "Aucun paramètre personnalisé pour l’instant. Appuie longuement sur un serveur, un salon ou une discussion et choisis Notifications pour en ajouter un.",
      reset: "Rétablir par défaut",
    },
  },
  automod: automod,
  safety: safety,
  voiceE2ee: voiceE2ee,
  streaming: streaming,
  serverGuide: serverGuide,
  serverTag: serverTag,
  serverBoost: serverBoost,
  /** Hesap değiştirici (web ile aynı anahtarlar) — account-switcher.en.ts. */
  accountSwitcher: accountSwitcher,
  /** Aile Merkezi (web ile aynı anahtarlar) — family-center.en.ts. */
  familyCenter: familyCenter,
  gameStats: gameStats,
  gameDetail: gameDetail,
  compliance: compliance,
  quests: quests,
  settingsAccount: settingsAccount,
  settingsGeneral: settingsGeneral,
  settingsMedia: settingsMedia,
  translation: translation,
  liveCaptions: liveCaptions,
  moreScreens: moreScreens,
  parityScreens: parityScreens,
} satisfies Translation<Messages>;
