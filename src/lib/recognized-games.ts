/**
 * "Ciklet'in tanıdığı" oyun / program — ciklet-web `lib/recognized-games.ts`
 * ve `lib/game-names.ts` (`normalizeGameName`) ile BİREBİR aynı kural. SAF
 * modül, içe aktarma yok (`scripts/verify-local-store.mjs` ile doğrulanır).
 *
 * Masaüstü kabuğu kullanıcının kendi eklediği bir uygulamayı da etkinlik
 * olarak bildirebiliyor; adı keyfi, içeriği Ciklet'in incelemediği bir şey
 * olabilir. Bu yüzden oyun/program kovasındaki (PLAYING, COMPETING,
 * WORKING, CREATING) canlı etkinlik ancak TANINIYORSA görünür: anahtarı
 * `GET /api/games/recognized` kümesinde olmalı. Müzik / video / yayın
 * (LISTENING, WATCHING, STREAMING) bu kurala tabi değil.
 *
 * Ham etkinlik presence deposunda olduğu gibi tutulur; süzme seçim/çizim
 * anında yapılır (küme sonradan gelince önceden alınmış etkinlikler de
 * görünür). Profil kartındaki koleksiyon ve son etkinlikler sunucuda süzülü.
 */

const RECOGNITION_TYPES = new Set(["PLAYING", "COMPETING", "WORKING", "CREATING"]);

export type RecognizedSet = ReadonlySet<string>;

/** Web `normalizeGameName`: ™®© atılır, aksanlar sökülür, harf/rakam dışı tek boşluk. */
export function normalizeGameName(name: string): string {
  return name
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Eşleşme anahtarı: katalog "VALORANT", bildirim "Valorant™" olabilir.
 * Latin dışı ad normalize edilince boş kalır; o zaman küçük harfli ham ad.
 */
export function recognitionKey(name: string): string {
  return normalizeGameName(name) || name.trim().toLowerCase();
}

/** Bu tür tanınma kuralına tabi mi (oyun / program kovası). */
export function requiresRecognition(type: string | null | undefined): boolean {
  return RECOGNITION_TYPES.has(type ?? "");
}

/**
 * Etkinlik gösterilebilir mi. Kural dışı türler hep gösterilir; küme henüz
 * yüklenmediyse (`null`) oyun kovası GİZLİ kalır — tanınmayan bir ad bir
 * anlığına bile sızmasın.
 */
export function isRecognizedGame(recognized: RecognizedSet | null, name: string, type: string | null | undefined): boolean {
  if (!requiresRecognition(type)) return true;
  if (!recognized || !name) return false;
  return recognized.has(recognitionKey(name));
}

/**
 * Görünür etkinlik: tanınmayan oyun/program null olur. Yayına eklenen oyun
 * (`game`) da aynı kurala tabi: tanınmıyorsa yayın kalır, oyun alanları
 * düşer (ciklet-web hooks/use-rich-presence `visibleActivity` ile aynı).
 */
export function visibleActivity<T extends { name: string; type?: string | null; game?: string | null; gameIconUrl?: string | null }>(
  activity: T | null | undefined,
  recognized: RecognizedSet | null
): T | null {
  if (!activity) return null;
  if (!isRecognizedGame(recognized, activity.name, activity.type)) return null;
  if (activity.game === undefined && activity.gameIconUrl === undefined) return activity;
  if (typeof activity.game === "string" && isRecognizedGame(recognized, activity.game, "PLAYING")) return activity;
  const { game: _game, gameIconUrl: _icon, ...rest } = activity;
  return rest as T;
}

/** `GET /api/games/recognized` yanıtı → küme (bozuk girdiler atlanır). */
export function parseRecognizedKeys(body: unknown): Set<string> {
  const keys = (body as { keys?: unknown } | null | undefined)?.keys;
  return new Set(Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : []);
}
