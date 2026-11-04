import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** es-ES — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Servidores",
  home: "Mensajes directos",
  addServer: "Añadir un servidor",
  discover: "Explorar servidores",
  download: "Descargar aplicaciones",
  newActivity: "Nueva actividad en #{channel}",
  voiceCount: "{count} en voz",
  unread: "{count} sin leer",
  keyboardHint: "Alt+Mayús+Arriba/Abajo para mover",
  folder: {
    defaultName: "Carpeta de servidores",
    aria: "Carpeta {name}, {count} servidores",
    markRead: "Marcar carpeta como leída",
    moveTo: "Mover a:",
    settings: "Ajustes de carpeta",
    closeAll: "Cerrar todas las carpetas",
  },
  move: {
    top: "Arriba del todo",
    up: "Subir uno",
    down: "Bajar uno",
    bottom: "Abajo del todo",
  },
  server: {
    markRead: "Marcar como leído",
    removeFromFolder: "Quitar de la carpeta",
    addToFolder: "Añadir a la carpeta: {name}",
  },
  settings: {
    title: "Ajustes de carpeta",
    name: "Nombre de la carpeta",
    color: "Color de la carpeta",
    customColor: "Color personalizado",
    done: "Listo",
  },
  toast: {
    saveFailed: "No se pudo guardar el orden de servidores; se restauró el diseño anterior.",
    folderSaveFailed: "No se pudieron guardar los ajustes de la carpeta.",
  },
} satisfies Translation<typeof serverRailTr>;
