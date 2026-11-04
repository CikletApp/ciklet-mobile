import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** pt-BR — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Missões",
  subtitle: "Jogue, converse, explore — missões concluídas rendem Ciklet e recompensas.",
  balance: "Seu saldo de Ciklet",
  lifetime: "Total ganho: {points}",
  unit: "Ciklet",
  disclaimer:
    "Os pontos Ciklet são uma moeda interna usada só dentro do app: não têm valor em dinheiro real, não podem ser convertidos em liras turcas (TL) nem em qualquer outra moeda, não podem ser vendidos e não podem ser transferidos para outra pessoa. Os pontos Ciklet só podem ser gastos em itens de perfil na Loja.",
  goStore: "Ir para a Loja",
  loading: "Carregando missões…",
  loadError: "Não foi possível carregar as missões.",
  empty: "Nenhuma missão aberta no momento. Novas missões vão aparecer aqui em breve.",
  tabs: {
    open: "Missões abertas",
    done: "Concluídas",
  },
  kind: {
    playGame: "Jogue {game} por {minutes, plural, one {# minuto} many {# minutos} other {# minutos}}",
    voice: "Passe {minutes, plural, one {# minuto} many {# minutos} other {# minutos}} em um canal de voz",
    activity: "Passe {minutes, plural, one {# minuto} many {# minutos} other {# minutos}} na atividade {app}",
    activityAny: "Passe {minutes, plural, one {# minuto} many {# minutos} other {# minutos}} em um app de atividade",
    createServer: "Crie seu primeiro servidor",
    inviteFriend: "{count, plural, one {Traga # pessoa para o seu servidor com o seu link de convite} many {Traga # pessoas para o seu servidor com o seu link de convite} other {Traga # pessoas para o seu servidor com o seu link de convite}}",
    streakDay: "{count, plural, one {# dia seguido} many {# dias seguidos} other {# dias seguidos}}: {source} por {minutes} minutos todo dia",
    streakWeek: "{count, plural, one {# semana seguida} many {# semanas seguidas} other {# semanas seguidas}}: {source} por {minutes} minutos toda semana",
  },
  source: {
    voice: "ficar no canal de voz",
    game: "jogar {game}",
    activity: "usar um app de atividade",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} dias",
    weeks: "{value} / {target} semanas",
  },
  action: {
    enroll: "Aceitar missão",
    claim: "Resgatar recompensa",
    claimed: "Resgatada",
    inProgress: "Em andamento",
    expired: "Expirada",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# dia} many {# dias} other {# dias}} de Mentol {plan}",
    item: "{name}",
  },
  sponsor: "Oferecido por {name}",
  endsAt: "Termina em: {date}",
  noEnd: "Sem data de término",
  claimUntil: "Resgate até {date}",
  toast: {
    enrolled: "Missão aceita — o progresso começa a contar agora.",
    claimed: "Recompensa resgatada!",
    alreadyClaimed: "Você já resgatou esta recompensa.",
    itemOwned: "Você já tinha o item da recompensa; os Ciklet e as outras recompensas foram adicionados.",
    failed: "Algo deu errado.",
  },
  how: {
    title: "Como o progresso é contado?",
    enroll: "O progresso conta a partir do momento em que você aceita uma missão, nunca antes.",
    game: "O tempo de jogo vem do histórico de atividades informado pelo app para desktop.",
    voice: "O tempo de voz só conta enquanto houver pelo menos duas pessoas no canal.",
    once: "A recompensa de cada missão pode ser resgatada uma vez por conta.",
  },
  store: {
    buyWithPoints: "Pegar por {points} Ciklet",
    notEnough: "Precisa de {points} Ciklet",
    bought: "Você pegou {name} com Ciklet",
    earn: "Ganhe Ciklet com missões",
  },
} satisfies Translation<typeof questsTr>;
