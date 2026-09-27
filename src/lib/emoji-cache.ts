import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

/**
 * Emoji görsellerinin KALICI yerel kopyası (Twemoji ve Dokimorji).
 *
 * Neden: görseller yalnızca expo-image'ın ağ önbelleğindeydi. O önbellek
 * uygulamanın geçici klasöründe duruyor; sistem yer açarken siliyor ve her
 * açılışta emojiler yeniden "iniyormuş" gibi boş kutu olarak başlıyordu.
 * Artık her emoji ilk görüldüğünde bir kez belgeler klasörüne (sistemin
 * kendiliğinden silmediği yer) yazılır; sonraki açılışlarda ağa hiç çıkmadan
 * oradan okunur.
 *
 * Dosya adı adresin kendisinden türetilir; Twemoji sürümü adreste olduğundan
 * sürüm değişince yeni dosyalar iner, eskiler karışmaz. Klasörün listesi
 * açılışta BİR KEZ okunur (senkron, birkaç ms); sonrası bellekteki kümeden.
 */

const FOLDER = "emoji";
const PARALLEL = 4;

let folder: Directory | null = null;
let folderUri = "";
let stored: Set<string> | null = null;
const waiting: { url: string; name: string }[] = [];
const scheduled = new Set<string>();
let running = 0;

/** "https://cdn…/72x72/1f600.png" → "cdn…_72x72_1f600.png" — tekil ve dosya adına uygun. */
function fileNameOf(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/[^a-zA-Z0-9.-]/g, "_");
}

function index(): Set<string> {
  if (stored) return stored;
  stored = new Set();
  if (Platform.OS === "web") return stored;
  try {
    folder = new Directory(Paths.document, FOLDER);
    if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    folderUri = folder.uri.endsWith("/") ? folder.uri : `${folder.uri}/`;
    for (const entry of folder.list()) {
      if (!(entry instanceof File)) continue;
      // Yarım kalmış indirme: bir dahaki görüşte baştan iner.
      if (entry.name.endsWith(".part")) {
        try {
          entry.delete();
        } catch {
          /* silinemezse üzerine yazılır */
        }
        continue;
      }
      stored.add(entry.name);
    }
  } catch {
    folder = null;
  }
  return stored;
}

/** Yerel kopya varsa onun adresi; yoksa null (o zaman ağ adresi kullanılır). */
export function localEmojiUri(url: string): string | null {
  const name = fileNameOf(url);
  return index().has(name) && folderUri ? `${folderUri}${name}` : null;
}

/**
 * Emojiyi arka planda yerel klasöre indirir (zaten varsa ya da sıradaysa
 * hiçbir şey yapmaz). Aynı anda en çok PARALLEL indirme: seçici açılınca
 * yüzlerce emoji birden istenir.
 */
export function persistEmoji(url: string) {
  const name = fileNameOf(url);
  if (index().has(name) || scheduled.has(name) || !folder) return;
  scheduled.add(name);
  waiting.push({ url, name });
  pump();
}

function pump() {
  while (running < PARALLEL && waiting.length > 0) {
    const job = waiting.shift();
    if (!job) break;
    running += 1;
    void download(job.url, job.name).finally(() => {
      running -= 1;
      scheduled.delete(job.name);
      pump();
    });
  }
}

/**
 * İnen şey gerçekten görsel mi? Yönlendirme izlenerek HTML (ör. üretimde
 * oturumsuz isteğin düştüğü giriş sayfası) gelirse kalıcı olarak saklanıp
 * emojiyi sonsuza dek bozmasın. PNG imzası ya da SVG başlangıcı aranır.
 */
function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  const head = String.fromCharCode(...bytes.slice(0, 256)).trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

async function download(url: string, name: string) {
  if (!folder) return;
  // Önce ".part"a iner, tamamlanınca asıl ada taşınır: yarıda kesilen
  // indirme bozuk bir görseli kalıcı hâle getirmesin.
  const partial = new File(folder, `${name}.part`);
  try {
    const file = await File.downloadFileAsync(url, partial, { idempotent: true });
    if (!file.exists || !looksLikeImage(file.bytesSync())) {
      file.delete();
      return;
    }
    file.move(new File(folder, name));
    stored?.add(name);
  } catch {
    // Çevrimdışı ya da adres geçersiz: bir sonraki görüşte yeniden denenir.
    try {
      if (partial.exists) partial.delete();
    } catch {
      /* yok say */
    }
  }
}
