import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Traducir",
    translating: "Traduciendo…",
    unsupported: "Este navegador no admite la traducción",
    unsupportedDevice: "Este dispositivo no admite la traducción",
    remove: "Quitar traducción",
  },
  footer: {
    translatedFrom: "Traducido del {language}",
    showOriginal: "Mostrar original",
    showTranslation: "Mostrar traducción",
    dismiss: "Cerrar traducción",
    translating: "Traduciendo…",
    downloading: "Descargando el modelo de idioma en tu dispositivo… {percent} %",
  },
  errors: {
    same: "Este mensaje ya está en {language}.",
    unavailable: "La traducción en el dispositivo no está disponible para este par de idiomas.",
    undetected: "No se ha podido detectar el idioma del mensaje.",
    empty: "No hay texto que traducir.",
    failed: "No se ha podido traducir.",
  },
  settings: {
    title: "Idioma de destino de la traducción",
    description: "«Traducir» traduce los mensajes a este idioma. La traducción se hace en tu dispositivo; el contenido de los mensajes nunca se envía a los servidores de Ciklet.",
    auto: "Idioma de la interfaz ({language})",
    unsupported: "Este navegador no admite la traducción en el dispositivo; usa una versión reciente de Chrome o Edge.",
    unsupportedDevice: "Este dispositivo no admite la traducción en el dispositivo.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Subtítulos",
  title: "Subtítulos en directo",
  publish: {
    label: "Subtitular mi voz",
    description: "Tu voz se transcribe en tu dispositivo y solo se envía a las personas de esta llamada. No se graba audio.",
  },
  show: {
    label: "Mostrar subtítulos",
    description: "Lo que dicen los participantes que han activado los subtítulos aparece en la parte inferior de la pantalla.",
  },
  language: "Idioma hablado",
  languageAuto: "Idioma de la interfaz",
  indicator: "Subtítulos activados",
  indicatorHelp: "Esta persona está emitiendo su voz como subtítulos.",
  status: {
    listening: "Escuchando…",
    muted: "Tu micrófono está desactivado: subtítulos en pausa.",
    unsupported: "Este dispositivo no admite el reconocimiento de voz.",
    denied: "No se ha concedido el permiso del micrófono o del reconocimiento de voz.",
    e2eeBlocked: "Este dispositivo no puede cifrar los subtítulos en una llamada con cifrado de extremo a extremo; la emisión de subtítulos está desactivada.",
    e2ee: "Los subtítulos se envían con cifrado de extremo a extremo.",
    cloud: "Puede que tu navegador use su propio servicio de voz para reconocer lo que dices; el audio nunca llega a los servidores de Ciklet.",
    onDevice: "El reconocimiento de voz se ejecuta en tu dispositivo.",
    error: "El reconocimiento de voz se ha detenido.",
  },
  empty: "Aún no hay subtítulos.",
} satisfies Translation<typeof liveCaptionsTr>;
