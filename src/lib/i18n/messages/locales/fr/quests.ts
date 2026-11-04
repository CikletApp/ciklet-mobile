import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** fr — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Quêtes",
  subtitle: "Joue, discute, explore : les quêtes terminées te rapportent des Ciklet et des récompenses.",
  balance: "Ton solde de Ciklet",
  lifetime: "Total gagné : {points}",
  unit: "Ciklet",
  disclaimer:
    "Les points Ciklet sont une monnaie utilisable uniquement dans l’application : ils n’ont aucune valeur en argent réel, ne peuvent pas être convertis en livres turques (TL) ni en aucune autre devise, ne peuvent pas être vendus et ne peuvent pas être transférés à quelqu’un d’autre. Les points Ciklet ne peuvent être dépensés que pour des objets de profil dans la Boutique.",
  goStore: "Aller à la Boutique",
  loading: "Chargement des quêtes…",
  loadError: "Impossible de charger les quêtes.",
  empty: "Aucune quête n’est ouverte pour le moment. De nouvelles quêtes apparaîtront bientôt ici.",
  tabs: {
    open: "Quêtes ouvertes",
    done: "Terminées",
  },
  kind: {
    playGame: "Joue à {game} pendant {minutes} minutes",
    voice: "Passe {minutes} minutes dans un salon vocal",
    activity: "Passe {minutes} minutes dans l’activité {app}",
    activityAny: "Passe {minutes} minutes dans une application d’activité",
    createServer: "Crée ton premier serveur",
    inviteFriend: "{count, plural, one {Fais venir # personne sur ton serveur avec ton lien d’invitation} many {Fais venir # personnes sur ton serveur avec ton lien d’invitation} other {Fais venir # personnes sur ton serveur avec ton lien d’invitation}}",
    streakDay: "{count, plural, one {# jour d’affilée : {source} pendant {minutes} minutes chaque jour} many {# jours d’affilée : {source} pendant {minutes} minutes chaque jour} other {# jours d’affilée : {source} pendant {minutes} minutes chaque jour}}",
    streakWeek: "{count, plural, one {# semaine d’affilée : {source} pendant {minutes} minutes chaque semaine} many {# semaines d’affilée : {source} pendant {minutes} minutes chaque semaine} other {# semaines d’affilée : {source} pendant {minutes} minutes chaque semaine}}",
  },
  source: {
    voice: "passer du temps en vocal",
    game: "jouer à {game}",
    activity: "utiliser une application d’activité",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} jours",
    weeks: "{value} / {target} semaines",
  },
  action: {
    enroll: "Accepter la quête",
    claim: "Récupérer la récompense",
    claimed: "Récupérée",
    inProgress: "En cours",
    expired: "Expirée",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# jour de Mentol {plan}} many {# jours de Mentol {plan}} other {# jours de Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "Présentée par {name}",
  endsAt: "Fin : {date}",
  noEnd: "Pas de date de fin",
  claimUntil: "À récupérer avant le {date}",
  toast: {
    enrolled: "Quête acceptée : la progression commence à être comptée dès maintenant.",
    claimed: "Récompense récupérée !",
    alreadyClaimed: "Tu as déjà récupéré cette récompense.",
    itemOwned: "Tu possédais déjà l’objet de récompense ; les Ciklet et les autres récompenses ont été ajoutés.",
    failed: "Une erreur s’est produite.",
  },
  how: {
    title: "Comment la progression est-elle comptée ?",
    enroll: "La progression est comptée à partir du moment où tu acceptes une quête, jamais avant.",
    game: "Le temps de jeu provient de l’historique d’activité transmis par l’application de bureau.",
    voice: "Le temps en vocal n’est compté que lorsqu’au moins deux personnes sont dans le salon.",
    once: "La récompense de chaque quête ne peut être récupérée qu’une fois par compte.",
  },
  store: {
    buyWithPoints: "Obtenir pour {points} Ciklet",
    notEnough: "Nécessite {points} Ciklet",
    bought: "{name} obtenu avec des Ciklet",
    earn: "Gagne des Ciklet avec les quêtes",
  },
} satisfies Translation<typeof questsTr>;
