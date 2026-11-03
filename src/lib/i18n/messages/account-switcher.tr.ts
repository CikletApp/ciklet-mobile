/**
 * Hesap değiştirici (Discord "Hesap Değiştir") arayüz metinleri — kullanıcı
 * menüsü, "Hesapları yönet" penceresi, giriş ekranındaki kayıtlı hesaplar.
 * Türkçe kaynak; İngilizcesi account-switcher.en.ts (aynı şekil zorunlu).
 * Mobil (ciklet-mobile) aynı metinleri kullanır.
 */
export const accountSwitcherTr = {
  menuItem: "Hesap Değiştir",
  manage: "Hesapları Yönet",
  add: "Hesap Ekle",
  title: "Hesapları Yönet",
  description: "Bu cihazda en fazla {max} hesap arasında yeniden giriş yapmadan geçiş yap.",
  current: "Etkin hesap",
  switch: "Geçiş Yap",
  switching: "Geçiş yapılıyor…",
  remove: "Çıkar",
  removeConfirm: "{name} bu cihazın hesap listesinden çıkarılsın mı? Tekrar geçmek için yeniden giriş yapman gerekir.",
  needsLogin: "Yeniden giriş gerekli",
  limitReached: "En fazla {max} hesap eklenebilir. Yeni hesap eklemek için birini çıkar.",
  failed: "Hesap değiştirilemedi. Tekrar dene.",
  notFound: "Bu hesap artık listede değil.",
  removed: "Hesap listeden çıkarıldı.",
  addTitle: "Hesap ekle",
  addDescription: "Eklemek istediğin hesapla giriş yap. Şu anki hesabın listede kalır.",
  addCancel: "Vazgeç",
  savedTitle: "Kayıtlı hesaplar",
  savedDescription: "Bu cihazda daha önce kullandığın hesaplardan birine geç.",
  orSignIn: "ya da başka bir hesapla giriş yap",
  inCallWarning: "Hesap değiştirince sesli bağlantın kesilir.",
} as const;
