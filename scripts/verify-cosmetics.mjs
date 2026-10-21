// Kozmetik kataloğu (süs/plaka/efekt), takma ad çözümü, ad stili ayrıştırma ve
// çizim metinlerinin (SVG) saf mantığını doğrular — web ile aynı kurallar.
// Çalıştırma: node scripts/verify-cosmetics.mjs   (Node 22.18+: .ts tip ayıklama)
//
// lib/cosmetics/art web'den DEĞİŞTİRİLMEDEN kopyalandı; içindeki göreli
// içe aktarımlar uzantısız (`./kit`). Node ESM uzantı tahmin etmediğinden
// küçük bir çözümleme kancası `.ts` ekler.
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (error) {
          if (specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + ".ts", context);
          throw error;
        }
      }
    `)
);

const { COSMETIC_ALIASES, resolveCosmeticId, cosmeticIdVariants } = await import("../src/lib/cosmetics/aliases.ts");
const { AVATAR_DECORATIONS, findDecoration } = await import("../src/lib/avatar-decorations.ts");
const { PROFILE_EFFECTS, NAMEPLATES, findProfileEffect, findNameplate, nameplateStops, profileEffectAccess } = await import(
  "../src/lib/profile-effects.ts"
);
const { DECORATION_ART, NAMEPLATE_ART, EFFECT_ART, decorationSvg, effectLayout } = await import("../src/lib/cosmetics/art/index.ts");
const { getCosmeticShowcase } = await import("../src/lib/cosmetics/showcase.ts");
const { cssGradientSvg, parseCssGradients, parseCssColor } = await import("../src/lib/cosmetics/css-gradient.ts");
const { stripCssAttributes, withLeftFade } = await import("../src/lib/cosmetics/native-svg.ts");
const {
  NAME_EFFECTS,
  NAME_FONTS,
  changedNameStyleIds,
  nameStyleHalo,
  nameStyleItemAccess,
  nameStylePresentation,
  parseNameStyle,
  sameNameStyle,
} = await import("../src/lib/name-style.ts");

// ── Katalog: web ile aynı kimlikler ve sıra ─────────────────────────────

test("süs kataloğu web ile aynı (kimlik, sıra, kademe)", () => {
  // ciklet-web src/lib/avatar-decorations.ts sırası.
  assert.deepEqual(
    AVATAR_DECORATIONS.map((d) => d.id),
    ["turkiye", "ayi", "hilal", "kedi", "tavsan", "hayalet", "kabak", "alev", "buz_taci", "cicek", "iskelet_tirmanan", "iskelet_fener", "kafatasi_uclusu", "orumcek_agi", "kara_ay", "tilki", "kurt", "galaksi", "mantar"]
  );
  assert.deepEqual(
    AVATAR_DECORATIONS.filter((d) => !d.mentol && !d.store).map((d) => d.id),
    ["turkiye", "ayi", "hilal"]
  );
  assert.ok(AVATAR_DECORATIONS.filter((d) => d.store).every((d) => !d.mentol));
});

test("efekt ve plaka katalogları web ile aynı", () => {
  assert.deepEqual(
    PROFILE_EFFECTS.map((e) => `${e.id}:${e.tier}`),
    ["fx_leaves:free", "fx_turkiye:free", "fx_sakura:mentol", "fx_fireflies:mentol", "fx_isilti:mentol", "fx_korlar:mentol", "fx_mezarlik:store", "fx_orumcek:store", "fx_snow:store", "fx_yildiz_kaymasi:store"]
  );
  assert.deepEqual(
    NAMEPLATES.map((n) => n.id),
    ["np_iskelet_dansi", "np_perili_orman", "np_uyuyan_kedi", "np_kizilgerdan", "np_mantar_bahcesi", "np_kuzey_isiklari", "np_kor", "np_sakura", "np_al_bayrak", "np_yildiz_yolu"]
  );
});

test("her katalog kaydının çizimi var (ve çizimsiz kayıt yok)", () => {
  for (const d of AVATAR_DECORATIONS) assert.ok(DECORATION_ART[d.id]?.front, `süs çizimi yok: ${d.id}`);
  for (const n of NAMEPLATES) assert.ok(NAMEPLATE_ART[n.id], `plaka çizimi yok: ${n.id}`);
  for (const e of PROFILE_EFFECTS) assert.ok(EFFECT_ART[e.id], `efekt çizimi yok: ${e.id}`);
  assert.equal(Object.keys(DECORATION_ART).length, AVATAR_DECORATIONS.length);
  assert.equal(Object.keys(NAMEPLATE_ART).length, NAMEPLATES.length);
  assert.equal(Object.keys(EFFECT_ART).length, PROFILE_EFFECTS.length);
});

// ── Takma adlar (eski kimlik → yeni) ────────────────────────────────────

test("eski kimlikler aynı kademedeki yeni ürüne çözülür", () => {
  assert.equal(resolveCosmeticId("galaxy"), "galaksi");
  assert.equal(resolveCosmeticId("mint"), "ayi");
  assert.equal(resolveCosmeticId("np_dusk"), "np_sakura");
  assert.equal(resolveCosmeticId("fx_confetti"), "fx_yildiz_kaymasi");
  assert.equal(resolveCosmeticId("kedi"), "kedi");
  assert.equal(findDecoration("galaxy")?.id, "galaksi");
  assert.equal(findDecoration("ember")?.name, "Alev Halkası");
  assert.equal(findNameplate("np_gold")?.id, "np_kor");
  assert.equal(findProfileEffect("fx_bubbles")?.id, "fx_leaves");
  assert.equal(findProfileEffect("fx_sparkle")?.tier, "mentol");
  assert.equal(findDecoration("yok"), null);
  assert.equal(findDecoration(null), null);
  assert.deepEqual(cosmeticIdVariants("galaksi").sort(), ["galaksi", "galaxy"]);
  // Her takma ad var olan bir kayda çözülür.
  for (const [oldId, newId] of Object.entries(COSMETIC_ALIASES)) {
    assert.ok(findDecoration(newId) || findNameplate(newId) || findProfileEffect(newId), `${oldId} → ${newId} bulunamadı`);
  }
});

test("efekt erişimi: Mentol ve mağaza kuralı", () => {
  assert.equal(profileEffectAccess("fx_leaves", { mentol: false, owned: false }), "ok");
  assert.equal(profileEffectAccess("fx_sakura", { mentol: false, owned: false }), "mentol_required");
  assert.equal(profileEffectAccess("fx_snow", { mentol: true, owned: false }), "not_owned");
  assert.equal(profileEffectAccess("fx_hearts", { mentol: false, owned: true }), "ok"); // takma ad → mağaza ürünü
  assert.equal(profileEffectAccess("fx_yok", { mentol: true, owned: true }), "unknown");
});

test("vitrin: takma ad çözülür, tür ve sahne doğru", () => {
  assert.equal(getCosmeticShowcase("galaxy")?.kind, "decoration");
  assert.equal(getCosmeticShowcase("kurt")?.backdropId, "buz");
  assert.equal(getCosmeticShowcase("np_kor")?.backdropId, "ates");
  assert.equal(getCosmeticShowcase("fx_mezarlik")?.kind, "effect");
  assert.ok(getCosmeticShowcase("tilki")?.backdrop("x").startsWith("<svg"));
  assert.equal(getCosmeticShowcase("yok"), null);
});

// ── Çizim metni (react-native-svg) ──────────────────────────────────────

test("süs katmanları tam <svg>; CSS öznitelikleri ayıklanır", () => {
  for (const d of AVATAR_DECORATIONS) {
    const front = decorationSvg(d.id, "front", "c");
    assert.ok(front?.startsWith("<svg") && front.endsWith("</svg>"), d.id);
    const clean = stripCssAttributes(front);
    assert.ok(!/\sclass="/.test(clean) && !/\sstyle="/.test(clean), `${d.id}: class/style kaldı`);
    assert.ok(clean.includes("<path") || clean.includes("<circle"), d.id);
  }
  assert.equal(decorationSvg("galaxy", "front", "c"), decorationSvg("galaksi", "front", "c"));
  assert.equal(decorationSvg("yok", "front"), null);
});

test("plaka sahnesine sol solma maskesi eklenir", () => {
  const xml = withLeftFade(NAMEPLATE_ART.np_kor("c"), 160, 48);
  assert.ok(xml.startsWith("<svg") && xml.endsWith("</g></svg>"));
  assert.match(xml, /<mask id="npfade"/);
  assert.match(xml, /<g mask="url\(#npfade\)">/);
});

test("efekt yerleşimi deterministik ve sınırlar içinde", () => {
  const a = effectLayout(4, 14, [14, 24], [5, 8]);
  const b = effectLayout(4, 14, [14, 24], [5, 8]);
  assert.deepEqual(a, b);
  assert.equal(a.length, 14);
  for (const slot of a) {
    assert.ok(slot.left >= 0 && slot.left <= 100);
    assert.ok(slot.size >= 14 && slot.size <= 24);
    assert.ok(slot.duration >= 5 && slot.duration <= 8);
  }
});

test("CSS gradyan → SVG: efekt örtülerinin hepsi çevrilir", () => {
  for (const [id, art] of Object.entries(EFFECT_ART)) {
    if (!art.tint) continue;
    const layers = parseCssGradients(art.tint);
    assert.ok(layers.length >= 1, `${id}: örtü ayrıştırılamadı`);
    assert.ok(cssGradientSvg(art.tint)?.startsWith("<svg"), id);
  }
  const radial = parseCssGradients("radial-gradient(90% 55% at 0% 0%, rgba(255,140,40,0.3), transparent 70%)")[0];
  assert.deepEqual(
    { kind: radial.kind, rx: radial.rx, ry: radial.ry, cx: radial.cx, cy: radial.cy },
    { kind: "radial", rx: 90, ry: 55, cx: 0, cy: 0 }
  );
  // Saydam durak komşu rengini alır (gri hale yok), konumsuz son durak 1.
  assert.deepEqual(radial.stops, [
    { offset: 0, color: "rgb(255,140,40)", opacity: 0.3 },
    { offset: 0.7, color: "rgb(255,140,40)", opacity: 0 },
  ]);
  const linear = parseCssGradients("linear-gradient(180deg, transparent 50%, rgba(20,60,40,.45))")[0];
  assert.equal(linear.angle, 180);
  assert.deepEqual(linear.stops.map((s) => s.offset), [0.5, 1]);
  assert.deepEqual(parseCssColor("#abc"), { color: "#aabbcc", opacity: 1 });
  assert.equal(parseCssColor("hsl(1,2%,3%)"), null);
  assert.equal(cssGradientSvg("url(x.png)"), null);
  assert.equal(cssGradientSvg(null), null);
});

test("plaka gradyanı web oranlarıyla", () => {
  assert.deepEqual(nameplateStops(findNameplate("np_al_bayrak")), [
    { offset: 0, color: "rgb(227,10,23)", opacity: 0 },
    { offset: 0.45, color: "rgb(227,10,23)", opacity: 0.18 },
    { offset: 1, color: "rgb(227,10,23)", opacity: 0.4 },
  ]);
});

// ── Ad stili ────────────────────────────────────────────────────────────

test("ad stili kataloğu web ile aynı", () => {
  assert.deepEqual(
    NAME_FONTS.map((f) => f.id),
    ["nf_bungee", "nf_pacifico", "nf_terminal", "nf_orbit", "nf_comic", "nf_royal", "nf_lobster", "nf_pixel", "nf_arcade", "nf_nightmare", "nf_glitch", "nf_neonsign", "nf_wetpaint", "nf_gothic"]
  );
  assert.deepEqual(NAME_EFFECTS.map((e) => e.id), ["ne_solid", "ne_gradient", "ne_shimmer", "ne_neon", "ne_rainbow"]);
});

test("parseNameStyle: bilinmeyen atılır, renkler süzülür ve efekte uydurulur", () => {
  assert.equal(parseNameStyle(null), null);
  assert.equal(parseNameStyle([]), null);
  assert.equal(parseNameStyle("nf_bungee"), null);
  assert.equal(parseNameStyle({ font: "nf_yok", effect: "ne_yok" }), null);
  assert.deepEqual(parseNameStyle({ font: "nf_bungee" }), { font: "nf_bungee", effect: null, colors: [] });
  // Büyük harf küçülür, geçersiz renk atılır, fazlası kırpılır.
  assert.deepEqual(parseNameStyle({ effect: "ne_solid", colors: ["#FF0000", "red", "#00ff00"] }), {
    font: null,
    effect: "ne_solid",
    colors: ["#ff0000"],
  });
  // Eksik renk varsayılandan tamamlanır.
  assert.deepEqual(parseNameStyle({ effect: "ne_gradient", colors: ["#111111"] }), {
    font: null,
    effect: "ne_gradient",
    colors: ["#111111", "#9b5cff"],
  });
  // Gökkuşağı renk almaz; yazı tipi bilinmiyorsa yalnızca efekt kalır.
  assert.deepEqual(parseNameStyle({ font: 3, effect: "ne_rainbow", colors: ["#ffffff"] }), {
    font: null,
    effect: "ne_rainbow",
    colors: [],
  });
  assert.deepEqual(parseNameStyle({ font: "nf_gothic", effect: "ne_neon", colors: "x" }), {
    font: "nf_gothic",
    effect: "ne_neon",
    colors: ["#ff40ec"],
  });
});

test("sameNameStyle ve değişen kimlikler (kilit yalnızca değişende)", () => {
  const a = { font: "nf_pixel", effect: "ne_gradient", colors: ["#111111", "#222222"] };
  assert.ok(sameNameStyle(a, { ...a, colors: [...a.colors] }));
  assert.ok(!sameNameStyle(a, { ...a, colors: ["#111111", "#333333"] }));
  assert.ok(sameNameStyle(null, null));
  assert.ok(!sameNameStyle(a, null));
  assert.deepEqual(changedNameStyleIds(a, a), []);
  assert.deepEqual(changedNameStyleIds({ ...a, font: "nf_arcade" }, a), ["nf_arcade"]);
  assert.deepEqual(changedNameStyleIds(a, null), ["nf_pixel", "ne_gradient"]);
  assert.deepEqual(changedNameStyleIds(null, a), []);
});

test("ad stili erişimi ve sunum", () => {
  assert.equal(nameStyleItemAccess("nf_bungee", { mentol: false, owned: false }), "ok");
  assert.equal(nameStyleItemAccess("ne_gradient", { mentol: false, owned: false }), "mentol_required");
  assert.equal(nameStyleItemAccess("nf_arcade", { mentol: true, owned: false }), "not_owned");
  assert.equal(nameStyleItemAccess("nf_yok", { mentol: true, owned: true }), "unknown");

  // Yalnızca yazı tipi: renk yok (rol rengi kalır), ölçek yazı tipinden.
  const fontOnly = nameStylePresentation({ font: "nf_arcade", effect: null, colors: [] });
  assert.equal(fontOnly.color, null);
  assert.equal(fontOnly.gradient, null);
  assert.equal(fontOnly.scale, 0.68);
  // Düz renk rol rengini ezer.
  assert.equal(nameStylePresentation({ font: null, effect: "ne_solid", colors: ["#123456"] }).color, "#123456");
  // Parıltı: ilk renk sona eklenir (dikişsiz döngü).
  assert.deepEqual(nameStylePresentation({ font: null, effect: "ne_shimmer", colors: ["#aaaaaa", "#bbbbbb"] }).gradient, [
    "#aaaaaa",
    "#bbbbbb",
    "#aaaaaa",
  ]);
  assert.equal(nameStylePresentation({ font: null, effect: "ne_rainbow", colors: [] }).gradient.length, 8);
  assert.equal(nameStylePresentation(null).font, null);
  // Okunurluk halesi: çok koyu → açık, çok açık → koyu.
  assert.equal(nameStyleHalo(["#000000"]), "light");
  assert.equal(nameStyleHalo(["#ffffff"]), "dark");
  assert.equal(nameStyleHalo(["#ff5c5c"]), null);
  assert.equal(nameStyleHalo([]), null);
});
