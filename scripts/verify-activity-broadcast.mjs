// Yayın sunumu (lib/activity-broadcast) — web lib/activity-presentation
// broadcastPresentation ile aynı kural: yayın programının adı hiçbir yerde yazmaz.
// Çalıştırma: node scripts/verify-activity-broadcast.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import {
  broadcastPresentation,
  broadcastText,
  isStreamingSoftwareActivity,
  isStreamingSoftwareName,
  normalizeSoftwareName,
} from "../src/lib/activity-broadcast.ts";

const TR = { live: "Yayında", game: "{game} yayını yapıyor", liveOn: "{platform}'te yayında", title: "Canlı yayın" };
const EN = { live: "Live", game: "Streaming {game}", liveOn: "Live on {platform}", title: "Live stream" };

const text = (activity, labels = TR) => {
  const b = broadcastPresentation(activity);
  return b ? broadcastText(b, labels) : null;
};

test("yayın programı adları normalize edilip tanınır", () => {
  assert.equal(normalizeSoftwareName("Streamlabs OBS.exe"), "streamlabs obs");
  for (const name of ["OBS Studio", "obs64.exe", "Streamlabs", "XSplit Broadcaster", "Twitch Studio", "vMix"]) {
    assert.equal(isStreamingSoftwareName(name), true, name);
  }
  for (const name of ["Obsidian", "Twitch", "Spotify", "", null, undefined]) {
    assert.equal(isStreamingSoftwareName(name), false, String(name));
  }
});

test("yayın programı tek başına: 'Yayında', program gizli", () => {
  const obs = { type: "STREAMING", name: "OBS Studio" };
  assert.deepEqual(broadcastPresentation(obs), { game: null, platform: null, software: true });
  assert.equal(text(obs), "Yayında");
  assert.equal(text(obs, EN), "Live");
  assert.equal(isStreamingSoftwareActivity({ type: "WORKING", name: "Streamlabs" }), true);
});

test("oyun + yayın programı: '<oyun> yayını yapıyor'", () => {
  assert.equal(text({ type: "PLAYING", name: "EA SPORTS FC 27", broadcasting: true }), "EA SPORTS FC 27 yayını yapıyor");
  assert.equal(text({ type: "PLAYING", name: "Dead by Daylight", broadcasting: true }, EN), "Streaming Dead by Daylight");
  assert.equal(text({ type: "PLAYING", name: "Valorant" }), null);
  assert.equal(text({ type: "LISTENING", name: "Spotify", broadcasting: true }), null);
});

test("Twitch/Kick: kategori oyun olur", () => {
  assert.equal(text({ type: "STREAMING", name: "Twitch", platform: "twitch", state: "Dead by Daylight" }), "Dead by Daylight yayını yapıyor");
  assert.equal(text({ type: "STREAMING", name: "Kick", platform: "kick" }), "Kick'te yayında");
  // Geçmiş satırında platform yok; ad platform adıysa yayın programı sayılmaz.
  assert.equal(isStreamingSoftwareActivity({ type: "STREAMING", name: "Twitch" }), false);
});

test("bot etkinliği kurala girmez", () => {
  assert.equal(broadcastPresentation({ type: "STREAMING", name: "OBS Studio", bot: true }), null);
  assert.equal(broadcastPresentation(null), null);
});
