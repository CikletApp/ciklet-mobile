// node --import ./tests/helpers/register-ts.mjs --test tests/connection-providers.test.mjs
// Hesap bağlama dönüşü (web /oauth/desktop-return → ciklet://me?<sağlayıcı>=<sonuç>).
import { test } from "node:test";
import assert from "node:assert/strict";

import { isConnectionReturnUrl, readConnectionResults } from "../src/lib/connection-providers.ts";

test("bilinen sağlayıcı ve sonuçlar okunur, gerisi yok sayılır", () => {
  assert.deepEqual(readConnectionResults("ciklet://me?steam=linked&x=taken&foo=1&github=hack"), [
    { provider: "steam", label: "Steam", result: "linked" },
    { provider: "x", label: "X", result: "taken" },
  ]);
  assert.deepEqual(readConnectionResults("ciklet://me"), []);
  assert.deepEqual(readConnectionResults("ciklet://me?riot=linked"), []);
});

test("yalnızca bağlama dönüşü yutulur", () => {
  assert.equal(isConnectionReturnUrl("ciklet://me?github=denied"), true);
  assert.equal(isConnectionReturnUrl("/me?spotify=linked"), true);
  assert.equal(isConnectionReturnUrl("ciklet://me"), false);
  assert.equal(isConnectionReturnUrl("ciklet://servers/1?steam=linked"), false);
  assert.equal(isConnectionReturnUrl("ciklet://meet?steam=linked"), false);
});
