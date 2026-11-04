import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Hesabı Dəyiş",
  manage: "Hesabları İdarə Et",
  add: "Hesab Əlavə Et",
  title: "Hesabları İdarə Et",
  description: "Bu cihazda yenidən daxil olmadan ən çox {max} hesab arasında keçid et.",
  current: "Aktiv hesab",
  switch: "Keçid Et",
  switching: "Keçid edilir…",
  remove: "Sil",
  removeConfirm: "{name} bu cihazın hesab siyahısından çıxarılsın? Geri keçmək üçün yenidən daxil olmalı olacaqsan.",
  needsLogin: "Yenidən daxil ol",
  limitReached: "Ən çox {max} hesab əlavə etmək olar. Yeni hesab əlavə etmək üçün birini çıxar.",
  failed: "Hesab dəyişdirilmədi. Yenidən cəhd et.",
  notFound: "Bu hesab artıq siyahıda deyil.",
  removed: "Hesab siyahıdan çıxarıldı.",
  addTitle: "Hesab əlavə et",
  addDescription: "Əlavə etmək istədiyin hesabla daxil ol. Hazırkı hesabın siyahıda qalır.",
  addCancel: "Ləğv et",
  savedTitle: "Yadda saxlanmış hesablar",
  savedDescription: "Bu cihazda əvvəllər istifadə etdiyin hesablardan birinə keç.",
  orSignIn: "və ya başqa hesabla daxil ol",
  inCallWarning: "Hesabı dəyişsən, səsli bağlantın kəsiləcək.",
} satisfies Translation<typeof accountSwitcherTr>;
