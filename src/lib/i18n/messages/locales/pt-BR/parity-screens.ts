import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** pt-BR — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Criar pasta",
    settingsTitle: "Configurações da pasta",
    nameLabel: "NOME DA PASTA",
    defaultName: "Pasta de servidores",
    colorLabel: "COR DA PASTA",
    currentColor: "Cor selecionada",
    customColor: "Cor personalizada",
    pickServers: "SERVIDORES",
    pickHint: "Escolha pelo menos dois servidores para a pasta.",
    inFolder: "SERVIDORES NA PASTA ({count})",
    removeServer: "Remover {name} da pasta",
    removeHint: "A pasta é removida quando sobra apenas um servidor nela.",
    addServers: "ADICIONAR SERVIDORES",
    addServer: "Adicionar {name} à pasta",
    create: "Criar pasta",
    done: "Concluído",
    createFailed: "Não foi possível criar a pasta",
    saveFailed: "Não foi possível salvar a pasta",
    removeFailed: "Não foi possível remover o servidor da pasta",
    addFailed: "Não foi possível adicionar o servidor à pasta",
    newFolder: "Criar pasta",
    openSettings: "Configurações da pasta {name}",
  },
} satisfies Translation<typeof parityScreensTr>;
