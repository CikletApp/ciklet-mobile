// node --import ./tests/helpers/register-ts.mjs --test tests/text-format.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyTextFormat } from "../src/features/chat/text-format.ts";

test("kalın: sarar ve geri alır", () => {
  const a = applyTextFormat("merhaba dünya", 0, 7, "bold");
  assert.deepEqual(a, { value: "**merhaba** dünya", start: 2, end: 9 });
  assert.deepEqual(applyTextFormat(a.value, a.start, a.end, "bold"), { value: "merhaba dünya", start: 0, end: 7 });
});

test("italik kalının içinde ayrı biçim", () => {
  const a = applyTextFormat("**x**", 2, 3, "italic");
  assert.equal(a.value, "***x***");
  assert.equal(applyTextFormat(a.value, a.start, a.end, "italic").value, "**x**");
  assert.equal(applyTextFormat("**x**", 2, 3, "bold").value, "x");
});

test("seçili metin işaretleriyle seçildiyse işaret kalkar", () => {
  assert.deepEqual(applyTextFormat("a ~~b~~ c", 2, 7, "strike"), { value: "a b c", start: 2, end: 3 });
});

test("boş seçim: imleç işaretlerin arasına", () => {
  assert.deepEqual(applyTextFormat("ab", 1, 1, "spoiler"), { value: "a||||b", start: 3, end: 3 });
});

test("başlık ve alıntı satır başına eklenir, ikinci basışta kalkar", () => {
  const h = applyTextFormat("bir\niki", 5, 5, "heading");
  assert.equal(h.value, "bir\n# iki");
  assert.equal(applyTextFormat(h.value, 6, 6, "heading").value, "bir\niki");
  const q = applyTextFormat("bir\niki", 0, 7, "quote");
  assert.equal(q.value, "> bir\n> iki");
  assert.equal(applyTextFormat(q.value, q.start, q.end, "quote").value, "bir\niki");
});

test("kod bloğu", () => {
  const c = applyTextFormat("x = 1", 0, 5, "codeBlock");
  assert.deepEqual(c, { value: "```\nx = 1\n```", start: 4, end: 9 });
  assert.equal(applyTextFormat(c.value, c.start, c.end, "codeBlock").value, "x = 1");
});
