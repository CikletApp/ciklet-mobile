#!/usr/bin/env node
/**
 * Uygulama seslerini web'in ses kataloğundan üretir.
 *
 * Web'de ses DOSYASI yok: her ses `ciklet-web src/lib/sounds/registry.ts`
 * içindeki tariflerden Web Audio ile anında sentezleniyor (osilatör vuruşları
 * ve döngülü zil melodileri). Mobilde aynı sesi çalmanın yolu, aynı tarifleri
 * aynı zarf/frekans kurallarıyla (engine.ts `scheduleTone`) WAV'a dökmek.
 *
 * Tarifler buraya veri olarak KOPYALANDI — web kataloğunda bir ses
 * değişirse buradaki karşılığı güncellenip betik yeniden çalıştırılır:
 *
 *   node scripts/generate-sounds.mjs
 *
 * Çıktı `assets/sounds/*.wav` (16 bit, mono, 44,1 kHz). Taban seviye
 * (`volume`) dosyaya GÖMÜLMEZ: dosyalar tepe ~0,9'a normalize edilir,
 * seviye çalarken uygulanır (lib/sound-catalog). `message.wav` ve
 * `ringtone.wav` Android bildirim kanallarının sesi de olduğu için orada
 * değişiklik yerel yeniden derlemeyle görünür.
 */
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const SILENCE = 0.0001;
const PEAK = 0.9;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");

// ── Web registry.ts ile birebir tarifler ────────────────────────────────

const TONES = {
  message: [
    { freq: 500, to: 1000, duration: 0.05 },
    { freq: 1000, to: 700, at: 0.05, duration: 0.15 },
  ],
  mention: [
    { freq: 880, duration: 0.09, gain: 0.9 },
    { freq: 1175, at: 0.09, duration: 0.22 },
  ],
  "friend-request": [
    { freq: 600, to: 800, duration: 0.15 },
    { freq: 800, to: 1000, at: 0.15, duration: 0.2 },
  ],
  "mic-on": [{ wave: "triangle", freq: 440, to: 660, duration: 0.09, attack: 0.01 }],
  "mic-off": [{ wave: "triangle", freq: 660, to: 440, duration: 0.09, attack: 0.01 }],
  deafen: [
    { wave: "triangle", freq: 520, to: 390, duration: 0.09, attack: 0.01 },
    { wave: "triangle", freq: 390, to: 260, at: 0.08, duration: 0.14, attack: 0.01 },
  ],
  undeafen: [
    { wave: "triangle", freq: 390, to: 520, duration: 0.09, attack: 0.01 },
    { wave: "triangle", freq: 520, to: 700, at: 0.08, duration: 0.14, attack: 0.01 },
  ],
  "voice-join": [{ freq: 440, to: 880, duration: 0.3, attack: 0.05 }],
  "voice-leave": [{ freq: 600, to: 300, duration: 0.3, attack: 0.05 }],
  "activity-join": [
    { freq: 523, duration: 0.08, attack: 0.01 },
    { freq: 659, at: 0.07, duration: 0.08, attack: 0.01 },
    { freq: 784, at: 0.14, duration: 0.18, attack: 0.01 },
  ],
  "activity-leave": [
    { freq: 784, duration: 0.08, attack: 0.01 },
    { freq: 659, at: 0.07, duration: 0.08, attack: 0.01 },
    { freq: 523, at: 0.14, duration: 0.18, attack: 0.01 },
  ],
};

const A4 = 440.0;
const CS5 = 554.37;
const E5 = 659.25;
const A5 = 880.0;
const B4 = 493.88;
const D5 = 587.33;
const FS5 = 739.99;
const B5 = 987.77;
const NOTE_ATTACK = 0.008;
const NOTE_RELEASE = 0.03;

const LOOPS = {
  // Gelen arama zili (ringIncoming) — 4,4 s'de bir tekrarlar.
  ringtone: {
    period: 4.4,
    notes: [
      { at: 0.0, dur: 0.15, freq: A4 },
      { at: 0.17, dur: 0.15, freq: CS5 },
      { at: 0.34, dur: 0.15, freq: E5 },
      { at: 0.51, dur: 0.34, freq: A5 },
      { at: 0.92, dur: 0.15, freq: E5 },
      { at: 1.09, dur: 0.42, freq: CS5 },
      { at: 1.75, dur: 0.15, freq: B4 },
      { at: 1.92, dur: 0.15, freq: D5 },
      { at: 2.09, dur: 0.15, freq: FS5 },
      { at: 2.26, dur: 0.34, freq: B5 },
      { at: 2.67, dur: 0.15, freq: FS5 },
      { at: 2.84, dur: 0.5, freq: D5 },
    ],
  },
  // Giden arama tonu (ringOutgoing) — 2,5 s'de bir tekrarlar.
  ringback: {
    period: 2.5,
    notes: [
      { at: 0.0, dur: 0.22, freq: A4, level: 0.85 },
      { at: 0.26, dur: 0.34, freq: E5, level: 0.85 },
    ],
  },
};

// ── Sentez (engine.ts scheduleTone / registry.ts ringVoice) ─────────────

function oscillator(wave, phase) {
  if (wave === "triangle") {
    // Web Audio üçgeni: faz 0'da 0, π/2'de +1.
    const x = (phase / (2 * Math.PI)) % 1;
    return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4;
  }
  return Math.sin(phase);
}

function renderTones(tones) {
  const total = Math.max(...tones.map((tone) => (tone.at ?? 0) + tone.duration));
  const frames = Math.ceil(total * SAMPLE_RATE) + 1;
  const out = new Float64Array(frames);
  for (const tone of tones) {
    const start = tone.at ?? 0;
    const duration = tone.duration;
    const attack = Math.min(tone.attack ?? 0.02, duration / 2);
    const peak = Math.max(SILENCE, tone.gain ?? 1);
    let phase = 0;
    const first = Math.floor(start * SAMPLE_RATE);
    const last = Math.min(frames, Math.ceil((start + duration) * SAMPLE_RATE));
    for (let i = first; i < last; i++) {
      const local = i / SAMPLE_RATE - start;
      if (local < 0) continue;
      // Frekans: başlangıçtan bitişe üstel kayma (exponentialRampToValueAtTime).
      const freq = tone.to && tone.to > 0
        ? tone.freq * Math.pow(tone.to / tone.freq, local / duration)
        : tone.freq;
      // Kazanç: SILENCE → tepe (doğrusal, attack), tepe → SILENCE (üstel).
      const gain = local < attack
        ? SILENCE + (peak - SILENCE) * (local / attack)
        : peak * Math.pow(SILENCE / peak, (local - attack) / (duration - attack));
      out[i] += oscillator(tone.wave ?? "sine", phase) * gain;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    }
  }
  return out;
}

function ringVoice(note, t) {
  const local = t - note.at;
  if (local < 0 || local >= note.dur) return 0;
  const envelope = Math.min(1, local / NOTE_ATTACK, Math.max(0, note.dur - local) / NOTE_RELEASE);
  const phase = Math.PI * 2 * note.freq * local;
  const timbre = (Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3)) / 1.4;
  return timbre * envelope * (note.level ?? 1);
}

function renderLoop({ period, notes }) {
  const frames = Math.max(1, Math.floor(SAMPLE_RATE * period));
  const out = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (const note of notes) sample += ringVoice(note, t);
    out[i] = Math.max(-1, Math.min(1, sample));
  }
  return out;
}

// ── WAV ─────────────────────────────────────────────────────────────────

function toWav(samples) {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  const scale = max > 0 ? PEAK / max : 0;
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i] * scale));
    data.writeInt16LE(Math.round(value * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

for (const [name, tones] of Object.entries(TONES)) {
  writeFileSync(join(OUT_DIR, `${name}.wav`), toWav(renderTones(tones)));
  console.log(`assets/sounds/${name}.wav`);
}
for (const [name, loop] of Object.entries(LOOPS)) {
  writeFileSync(join(OUT_DIR, `${name}.wav`), toWav(renderLoop(loop)));
  console.log(`assets/sounds/${name}.wav`);
}
