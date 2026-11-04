import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Traduzir",
    translating: "Traduzindo…",
    unsupported: "A tradução não é compatível com este navegador",
    unsupportedDevice: "A tradução não é compatível com este dispositivo",
    remove: "Remover tradução",
  },
  footer: {
    translatedFrom: "Traduzido do {language}",
    showOriginal: "Mostrar original",
    showTranslation: "Mostrar tradução",
    dismiss: "Fechar tradução",
    translating: "Traduzindo…",
    downloading: "Baixando o modelo de idioma para o seu dispositivo… {percent}%",
  },
  errors: {
    same: "Esta mensagem já está em {language}.",
    unavailable: "A tradução no dispositivo não está disponível para este par de idiomas.",
    undetected: "Não foi possível detectar o idioma da mensagem.",
    empty: "Não há texto para traduzir.",
    failed: "Não foi possível traduzir.",
  },
  settings: {
    title: "Idioma de destino da tradução",
    description: "“Traduzir” traduz as mensagens para este idioma. A tradução acontece no seu dispositivo; o conteúdo das mensagens nunca é enviado aos servidores do Ciklet.",
    auto: "Idioma da interface ({language})",
    unsupported: "Este navegador não oferece tradução no dispositivo; use uma versão recente do Chrome ou do Edge.",
    unsupportedDevice: "Este dispositivo não oferece tradução no dispositivo.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Legendas",
  title: "Legendas ao vivo",
  publish: {
    label: "Legendar minha fala",
    description: "Sua fala é transcrita no seu dispositivo e enviada só para as pessoas desta chamada. Nenhum áudio é gravado.",
  },
  show: {
    label: "Mostrar legendas",
    description: "A fala dos participantes que ativaram as legendas aparece na parte de baixo da tela.",
  },
  language: "Idioma da fala",
  languageAuto: "Idioma da interface",
  indicator: "Legendas ativadas",
  indicatorHelp: "Esta pessoa está transmitindo a própria fala como legendas.",
  status: {
    listening: "Ouvindo…",
    muted: "Seu microfone está desligado — legendas pausadas.",
    unsupported: "O reconhecimento de fala não é compatível com este dispositivo.",
    denied: "A permissão de microfone ou de reconhecimento de fala não foi concedida.",
    e2eeBlocked: "Este dispositivo não consegue criptografar legendas em uma chamada com criptografia de ponta a ponta; a transmissão de legendas está desligada.",
    e2ee: "As legendas são enviadas com criptografia de ponta a ponta.",
    cloud: "Seu navegador pode usar o próprio serviço de fala para reconhecer o que você diz; o áudio nunca vai para os servidores do Ciklet.",
    onDevice: "O reconhecimento de fala roda no seu dispositivo.",
    error: "O reconhecimento de fala parou.",
  },
  empty: "Nenhuma legenda ainda.",
} satisfies Translation<typeof liveCaptionsTr>;
