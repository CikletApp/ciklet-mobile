import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Etiqueta del servidor {server}",
    generic: "Etiqueta del servidor",
  },
  settings: {
    title: "Etiqueta del servidor",
    description: "Los miembros pueden mostrar esta etiqueta junto a su nombre. Elige de 2 a 4 letras o números y una insignia de emoji.",
    tagLabel: "Etiqueta",
    tagPlaceholder: "ETIQ",
    tagHint: "De 2 a 4 letras o números",
    badgeLabel: "Insignia",
    badgeHint: "Un solo emoji",
    badgeClear: "Quitar insignia",
    badgePick: "Elegir emoji",
    preview: "Vista previa",
    previewName: "Usuario",
    enabledLabel: "Permitir que los miembros usen la etiqueta",
    enabledDesc: "Mientras esté desactivada, la etiqueta no se muestra en ningún sitio.",
    needTag: "Define una etiqueta antes de activarla.",
    invalidTag: "La etiqueta debe tener de 2 a 4 letras o números.",
    save: "Guardar",
    saved: "Etiqueta del servidor guardada.",
    saveFailed: "No se ha podido guardar la etiqueta del servidor.",
  },
  profile: {
    title: "Etiqueta del servidor",
    description: "Elige la etiqueta de servidor que se muestra junto a tu nombre. Solo aparecen los servidores que tienen su etiqueta activada.",
    none: "Ninguna",
    empty: "No estás en ningún servidor cuya etiqueta puedas usar.",
    selected: "Seleccionada",
    updated: "Se ha actualizado tu etiqueta de servidor.",
    removed: "Se ha quitado tu etiqueta de servidor.",
    failed: "No se ha podido cambiar tu etiqueta de servidor.",
  },
  menu: {
    adopt: "Adoptar etiqueta",
    remove: "Quitar etiqueta",
  },
} satisfies Translation<typeof serverTagTr>;
