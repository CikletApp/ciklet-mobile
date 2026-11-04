import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Criptografado de ponta a ponta",
    connecting: "Configurando a criptografia…",
    mixed: "Há um participante sem criptografia",
    unsupported: "Conexão sem criptografia",
  },
  title: "Criptografia de ponta a ponta",
  body: {
    encrypted:
      "Sua voz, seu vídeo e seu compartilhamento de tela só são descriptografados nos dispositivos das pessoas nesta chamada. Ninguém mais, nem mesmo os servidores do Ciklet, consegue ver o conteúdo.",
    connecting: "Trocando chaves de criptografia com os participantes.",
    mixed:
      "Alguns participantes estão usando uma versão sem criptografia de ponta a ponta. O áudio deles é enviado sem criptografia e eles não conseguem ouvir os participantes criptografados.",
    unsupported:
      "Este dispositivo ou navegador não suporta criptografia de ponta a ponta: seu áudio é enviado sem criptografia e você não consegue ouvir os participantes criptografados. Atualize o Ciklet ou use uma versão atual do Chrome, Edge, Firefox ou Safari.",
  },
  code: {
    title: "Código de privacidade de voz",
    help: "Compare este código com os outros participantes (por exemplo, lendo em voz alta). Se todos virem o mesmo código, a chamada está criptografada de ponta a ponta e ninguém está ouvindo no meio do caminho. O código muda quando alguém entra ou sai.",
    copy: "Copiar código",
    copied: "Código copiado",
    waiting: "O código aparece assim que as chaves estiverem prontas.",
  },
  unencrypted: {
    title: "Participantes sem criptografia",
    badge: "Participante sem criptografia",
  },
  pending: "Aguardando criptografia",
} satisfies Translation<typeof voiceE2eeTr>;
