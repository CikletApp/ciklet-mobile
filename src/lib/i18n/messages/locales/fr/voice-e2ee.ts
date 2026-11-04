import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Chiffré de bout en bout",
    connecting: "Mise en place du chiffrement…",
    mixed: "Participant non chiffré présent",
    unsupported: "Connexion non chiffrée",
  },
  title: "Chiffrement de bout en bout",
  body: {
    encrypted:
      "Ta voix, ta vidéo et ton partage d’écran ne sont déchiffrés que sur les appareils des personnes de cet appel. Personne d’autre, pas même les serveurs de Ciklet, ne peut voir le contenu.",
    connecting: "Échange des clés de chiffrement avec les participants.",
    mixed:
      "Certains participants utilisent une version sans chiffrement de bout en bout. Leur audio est envoyé sans chiffrement et ils ne peuvent pas entendre les participants chiffrés.",
    unsupported:
      "Cet appareil ou ce navigateur ne prend pas en charge le chiffrement de bout en bout : ton audio est envoyé sans chiffrement et tu ne peux pas entendre les participants chiffrés. Mets à jour Ciklet ou utilise une version récente de Chrome, Edge, Firefox ou Safari.",
  },
  code: {
    title: "Code de confidentialité vocale",
    help: "Compare ce code avec les autres participants (par exemple en le lisant à voix haute). Si tout le monde voit le même code, l’appel est chiffré de bout en bout et personne n’écoute entre vous. Le code change quand quelqu’un rejoint ou quitte l’appel.",
    copy: "Copier le code",
    copied: "Code copié",
    waiting: "Le code apparaît une fois les clés prêtes.",
  },
  unencrypted: {
    title: "Participants non chiffrés",
    badge: "Participant non chiffré",
  },
  pending: "En attente du chiffrement",
} satisfies Translation<typeof voiceE2eeTr>;
