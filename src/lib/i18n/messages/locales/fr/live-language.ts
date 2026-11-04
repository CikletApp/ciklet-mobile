import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Traduire",
    translating: "Traduction…",
    unsupported: "La traduction n’est pas prise en charge par ce navigateur",
    unsupportedDevice: "La traduction n’est pas prise en charge sur cet appareil",
    remove: "Retirer la traduction",
  },
  footer: {
    translatedFrom: "Traduit depuis : {language}",
    showOriginal: "Afficher l’original",
    showTranslation: "Afficher la traduction",
    dismiss: "Fermer la traduction",
    translating: "Traduction…",
    downloading: "Téléchargement du modèle de langue sur ton appareil… {percent} %",
  },
  errors: {
    same: "Ce message est déjà en {language}.",
    unavailable: "La traduction sur l’appareil n’est pas disponible pour cette paire de langues.",
    undetected: "Impossible de détecter la langue du message.",
    empty: "Il n’y a aucun texte à traduire.",
    failed: "Impossible de traduire.",
  },
  settings: {
    title: "Langue cible de traduction",
    description: "« Traduire » traduit les messages dans cette langue. La traduction se fait sur ton appareil ; le contenu des messages n’est jamais envoyé aux serveurs de Ciklet.",
    auto: "Langue de l’interface ({language})",
    unsupported: "Ce navigateur ne prend pas en charge la traduction sur l’appareil ; utilise une version récente de Chrome ou d’Edge.",
    unsupportedDevice: "Cet appareil ne prend pas en charge la traduction sur l’appareil.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Sous-titres",
  title: "Sous-titres en direct",
  publish: {
    label: "Sous-titrer ma voix",
    description: "Ta voix est transcrite sur ton appareil et envoyée uniquement aux personnes de cet appel. Aucun son n’est enregistré.",
  },
  show: {
    label: "Afficher les sous-titres",
    description: "Les paroles des participants qui ont activé les sous-titres s’affichent en bas de l’écran.",
  },
  language: "Langue parlée",
  languageAuto: "Langue de l’interface",
  indicator: "Sous-titres activés",
  indicatorHelp: "Cette personne diffuse sa voix en sous-titres.",
  status: {
    listening: "Écoute…",
    muted: "Ton micro est coupé — sous-titres en pause.",
    unsupported: "La reconnaissance vocale n’est pas prise en charge sur cet appareil.",
    denied: "L’autorisation du micro ou de la reconnaissance vocale n’a pas été accordée.",
    e2eeBlocked: "Cet appareil ne peut pas chiffrer les sous-titres dans un appel chiffré de bout en bout ; la diffusion des sous-titres est désactivée.",
    e2ee: "Les sous-titres sont envoyés chiffrés de bout en bout.",
    cloud: "Ton navigateur peut utiliser son propre service vocal pour reconnaître ta voix ; l’audio n’est jamais envoyé aux serveurs de Ciklet.",
    onDevice: "La reconnaissance vocale s’effectue sur ton appareil.",
    error: "La reconnaissance vocale s’est arrêtée.",
  },
  empty: "Pas encore de sous-titres.",
} satisfies Translation<typeof liveCaptionsTr>;
