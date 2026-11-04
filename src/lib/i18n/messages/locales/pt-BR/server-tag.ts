import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** pt-BR for server-tag.tr.ts (web `locales/pt-BR/server-tag.ts` ile aynı). */
export const serverTag = {
  pill: {
    tooltip: "Tag do servidor {server}",
    generic: "Tag do servidor",
  },
  settings: {
    title: "Tag do servidor",
    description: "Os membros podem exibir esta tag ao lado do nome. Escolha de 2 a 4 letras ou números e um emblema de emoji.",
    tagLabel: "Tag",
    tagPlaceholder: "TAG",
    tagHint: "De 2 a 4 letras ou números",
    badgeLabel: "Emblema",
    badgeHint: "Um único emoji",
    badgeClear: "Remover emblema",
    badgePick: "Escolher emoji",
    preview: "Prévia",
    previewName: "Usuário",
    enabledLabel: "Permitir que os membros usem a tag",
    enabledDesc: "Enquanto estiver desativada, a tag não aparece em lugar nenhum.",
    needTag: "Defina uma tag antes de ativá-la.",
    invalidTag: "A tag precisa ter de 2 a 4 letras ou números.",
    save: "Salvar",
    saved: "Tag do servidor salva.",
    saveFailed: "Não foi possível salvar a tag do servidor.",
  },
  profile: {
    title: "Tag do servidor",
    description: "Escolha a tag de servidor exibida ao lado do seu nome. Só aparecem servidores com a tag ativada.",
    none: "Nenhuma",
    empty: "Você não está em nenhum servidor cuja tag possa usar.",
    selected: "Selecionada",
    updated: "Sua tag de servidor foi atualizada.",
    removed: "Sua tag de servidor foi removida.",
    failed: "Não foi possível alterar sua tag de servidor.",
  },
  menu: {
    adopt: "Adotar tag",
    remove: "Remover tag",
  },
} satisfies Translation<typeof serverTagTr>;
