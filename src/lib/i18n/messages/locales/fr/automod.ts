/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Pas d’exclusion",
    s60: "60 secondes",
    m5: "5 minutes",
    m10: "10 minutes",
    h1: "1 heure",
    d1: "1 jour",
    w1: "1 semaine",
  },
  settings: {
    words: {
      title: "AutoMod — Mots interdits",
      description: "Sépare par des virgules ou des retours à la ligne ; les mots entiers sont détectés, termine par * pour détecter un préfixe. Les astuces d’écriture sont aussi détectées (lettres répétées, chiffres/symboles, séparateurs). Les messages concernés ne peuvent pas être envoyés (ils sont supprimés s’ils passent par la passerelle). Jusqu’à {max} mots.",
      placeholder: "mot1, mot2, préfixe*",
      count: "{count, plural, one {# mot} many {# mots} other {# mots}}",
    },
    mentions: {
      title: "AutoMod — Spam de mentions",
      description: "Bloque un message qui mentionne plus que ce nombre de personnes ou de rôles différents. Laisse vide pour désactiver (max. {max}).",
      off: "Désactivé",
    },
    linkFilter: {
      title: "AutoMod — Filtre de liens",
      description: "Lorsqu’il est activé, seuls les liens vers les domaines ci-dessous (et leurs sous-domaines) sont autorisés ; les pièces jointes sont toujours autorisées. Jusqu’à {max} domaines.",
      emptyWarning: "Aucun domaine autorisé : tous les liens sont bloqués.",
    },
    actionsSection: {
      title: "AutoMod — Actions",
      description: "Un message qui enfreint une règle est toujours bloqué. En option, l’auteur est exclu temporairement et l’événement est publié dans ton salon de modération et dans le salon du message.",
      timeout: "Exclusion temporaire",
      alertChannel: "Salon de modération",
      noAlert: "Aucune alerte",
    },
    preset: {
      title: "AutoMod — Filtre d’insultes turques",
      description: "Une liste complète et prête à l’emploi d’insultes et de grossièretés en turc. Elle détecte aussi les astuces d’écriture (lettres répétées, 4→a, 1→ı, 0→o, $→s, séparation par des points ou des espaces) et épargne les mots innocents comme « sıkıntı », « amaç » ou « piknik ».",
      enable: "Activer en un clic",
      enabled: "Activé",
      allowTitle: "Mots autorisés",
      allowDescription: "Mots qui ne doivent jamais être détectés (sépare par des virgules ou des retours à la ligne ; termine par * pour un préfixe). S’applique à la liste prédéfinie et à la liste de mots interdits.",
      allowPlaceholder: "amina, mot*",
    },
    spam: {
      title: "AutoMod — Détection du spam",
      description: "Bloque les messages des membres qui envoient beaucoup de messages en peu de temps ou répètent le même contenu.",
      maxMessages: "Messages max.",
      window: "Fenêtre (secondes)",
      duplicates: "Répétitions du même message (60 s)",
    },
    caps: {
      title: "AutoMod — Abus de majuscules",
      description: "Bloque les messages dont la part de lettres en majuscules dépasse le seuil indiqué (messages courts exclus).",
      percent: "Part de majuscules (%)",
      minLetters: "Nombre minimum de lettres",
    },
    links: {
      inviteTitle: "Bloquer les liens d’invitation",
      inviteDescription: "Les invitations vers des serveurs Ciklet et Discord ne peuvent pas être partagées.",
      blockedTitle: "Domaines bloqués",
      blockedDescription: "Les liens vers ces domaines (et sous-domaines) sont bloqués même si le filtre de liens est désactivé.",
    },
    profile: {
      title: "AutoMod — Filtre de nom d’utilisateur et de profil",
      description: "Le nom d’affichage, le nom d’utilisateur, le pseudo de serveur et la bio doivent passer la liste de mots interdits et (si activé) le filtre d’insultes. Un membre qui échoue ne peut pas envoyer de messages tant qu’il n’a pas corrigé ; ces pseudos et bios de serveur ne sont pas enregistrés.",
    },
    actions: {
      warnTitle: "Ligne d’avertissement dans le salon",
      warnDescription: "Une courte notification AutoMod est publiée dans le salon du message bloqué (le contenu n’est pas affiché).",
      blockMessageTitle: "Message affiché à l’expéditeur",
      blockMessageDescription: "Laisse vide pour afficher l’explication de la règle.",
      blockMessagePlaceholder: "Ce message enfreint les règles du serveur.",
    },
    exempt: {
      title: "AutoMod — Exemptions",
      description: "Les membres ayant la permission Gérer les messages sont toujours exemptés. Ces rôles et salons (y compris leurs fils) ne sont pas non plus vérifiés.",
      roles: "Rôles exemptés",
      channels: "Salons exemptés",
      none: "Aucune sélection",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "EN DIRECT",
  settings: {
    hint: "Connecte ton compte pour afficher « En direct » sur ton profil pendant que tu streames",
    broadcaster: "Autorisations de diffuseur",
    broadcasterHint: "Permet aux rôles liés de lire tes abonnés",
    grantBroadcaster: "Se connecter en tant que diffuseur",
    connect: "Connecter",
    reconnect: "Reconnecter",
    disconnect: "Retirer",
    disconnected: "Connexion {platform} retirée.",
    disconnectFailed: "Impossible de retirer la connexion {platform}.",
    liveNow: "En direct",
  },
  linkedRoles: {
    title: "Rôles liés",
    description: "Associe un rôle à un abonnement à ta chaîne Twitch ou Kick. Quand des membres connectent leur compte, le rôle leur est attribué automatiquement s’ils remplissent la condition, et retiré quand l’abonnement prend fin (nouvelle vérification toutes les demi-heures). Seul le propriétaire du serveur peut configurer cela, pour sa propre chaîne.",
    ownerOnly: "Seul le propriétaire du serveur peut gérer les rôles liés.",
    role: "Rôle",
    platform: "Plateforme",
    requirement: "Condition",
    subscriber: "Abonné à ma chaîne",
    follower: "Suit ma chaîne",
    followerTwitchOnly: "La condition de follow ne fonctionne qu’avec Twitch (Kick ne signale pas les unfollows).",
    add: "Lier",
    remove: "Retirer",
    empty: "Aucun rôle lié pour l’instant.",
    loading: "Chargement…",
    needsBroadcaster: "Connecte d’abord ton compte {platform} avec « Se connecter en tant que diffuseur » dans Paramètres → Profil → Connexions.",
    created: "Rôle lié créé.",
    createFailed: "Impossible de créer le rôle lié.",
    removeFailed: "Impossible de retirer le rôle lié.",
    granted: "{count, plural, one {# membre} many {# membres} other {# membres}}",
    lastSynced: "Dernière vérification : {time}",
    selectRole: "Sélectionne un rôle",
  },

} satisfies Translation<typeof streamingTr>;
