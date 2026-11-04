import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** pt-BR — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Servidores",
  home: "Mensagens diretas",
  addServer: "Adicionar um servidor",
  discover: "Explorar servidores",
  download: "Baixar aplicativos",
  newActivity: "Nova atividade em #{channel}",
  voiceCount: "{count} na voz",
  unread: "{count} não lidas",
  keyboardHint: "Alt+Shift+Cima/Baixo para mover",
  folder: {
    defaultName: "Pasta de servidores",
    aria: "Pasta {name}, {count} servidores",
    markRead: "Marcar pasta como lida",
    moveTo: "Mover para:",
    settings: "Configurações da pasta",
    closeAll: "Fechar todas as pastas",
  },
  move: {
    top: "Para o topo",
    up: "Subir um",
    down: "Descer um",
    bottom: "Para o fim",
  },
  server: {
    markRead: "Marcar como lido",
    removeFromFolder: "Remover da pasta",
    addToFolder: "Adicionar à pasta: {name}",
  },
  settings: {
    title: "Configurações da pasta",
    name: "Nome da pasta",
    color: "Cor da pasta",
    customColor: "Cor personalizada",
    done: "Concluído",
  },
  toast: {
    saveFailed: "Não foi possível salvar a ordem dos servidores; o layout anterior foi restaurado.",
    folderSaveFailed: "Não foi possível salvar as configurações da pasta.",
  },
} satisfies Translation<typeof serverRailTr>;
