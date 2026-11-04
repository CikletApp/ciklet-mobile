import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** es-ES — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Misiones",
  subtitle: "Juega, chatea, explora: las misiones completadas te dan Ciklet y recompensas.",
  balance: "Tu saldo de Ciklet",
  lifetime: "Total ganado: {points}",
  unit: "Ciklet",
  disclaimer:
    "Los puntos Ciklet son una moneda que solo se usa dentro de la aplicación: no tienen valor en dinero real, no se pueden convertir a liras turcas (TL) ni a ninguna otra moneda, no se pueden vender y no se pueden transferir a nadie. Los puntos Ciklet solo se pueden gastar en artículos de perfil de la Tienda.",
  goStore: "Ir a la Tienda",
  loading: "Cargando misiones…",
  loadError: "No se han podido cargar las misiones.",
  empty: "Ahora mismo no hay misiones disponibles. Pronto aparecerán nuevas aquí.",
  tabs: {
    open: "Misiones disponibles",
    done: "Completadas",
  },
  kind: {
    playGame: "Juega a {game} durante {minutes} minutos",
    voice: "Pasa {minutes} minutos en un canal de voz",
    activity: "Pasa {minutes} minutos en la actividad {app}",
    activityAny: "Pasa {minutes} minutos en una aplicación de actividad",
    createServer: "Crea tu primer servidor",
    inviteFriend: "{count, plural, one {Trae a # persona a tu servidor con tu enlace de invitación} many {Trae a # personas a tu servidor con tu enlace de invitación} other {Trae a # personas a tu servidor con tu enlace de invitación}}",
    streakDay: "{count, plural, one {# día seguido} many {# días seguidos} other {# días seguidos}}: {source} durante {minutes} minutos cada día",
    streakWeek: "{count, plural, one {# semana seguida} many {# semanas seguidas} other {# semanas seguidas}}: {source} durante {minutes} minutos cada semana",
  },
  source: {
    voice: "pasar el rato en voz",
    game: "jugar a {game}",
    activity: "usar una aplicación de actividad",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} días",
    weeks: "{value} / {target} semanas",
  },
  action: {
    enroll: "Aceptar misión",
    claim: "Reclamar recompensa",
    claimed: "Reclamada",
    inProgress: "En curso",
    expired: "Caducada",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# día de Mentol {plan}} many {# días de Mentol {plan}} other {# días de Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "Presentada por {name}",
  endsAt: "Termina: {date}",
  noEnd: "Sin fecha de fin",
  claimUntil: "Reclámala antes del {date}",
  toast: {
    enrolled: "Misión aceptada: el progreso empieza a contar ahora.",
    claimed: "¡Recompensa reclamada!",
    alreadyClaimed: "Ya has reclamado esta recompensa.",
    itemOwned: "Ya tenías el artículo de la recompensa; se han añadido los Ciklet y las demás recompensas.",
    failed: "Algo ha salido mal.",
  },
  how: {
    title: "¿Cómo se cuenta el progreso?",
    enroll: "El progreso cuenta desde el momento en que aceptas una misión, nunca antes.",
    game: "El tiempo de juego sale del historial de actividad que envía la aplicación de escritorio.",
    voice: "El tiempo en voz solo cuenta mientras haya al menos dos personas en el canal.",
    once: "La recompensa de cada misión se puede reclamar una vez por cuenta.",
  },
  store: {
    buyWithPoints: "Conseguir por {points} Ciklet",
    notEnough: "Necesitas {points} Ciklet",
    bought: "Has conseguido {name} con Ciklet",
    earn: "Gana Ciklet con misiones",
  },
} satisfies Translation<typeof questsTr>;
