import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** es-ES — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Crear carpeta",
    settingsTitle: "Ajustes de la carpeta",
    nameLabel: "NOMBRE DE LA CARPETA",
    defaultName: "Carpeta de servidores",
    colorLabel: "COLOR DE LA CARPETA",
    currentColor: "Color seleccionado",
    customColor: "Color personalizado",
    pickServers: "SERVIDORES",
    pickHint: "Elige al menos dos servidores para la carpeta.",
    inFolder: "SERVIDORES EN LA CARPETA ({count})",
    removeServer: "Quitar {name} de la carpeta",
    removeHint: "La carpeta se elimina cuando solo queda un servidor en ella.",
    addServers: "AÑADIR SERVIDORES",
    addServer: "Añadir {name} a la carpeta",
    create: "Crear carpeta",
    done: "Listo",
    createFailed: "No se pudo crear la carpeta",
    saveFailed: "No se pudo guardar la carpeta",
    removeFailed: "No se pudo quitar el servidor de la carpeta",
    addFailed: "No se pudo añadir el servidor a la carpeta",
    newFolder: "Crear carpeta",
    openSettings: "Ajustes de la carpeta {name}",
  },
} satisfies Translation<typeof parityScreensTr>;
