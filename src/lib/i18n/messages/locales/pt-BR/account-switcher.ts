import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Trocar de conta",
  manage: "Gerenciar contas",
  add: "Adicionar uma conta",
  title: "Gerenciar contas",
  description: "Alterne entre até {max} contas neste dispositivo sem precisar entrar de novo.",
  current: "Conta ativa",
  switch: "Trocar",
  switching: "Trocando…",
  remove: "Remover",
  removeConfirm: "Remover {name} da lista de contas deste dispositivo? Você vai precisar entrar de novo para voltar a ela.",
  needsLogin: "Entrar novamente",
  limitReached: "Você pode adicionar até {max} contas. Remova uma para adicionar outra.",
  failed: "Não foi possível trocar de conta. Tente novamente.",
  notFound: "Esta conta não está mais na lista.",
  removed: "Conta removida da lista.",
  addTitle: "Adicionar uma conta",
  addDescription: "Entre com a conta que você quer adicionar. Sua conta atual continua na lista.",
  addCancel: "Cancelar",
  savedTitle: "Contas salvas",
  savedDescription: "Troque para uma conta que você já usou neste dispositivo.",
  orSignIn: "ou entre com outra conta",
  inCallWarning: "Trocar de conta desconecta você do canal de voz.",
} satisfies Translation<typeof accountSwitcherTr>;
