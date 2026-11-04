/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Sem castigo",
    s60: "60 segundos",
    m5: "5 minutos",
    m10: "10 minutos",
    h1: "1 hora",
    d1: "1 dia",
    w1: "1 semana",
  },
  settings: {
    words: {
      title: "AutoMod — Palavras bloqueadas",
      description: "Separe com vírgulas ou quebras de linha; palavras inteiras são comparadas, termine com * para comparar um prefixo. Truques de escrita também são detectados (letras repetidas, dígitos/símbolos, separadores). Mensagens correspondentes não podem ser enviadas (são removidas se chegarem pelo gateway). Até {max} palavras.",
      placeholder: "palavra1, palavra2, prefixo*",
      count: "{count, plural, one {# palavra} many {# palavras} other {# palavras}}",
    },
    mentions: {
      title: "AutoMod — Spam de menções",
      description: "Bloqueia uma mensagem que marca mais do que este número de pessoas ou cargos diferentes. Deixe vazio para desativar (máx. {max}).",
      off: "Desativado",
    },
    linkFilter: {
      title: "AutoMod — Filtro de links",
      description: "Quando ativado, só são permitidos links para os domínios abaixo (e seus subdomínios); anexos são sempre permitidos. Até {max} domínios.",
      emptyWarning: "Nenhum domínio permitido: todos os links são bloqueados.",
    },
    actionsSection: {
      title: "AutoMod — Ações",
      description: "Uma mensagem que quebra uma regra é sempre bloqueada. Opcionalmente, o autor recebe um castigo e o ocorrido é publicado no seu canal de moderação e no canal da mensagem.",
      timeout: "Castigo",
      alertChannel: "Canal de moderação",
      noAlert: "Sem alertas",
    },
    preset: {
      title: "AutoMod — Filtro de palavrões em turco",
      description: "Uma lista pronta e abrangente de palavrões e insultos em turco. Também detecta truques de escrita (letras repetidas, 4→a, 1→ı, 0→o, $→s, separação com pontos ou espaços) e deixa em paz palavras inocentes como \"sıkıntı\", \"amaç\" ou \"piknik\".",
      enable: "Ativar com um clique",
      enabled: "Ativado",
      allowTitle: "Palavras permitidas",
      allowDescription: "Palavras que nunca devem ser barradas (separe com vírgulas ou quebras de linha; termine com * para um prefixo). Vale tanto para a lista pronta quanto para a lista de palavras bloqueadas.",
      allowPlaceholder: "amina, palavra*",
    },
    spam: {
      title: "AutoMod — Detecção de spam",
      description: "Bloqueia mensagens de membros que enviam muitas mensagens em pouco tempo ou repetem o mesmo conteúdo.",
      maxMessages: "Máximo de mensagens",
      window: "Janela (segundos)",
      duplicates: "Repetições da mesma mensagem (60 s)",
    },
    caps: {
      title: "AutoMod — Excesso de maiúsculas",
      description: "Bloqueia mensagens em que a proporção de letras maiúsculas passa do valor definido (mensagens curtas não contam).",
      percent: "Proporção de maiúsculas (%)",
      minLetters: "Mínimo de letras",
    },
    links: {
      inviteTitle: "Bloquear links de convite",
      inviteDescription: "Convites de servidores do Ciklet e do Discord não podem ser compartilhados.",
      blockedTitle: "Domínios bloqueados",
      blockedDescription: "Links para estes domínios (e subdomínios) são bloqueados mesmo com o filtro de links desativado.",
    },
    profile: {
      title: "AutoMod — Filtro de nome de usuário e perfil",
      description: "O nome de exibição, o nome de usuário, o apelido no servidor e a bio precisam passar pela lista de palavras bloqueadas e (se ativado) pelo filtro de palavrões. Um membro barrado não pode enviar mensagens até corrigir; apelidos e bios de servidor assim não são salvos.",
    },
    actions: {
      warnTitle: "Linha de aviso no canal",
      warnDescription: "Um breve aviso do AutoMod é publicado no canal da mensagem bloqueada (o conteúdo não é exibido).",
      blockMessageTitle: "Mensagem exibida para quem enviou",
      blockMessageDescription: "Deixe vazio para exibir a explicação da própria regra.",
      blockMessagePlaceholder: "Esta mensagem quebra as regras do servidor.",
    },
    exempt: {
      title: "AutoMod — Isenções",
      description: "Membros com Gerenciar mensagens estão sempre isentos. Estes cargos e canais (incluindo seus tópicos) também não são verificados.",
      roles: "Cargos isentos",
      channels: "Canais isentos",
      none: "Nenhum selecionado",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "AO VIVO",
  settings: {
    hint: "Conecte sua conta para mostrar \"Ao vivo\" no seu perfil enquanto você transmite",
    broadcaster: "Permissões de streamer",
    broadcasterHint: "Permite que os cargos vinculados leiam seus inscritos",
    grantBroadcaster: "Conectar como streamer",
    connect: "Conectar",
    reconnect: "Reconectar",
    disconnect: "Remover",
    disconnected: "Conexão com {platform} removida.",
    disconnectFailed: "Não foi possível remover a conexão com {platform}.",
    liveNow: "Ao vivo agora",
  },
  linkedRoles: {
    title: "Cargos vinculados",
    description: "Vincule um cargo a uma inscrição no seu canal da Twitch ou da Kick. Quando os membros conectam a conta, o cargo é concedido automaticamente se eles cumprirem o requisito, e removido quando a inscrição acaba (verificado de novo a cada meia hora). Só o dono do servidor pode configurar isto, para o próprio canal.",
    ownerOnly: "Só o dono do servidor pode gerenciar cargos vinculados.",
    role: "Cargo",
    platform: "Plataforma",
    requirement: "Requisito",
    subscriber: "Inscrito no meu canal",
    follower: "Segue o meu canal",
    followerTwitchOnly: "O requisito de seguidor é só para a Twitch (a Kick não informa quando alguém deixa de seguir).",
    add: "Vincular",
    remove: "Remover",
    empty: "Nenhum cargo vinculado ainda.",
    loading: "Carregando…",
    needsBroadcaster: "Primeiro conecte sua conta de {platform} com \"Conectar como streamer\" em Configurações → Perfil → Conexões.",
    created: "Cargo vinculado criado.",
    createFailed: "Não foi possível criar o cargo vinculado.",
    removeFailed: "Não foi possível remover o cargo vinculado.",
    granted: "{count, plural, one {# membro} many {# membros} other {# membros}}",
    lastSynced: "Última verificação: {time}",
    selectRole: "Selecione um cargo",
  },

} satisfies Translation<typeof streamingTr>;
