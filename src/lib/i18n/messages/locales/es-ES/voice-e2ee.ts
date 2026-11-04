import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Cifrado de extremo a extremo",
    connecting: "Configurando el cifrado…",
    mixed: "Hay un participante sin cifrado",
    unsupported: "Conexión sin cifrar",
  },
  title: "Cifrado de extremo a extremo",
  body: {
    encrypted:
      "Tu voz, tu vídeo y tu pantalla compartida solo se descifran en los dispositivos de las personas de esta llamada. Nadie más, ni siquiera los servidores de Ciklet, puede ver el contenido.",
    connecting: "Intercambiando claves de cifrado con los participantes.",
    mixed:
      "Algunos participantes usan una versión sin cifrado de extremo a extremo. Su audio se envía sin cifrar y no pueden oír a los participantes cifrados.",
    unsupported:
      "Este dispositivo o navegador no admite el cifrado de extremo a extremo: tu audio se envía sin cifrar y no puedes oír a los participantes cifrados. Actualiza Ciklet o usa una versión actual de Chrome, Edge, Firefox o Safari.",
  },
  code: {
    title: "Código de privacidad de voz",
    help: "Compara este código con los demás participantes (por ejemplo, leyéndolo en voz alta). Si todos ven el mismo código, la llamada está cifrada de extremo a extremo y nadie está escuchando en medio. El código cambia cuando alguien entra o sale.",
    copy: "Copiar código",
    copied: "Código copiado",
    waiting: "El código aparecerá cuando las claves estén listas.",
  },
  unencrypted: {
    title: "Participantes sin cifrado",
    badge: "Participante sin cifrado",
  },
  pending: "Esperando el cifrado",
} satisfies Translation<typeof voiceE2eeTr>;
