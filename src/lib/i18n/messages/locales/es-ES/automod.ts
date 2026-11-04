/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Sin aislamiento",
    s60: "60 segundos",
    m5: "5 minutos",
    m10: "10 minutos",
    h1: "1 hora",
    d1: "1 día",
    w1: "1 semana",
  },
  settings: {
    words: {
      title: "AutoMod — Palabras bloqueadas",
      description: "Sepáralas con comas o saltos de línea; se comparan palabras completas, termina con * para buscar un prefijo. También se detectan los trucos de escritura (letras repetidas, dígitos/símbolos, separadores). Los mensajes que coincidan no se pueden enviar (se eliminan si llegan a través de la pasarela). Hasta {max} palabras.",
      placeholder: "palabra1, palabra2, prefijo*",
      count: "{count, plural, one {# palabra} many {# palabras} other {# palabras}}",
    },
    mentions: {
      title: "AutoMod — Spam de menciones",
      description: "Bloquea un mensaje que etiquete a más de este número de personas o roles distintos. Déjalo vacío para desactivarlo (máx. {max}).",
      off: "Desactivado",
    },
    linkFilter: {
      title: "AutoMod — Filtro de enlaces",
      description: "Si está activado, solo se permiten enlaces a los dominios de abajo (y sus subdominios); los archivos adjuntos siempre están permitidos. Hasta {max} dominios.",
      emptyWarning: "No hay dominios permitidos: se bloquean todos los enlaces.",
    },
    actionsSection: {
      title: "AutoMod — Acciones",
      description: "Un mensaje que incumple una regla siempre se bloquea. Opcionalmente, se aísla temporalmente al autor y se publica el suceso en tu canal de moderación y en el canal del mensaje.",
      timeout: "Aislamiento temporal",
      alertChannel: "Canal de moderación",
      noAlert: "Sin alertas",
    },
    preset: {
      title: "AutoMod — Filtro de lenguaje ofensivo en turco",
      description: "Una lista completa y lista para usar de palabrotas e insultos en turco. También detecta trucos de escritura (letras repetidas, 4→a, 1→ı, 0→o, $→s, separar con puntos o espacios) y no toca palabras inocentes como «sıkıntı», «amaç» o «piknik».",
      enable: "Activar con un clic",
      enabled: "Activado",
      allowTitle: "Palabras permitidas",
      allowDescription: "Palabras que nunca deben detectarse (sepáralas con comas o saltos de línea; termina con * para un prefijo). Se aplica tanto a la lista predefinida como a la lista de palabras bloqueadas.",
      allowPlaceholder: "amina, palabra*",
    },
    spam: {
      title: "AutoMod — Detección de spam",
      description: "Bloquea los mensajes de miembros que envían muchos mensajes en poco tiempo o repiten el mismo contenido.",
      maxMessages: "Máx. de mensajes",
      window: "Intervalo (segundos)",
      duplicates: "Repeticiones del mismo mensaje (60 s)",
    },
    caps: {
      title: "AutoMod — Exceso de mayúsculas",
      description: "Bloquea los mensajes en los que más del porcentaje indicado de letras está en mayúsculas (se excluyen los mensajes cortos).",
      percent: "Porcentaje de mayúsculas (%)",
      minLetters: "Mínimo de letras",
    },
    links: {
      inviteTitle: "Bloquear enlaces de invitación",
      inviteDescription: "No se pueden compartir invitaciones a servidores de Ciklet ni de Discord.",
      blockedTitle: "Dominios bloqueados",
      blockedDescription: "Los enlaces a estos dominios (y subdominios) se bloquean aunque el filtro de enlaces esté desactivado.",
    },
    profile: {
      title: "AutoMod — Filtro de nombre de usuario y perfil",
      description: "El nombre visible, el nombre de usuario, el apodo del servidor y la biografía deben pasar la lista de palabras bloqueadas y (si está activado) el filtro de lenguaje ofensivo. Un miembro que no lo pase no podrá enviar mensajes hasta que lo corrija; esos apodos y biografías del servidor no se guardan.",
    },
    actions: {
      warnTitle: "Aviso en el canal",
      warnDescription: "Se publica un breve aviso de AutoMod en el canal del mensaje bloqueado (no se muestra el contenido).",
      blockMessageTitle: "Mensaje que verá el remitente",
      blockMessageDescription: "Déjalo vacío para mostrar la explicación propia de la regla.",
      blockMessagePlaceholder: "Este mensaje incumple las normas del servidor.",
    },
    exempt: {
      title: "AutoMod — Exenciones",
      description: "Los miembros con el permiso Gestionar mensajes siempre están exentos. Tampoco se revisan estos roles y canales (incluidos sus hilos).",
      roles: "Roles exentos",
      channels: "Canales exentos",
      none: "Ninguno seleccionado",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "EN DIRECTO",
  settings: {
    hint: "Conecta tu cuenta para mostrar «En directo» en tu perfil mientras retransmites",
    broadcaster: "Permisos de creador",
    broadcasterHint: "Permite que los roles vinculados lean tus suscriptores",
    grantBroadcaster: "Conectar como creador",
    connect: "Conectar",
    reconnect: "Volver a conectar",
    disconnect: "Quitar",
    disconnected: "Se ha quitado la conexión con {platform}.",
    disconnectFailed: "No se ha podido quitar la conexión con {platform}.",
    liveNow: "En directo ahora",
  },
  linkedRoles: {
    title: "Roles vinculados",
    description: "Vincula un rol a una suscripción a tu canal de Twitch o Kick. Cuando los miembros conectan su cuenta, el rol se concede automáticamente si cumplen los requisitos y se quita cuando termina la suscripción (se vuelve a verificar cada media hora). Solo el propietario del servidor puede configurarlo, para su propio canal.",
    ownerOnly: "Solo el propietario del servidor puede gestionar los roles vinculados.",
    role: "Rol",
    platform: "Plataforma",
    requirement: "Requisito",
    subscriber: "Suscrito a mi canal",
    follower: "Sigue mi canal",
    followerTwitchOnly: "El requisito de seguidor es solo para Twitch (Kick no informa de cuándo se deja de seguir).",
    add: "Vincular",
    remove: "Quitar",
    empty: "Aún no hay roles vinculados.",
    loading: "Cargando…",
    needsBroadcaster: "Primero conecta tu cuenta de {platform} con «Conectar como creador» en Ajustes → Perfil → Conexiones.",
    created: "Rol vinculado creado.",
    createFailed: "No se ha podido crear el rol vinculado.",
    removeFailed: "No se ha podido quitar el rol vinculado.",
    granted: "{count, plural, one {# miembro} many {# miembros} other {# miembros}}",
    lastSynced: "Última verificación: {time}",
    selectRole: "Selecciona un rol",
  },

} satisfies Translation<typeof streamingTr>;
