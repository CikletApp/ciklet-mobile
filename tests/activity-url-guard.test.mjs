// node --test tests/activity-url-guard.test.mjs  (Node 22.18+: .ts tür ayıklama)
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isBlockedHost,
  isHostDocumentUrl,
  navigationDecision,
  externalOpenableUrl,
} from "../src/features/activities/url-guard.ts";

const BASE = "https://ciklet.xyz";

test("IP değişmezleri ve yerel adlar engellenir", () => {
  for (const raw of [
    "https://127.0.0.1/",
    "https://10.0.0.5/",
    "https://192.168.1.1/",
    "https://169.254.169.254/latest",
    "https://2130706433/",
    "https://0x7f.1/",
    "https://127.1/",
    "https://[::1]/",
    "https://[fd00::1]/",
    "https://localhost/",
    "https://localhost./",
    "https://foo.localhost/",
    "https://router/",
    "https://printer.local/",
    "https://db.internal/",
    "https://nas.lan/",
  ]) {
    assert.equal(isBlockedHost(new URL(raw).hostname), true, raw);
  }
});

test("normal alan adları serbest", () => {
  for (const host of ["www.youtube.com", "i.ytimg.com", "ciklet.xyz", "a1.b2.example.com", "1password.com"]) {
    assert.equal(isBlockedHost(host), false, host);
  }
});

test("host belge adresi", () => {
  assert.equal(isHostDocumentUrl("https://ciklet.xyz", BASE), true);
  assert.equal(isHostDocumentUrl("https://ciklet.xyz/", BASE), true);
  assert.equal(isHostDocumentUrl("about:blank", BASE), true);
  assert.equal(isHostDocumentUrl(undefined, BASE), true);
  assert.equal(isHostDocumentUrl("https://ciklet.xyz/channels/me", BASE), false);
  assert.equal(isHostDocumentUrl("https://evil.example/", BASE), false);
  assert.equal(isHostDocumentUrl("https://watch.cikletimsi.site/", BASE), false);
});

test("üst çerçeve: yalnızca host belge, gerisi dışarıda", () => {
  assert.equal(navigationDecision({ url: "https://ciklet.xyz/", isTopFrame: true }, BASE), "allow");
  assert.equal(navigationDecision({ url: "about:blank", isTopFrame: true }, BASE), "allow");
  assert.equal(navigationDecision({ url: "https://www.youtube.com/watch?v=x", isTopFrame: true }, BASE), "external");
  assert.equal(navigationDecision({ url: "https://ciklet.xyz/login", isTopFrame: true }, BASE), "external");
  assert.equal(navigationDecision({ url: "javascript:alert(1)", isTopFrame: true }, BASE), "block");
  assert.equal(navigationDecision({ url: "data:text/html,hi", isTopFrame: true }, BASE), "block");
  assert.equal(navigationDecision({ url: "intent://x#Intent;end", isTopFrame: true }, BASE), "block");
  // Android (isTopFrame yok): http(s) yalnızca ana çerçeve için gelir.
  assert.equal(navigationDecision({ url: "https://evil.example/" }, BASE), "external");
  assert.equal(navigationDecision({ url: "https://ciklet.xyz" }, BASE), "allow");
  assert.equal(navigationDecision({ url: "blob:https://watch.cikletimsi.site/1" }, BASE), "allow");
  assert.equal(navigationDecision({ url: "file:///sdcard/x" }, BASE), "block");
});

test("alt çerçeveler: aktiviteler ve gömdükleri oynatıcılar çalışır", () => {
  for (const url of [
    "https://watch-together.cikletimsi.site/?instance_id=1",
    "https://globe.cikletimsi.site/",
    "https://tavla.cikletimsi.site/",
    "https://okey.cikletimsi.site/",
    "https://slowroads.cikletimsi.site/",
    "https://www.youtube-nocookie.com/embed/abc",
    "about:srcdoc",
    "blob:https://globe.cikletimsi.site/abc",
  ]) {
    assert.equal(navigationDecision({ url, isTopFrame: false }, BASE), "allow", url);
  }
  assert.equal(navigationDecision({ url: "file:///etc/passwd", isTopFrame: false }, BASE), "block");
  assert.equal(navigationDecision({ url: "intent://x", isTopFrame: false }, BASE), "block");
});

test("dışarıda açılabilir adres", () => {
  assert.equal(externalOpenableUrl("https://a.example/x"), "https://a.example/x");
  assert.equal(externalOpenableUrl("javascript:alert(1)"), null);
  assert.equal(externalOpenableUrl(""), null);
});
