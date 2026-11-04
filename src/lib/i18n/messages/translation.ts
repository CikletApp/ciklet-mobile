/**
 * Ek dillerin (messages/locales/<dil>/) şekli: kaynakla (tr.ts) aynı ağaç,
 * her anahtar isteğe bağlı — tr/en'e anahtar eklemek diğer dilleri derleme
 * hatasına sokmaz; eksik anahtar çalışma zamanında İngilizceye düşer.
 * Anahtar / yer tutucu eşitliğini `npm run check:i18n` denetler.
 */
export type Translation<T> = { [K in keyof T]?: T[K] extends string ? string : Translation<T[K]> };
