import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Cambiar de cuenta",
  manage: "Gestionar cuentas",
  add: "Añadir una cuenta",
  title: "Gestionar cuentas",
  description: "Cambia entre hasta {max} cuentas en este dispositivo sin volver a iniciar sesión.",
  current: "Cuenta activa",
  switch: "Cambiar",
  switching: "Cambiando…",
  remove: "Quitar",
  removeConfirm: "¿Quitar a {name} de la lista de cuentas de este dispositivo? Tendrás que volver a iniciar sesión para cambiar a ella.",
  needsLogin: "Vuelve a iniciar sesión",
  limitReached: "Puedes añadir hasta {max} cuentas. Quita una para añadir otra.",
  failed: "No se ha podido cambiar de cuenta. Inténtalo de nuevo.",
  notFound: "Esta cuenta ya no está en la lista.",
  removed: "Cuenta quitada de la lista.",
  addTitle: "Añadir una cuenta",
  addDescription: "Inicia sesión con la cuenta que quieres añadir. Tu cuenta actual se queda en la lista.",
  addCancel: "Cancelar",
  savedTitle: "Cuentas guardadas",
  savedDescription: "Cambia a una cuenta que hayas usado en este dispositivo.",
  orSignIn: "o inicia sesión con otra cuenta",
  inCallWarning: "Al cambiar de cuenta se desconectará tu conexión de voz.",
} satisfies Translation<typeof accountSwitcherTr>;
