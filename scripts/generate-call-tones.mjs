#!/usr/bin/env node
/**
 * Çağrı seslerini üretir (`assets/audio/`):
 *   ringtone.wav          uygulama içi gelen arama zili (döngüye alınır)
 *   ringback.wav          giden aramada arayanın duyduğu bekleme tonu
 *   ciklet_call_ring.wav  uygulama kapalıyken sistem bildiriminin sesi
 *
 * ── Neden üretiyoruz, hazır dosya koymuyoruz ────────────────────────
 * Zil sesleri telifli. İnternetten indirilmiş bir mp3'ü depoya koymak,
 * uygulamayı mağazaya çıkarırken lisans sorusu doğurur ve kaynağı da
 * belgelenmez. Buradaki sesler saf sinüs bileşenlerinden hesaplanıyor:
 * kaynağı bu dosya, lisansı projenin kendisi.
 *
 * Biçim: 22.05 kHz, 16-bit, mono PCM WAV. expo-audio her iki platformda
 * da WAV çalar ve kayıpsız biçim, zil gibi kısa ve döngüsel bir sesin
 * başında/sonunda kodlayıcı kaynaklı sessizlik bırakmaz — mp3'te bu
 * boşluk, döngüde duyulur bir tökezlemeye dönüşür.
 *
 * Çalıştırma:  node scripts/generate-call-tones.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22_050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "audio");

/**
 * Tek bir "zil vuruşu": iki sinüsün toplamı.
 *
 * Tek frekans telefon zilinden çok test tonuna benziyor; birbirine üçlü
 * aralıkta iki frekans (ana ton + majör üçlü) sese müzikal bir renk verir.
 * Zarf (attack/release) şart: kesik başlayan bir sinüs hoparlörde tık
 * sesi çıkarır ve döngüde bu tık her turda tekrarlanır.
 */
function burst({ durationSecs, frequencies, gain, attackSecs = 0.012, releaseSecs = 0.05 }) {
  const total = Math.round(durationSecs * SAMPLE_RATE);
  const attack = Math.round(attackSecs * SAMPLE_RATE);
  const release = Math.round(releaseSecs * SAMPLE_RATE);
  const samples = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    let value = 0;
    for (const { hz, weight } of frequencies) {
      value += Math.sin(2 * Math.PI * hz * t) * weight;
    }

    let envelope = 1;
    if (i < attack) envelope = i / attack;
    else if (i > total - release) envelope = Math.max(0, (total - i) / release);

    samples[i] = value * gain * envelope;
  }
  return samples;
}

function silence(durationSecs) {
  return new Float32Array(Math.round(durationSecs * SAMPLE_RATE));
}

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Float örnekleri 16-bit PCM WAV'a paketler. */
function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt yığın boyutu
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte/sn
  buffer.writeUInt16LE(2, 32); // blok hizası
  buffer.writeUInt16LE(16, 34); // bit derinliği
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    // Kırpma: toplanan sinüsler ±1'i aşarsa 16-bit'e çevirirken sarma
    // (wrap-around) olur ve ses cızırdar.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32_767), 44 + i * 2);
  }
  return buffer;
}

// ── Gelen arama zili ────────────────────────────────────────────────
// Klasik "çift vuruş" deseni: iki kısa vuruş, kısa boşluk, uzun sessizlik.
// Toplam 4 sn; döngüde telefon zili ritmini verir.
const RING_TONE = [
  { hz: 587.33, weight: 0.6 }, // D5
  { hz: 739.99, weight: 0.4 }, // F#5 — majör üçlü
];

const ringtone = concat([
  burst({ durationSecs: 0.4, frequencies: RING_TONE, gain: 0.72 }),
  silence(0.2),
  burst({ durationSecs: 0.4, frequencies: RING_TONE, gain: 0.72 }),
  silence(3.0),
]);

// ── Giden arama (ringback) ──────────────────────────────────────────
// Arayanın duyduğu ses. Bilerek daha sakin ve tek tonlu: kullanıcının
// kendi telefonundan çalıyor, dikkat çekmesi değil "bağlanıyor" demesi
// gerekiyor.
const RINGBACK_TONE = [
  { hz: 440, weight: 0.5 },
  { hz: 480, weight: 0.3 }, // hafif vuruş etkisi
];

const ringback = concat([
  burst({ durationSecs: 1.0, frequencies: RINGBACK_TONE, gain: 0.34, releaseSecs: 0.12 }),
  silence(2.4),
]);

// ── Bildirim zili ───────────────────────────────────────────────────
// Uygulama KAPALIYKEN çalan ses. Uygulama içi zil döngüye alınabiliyor ama
// sistem bildirimi sesi bir kez çalar; bu yüzden desen dosyanın içinde
// tekrarlanıyor. Süre 24 sn: iOS özel bildirim seslerinde 30 sn üst sınırı
// var ve sunucu daveti 45 sn sonra düşürüyor.
//
// Dosya adı Android kaynak adı kurallarına uymak ZORUNDA (küçük harf, tire
// yok): expo-notifications eklentisi dosyayı `res/raw` altına adıyla
// kopyalıyor ve geçersiz ad derlemeyi kırıyor.
const NOTIFICATION_RING_REPEATS = 6; // 6 × 4 sn = 24 sn
const callNotification = concat(Array.from({ length: NOTIFICATION_RING_REPEATS }, () => ringtone));

mkdirSync(OUT_DIR, { recursive: true });
const outputs = {
  "ringtone.wav": ringtone,
  "ringback.wav": ringback,
  "ciklet_call_ring.wav": callNotification,
};

for (const [name, samples] of Object.entries(outputs)) {
  writeFileSync(join(OUT_DIR, name), toWav(samples));
  console.log(`Yazıldı: ${join(OUT_DIR, name)} (${(samples.length / SAMPLE_RATE).toFixed(1)} sn)`);
}
