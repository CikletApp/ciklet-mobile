/**
 * Arka plan medya indirme kuyruğunun SAF kuralları — `scripts/verify-local-store.mjs`
 * ile doğrulanır; içe aktarma yok (Node tip ayıklamasıyla çalışır).
 *
 * WhatsApp davranışı: sesli mesaj sohbete düştüğü anda arkada iner,
 * kullanıcı dokunduğunda yerel dosyadan hemen çalar. Kurallar:
 *  - Aynı adres bir kez kuyruğa girer (tekilleştirme); yeniden eklenirse
 *    önceliği yükselir.
 *  - En yüksek öncelikli (en yeni mesaj) önce iner; aynı anda en çok
 *    `concurrency` indirme.
 *  - Kuyruk `maxJobs` ile sınırlı: taşan en eski (düşük öncelikli) işler atılır.
 *  - Ağ yokken (ya da ayar kapalıyken) yeni indirme başlamaz; o sırada düşen
 *    indirme deneme sayılmaz. Hata üstel beklemeyle `maxAttempts` kez
 *    denenir; kalıcı hata (`permanent`, örn. boyut sınırı) hemen bırakılır.
 *  - Bağlantı gelince / ön plana dönünce `resume` beklemeleri sıfırlar.
 */

export interface PrefetchItem {
  url: string;
  /** Büyük olan önce iner — mesaj zamanı (ms). */
  priority: number;
}

interface Job extends PrefetchItem {
  attempts: number;
  nextAttemptAt: number;
}

export interface PrefetchQueueDeps<Timer> {
  concurrency: number;
  maxJobs: number;
  maxAttempts: number;
  /** İndirir; hata fırlatırsa yeniden denenir (`permanent: true` ise denenmez). */
  run: (url: string) => Promise<unknown>;
  /** Zaten cihazda mı (ya da başka yoldan iniyor mu)? Öyleyse iş atlanır. */
  isDone: (url: string) => boolean;
  /** Şu an indirme başlatılabilir mi (ağ + ayar)? */
  canRun: () => boolean;
  now: () => number;
  random: () => number;
  setTimer: (fn: () => void, ms: number) => Timer;
  clearTimer: (timer: Timer) => void;
}

export interface PrefetchQueue {
  add: (items: readonly PrefetchItem[]) => void;
  /** Bağlantı geldi / ön plana dönüldü: beklemeler sıfırlanır, bırakılanlar yeniden denenebilir. */
  resume: () => void;
  /** Çıkış / önbellek temizliği: her şey unutulur, uçuştakilerin sonucu yok sayılır. */
  clear: () => void;
  stats: () => { waiting: number; running: number; gaveUp: number };
}

/** 2 sn, 4 sn, 8 sn … en çok 5 dk; `jitter` 0–1. */
export function prefetchBackoffMs(attempt: number, jitter = 0.5): number {
  const base = Math.min(2000 * 2 ** Math.max(0, attempt), 5 * 60_000);
  return Math.round(base * (0.75 + 0.5 * Math.min(1, Math.max(0, jitter))));
}

export function createPrefetchQueue<Timer>(deps: PrefetchQueueDeps<Timer>): PrefetchQueue {
  const waiting = new Map<string, Job>();
  const running = new Set<string>();
  const gaveUp = new Set<string>();
  let timer: Timer | null = null;
  let generation = 0;

  const trim = () => {
    if (waiting.size <= deps.maxJobs) return;
    const sorted = [...waiting.values()].sort((a, b) => b.priority - a.priority);
    for (const job of sorted.slice(deps.maxJobs)) waiting.delete(job.url);
  };

  const pickNext = (now: number): Job | null => {
    let best: Job | null = null;
    for (const job of waiting.values()) {
      if (job.nextAttemptAt > now) continue;
      if (!best || job.priority > best.priority) best = job;
    }
    return best;
  };

  const wake = () => {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    let earliest = Infinity;
    for (const job of waiting.values()) earliest = Math.min(earliest, job.nextAttemptAt);
    if (earliest === Infinity) return;
    timer = deps.setTimer(
      () => {
        timer = null;
        pump();
      },
      Math.max(0, earliest - deps.now())
    );
  };

  const start = (job: Job) => {
    const startedIn = generation;
    running.add(job.url);
    let failure: unknown = null;
    let failed = false;
    deps
      .run(job.url)
      .catch((err: unknown) => {
        failed = true;
        failure = err;
      })
      .then(() => {
        if (startedIn !== generation) return;
        running.delete(job.url);
        if (failed && !deps.isDone(job.url)) {
          const permanent = Boolean((failure as { permanent?: unknown } | null)?.permanent);
          if (permanent) {
            gaveUp.add(job.url);
          } else if (!deps.canRun()) {
            // Ağ gitti: deneme sayılmaz, bağlantı gelince yeniden.
            waiting.set(job.url, { ...job, nextAttemptAt: 0 });
          } else {
            const attempts = job.attempts + 1;
            if (attempts >= deps.maxAttempts) gaveUp.add(job.url);
            else
              waiting.set(job.url, {
                ...job,
                attempts,
                nextAttemptAt: deps.now() + prefetchBackoffMs(job.attempts, deps.random()),
              });
          }
          trim();
        }
        pump();
      });
  };

  const pump = () => {
    if (deps.canRun()) {
      while (running.size < deps.concurrency) {
        const next = pickNext(deps.now());
        if (!next) break;
        waiting.delete(next.url);
        if (deps.isDone(next.url)) continue;
        start(next);
      }
    }
    if (deps.canRun()) wake();
    else if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  };

  return {
    add(items) {
      for (const item of items) {
        if (running.has(item.url) || gaveUp.has(item.url) || deps.isDone(item.url)) continue;
        const existing = waiting.get(item.url);
        if (existing) existing.priority = Math.max(existing.priority, item.priority);
        else waiting.set(item.url, { ...item, attempts: 0, nextAttemptAt: 0 });
      }
      trim();
      pump();
    },
    resume() {
      gaveUp.clear();
      for (const job of waiting.values()) job.nextAttemptAt = 0;
      pump();
    },
    clear() {
      generation += 1;
      waiting.clear();
      running.clear();
      gaveUp.clear();
      if (timer !== null) {
        deps.clearTimer(timer);
        timer = null;
      }
    },
    stats: () => ({ waiting: waiting.size, running: running.size, gaveUp: gaveUp.size }),
  };
}

// ── Hangi sesli mesajlar? ────────────────────────────────────────────

export interface VoiceCandidate {
  id: string;
  fileUrl?: string | null;
  deleted?: boolean | null;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  metadata?: unknown;
}

export interface VoiceTargetOptions {
  /** Bir sohbette en çok bu kadar sesli mesaj (en yeniler). */
  maxTargets: number;
  /** En yeni bu kadar mesaja bakılır — dev geçmişin tamamı taranmaz. */
  maxScan: number;
  /** `metadata.attachment.size` bundan büyükse inmez. */
  maxBytes: number;
  isVoice: (message: VoiceCandidate) => boolean;
  now: number;
}

function timeMs(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function declaredSize(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const attachment = (metadata as { attachment?: unknown }).attachment;
  if (!attachment || typeof attachment !== "object") return null;
  const size = (attachment as { size?: unknown }).size;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

/**
 * Sohbet önbelleğindeki sayfalardan (en yeni önce) arkada indirilecek
 * sesli mesajlar: silinmemiş, süresi dolmamış, adresi http(s), bildirilen
 * boyutu sınırın altında. Öncelik mesaj zamanı.
 */
export function pickVoiceTargets(
  pages: readonly { items: readonly VoiceCandidate[] }[] | undefined,
  options: VoiceTargetOptions
): PrefetchItem[] {
  const out: PrefetchItem[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  for (const page of pages ?? []) {
    for (const message of page.items) {
      if (scanned >= options.maxScan || out.length >= options.maxTargets) return out;
      scanned += 1;
      const url = message.fileUrl;
      if (!url || !/^https?:/i.test(url) || message.deleted) continue;
      const expires = timeMs(message.expiresAt);
      if (expires > 0 && expires <= options.now) continue;
      if (!options.isVoice(message)) continue;
      const size = declaredSize(message.metadata);
      if (size !== null && size > options.maxBytes) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, priority: timeMs(message.createdAt) });
    }
  }
  return out;
}
