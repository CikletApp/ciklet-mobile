// node --import ./tests/helpers/register-ts.mjs --test tests/i18n-locales.test.mjs
// Her dil sözlüğü İngilizceyle aynı anahtarları ve yer tutucuları taşır;
// çoğul bloklarında dilin tüm kategorileri var. Yeni anahtarı tr/en'e
// eklediysen messages/locales/<dil>/ altındaki aynı dosyaya da ekle.
import { test } from "node:test";
import assert from "node:assert/strict";

import { LOCALES, INTL_LOCALES, LOCALE_NAMES, matchLocaleTag, localeDirection } from "../src/lib/i18n/locales.ts";
import { formatMessage, messageVariables, pluralBlocks } from "../src/lib/i18n/message-format.ts";
import { en } from "../src/lib/i18n/messages/en.ts";
import { tr } from "../src/lib/i18n/messages/tr.ts";

const leaves = (node, prefix = "", out = new Map()) => {
  if (typeof node === "string") out.set(prefix, node);
  else for (const [k, v] of Object.entries(node)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
};
const EN = leaves(en);
const TR = leaves(tr);

for (const locale of LOCALES.filter((l) => l !== "tr" && l !== "en")) {
  test(`${locale}: anahtar, yer tutucu ve çoğul eşitliği`, async () => {
    const { messages } = await import(`../src/lib/i18n/messages/locales/${locale}/index.ts`);
    const own = leaves(messages);
    assert.deepEqual(
      { missing: [...EN.keys()].filter((k) => !own.has(k)), extra: [...own.keys()].filter((k) => !EN.has(k)) },
      { missing: [], extra: [] },
    );
    const required = new Intl.PluralRules(INTL_LOCALES[locale]).resolvedOptions().pluralCategories;
    const wrong = [];
    for (const [key, text] of own) {
      if (!text.trim() && TR.get(key) !== "") wrong.push(`${key}: boş`);
      const a = [...messageVariables(EN.get(key))].sort().join(",");
      const b = [...messageVariables(text)].sort().join(",");
      if (a !== b) wrong.push(`${key}: {${a}} ≠ {${b}}`);
      for (const block of pluralBlocks(text)) {
        const miss = required.filter((c) => block.branches[c] === undefined);
        if (miss.length) wrong.push(`${key}: çoğul eksik ${miss.join(",")}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
}

test("dil listesi: yerel adlar, yön, etiket eşleme", () => {
  assert.equal(LOCALE_NAMES.ja, "日本語");
  assert.equal(localeDirection("ar"), "rtl");
  assert.equal(localeDirection("de"), "ltr");
  assert.equal(matchLocaleTag("pt-PT"), "pt-BR");
  assert.equal(matchLocaleTag("es_MX"), "es-ES");
  assert.equal(matchLocaleTag("zh-Hant-TW"), null);
});

test("ICU çoğul", () => {
  const ru = "{count, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщения}}";
  assert.equal(formatMessage(ru, { count: 5 }, "ru-RU"), "5 сообщений");
  assert.equal(formatMessage(ru, { count: 22 }, "ru-RU"), "22 сообщения");
  assert.equal(formatMessage("{a} {b}", { a: 1 }, "en-US"), "1 {b}");
});
