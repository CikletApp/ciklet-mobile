import { Linking } from "react-native";

import { showDialog } from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/config";

/**
 * Sohbetteki bağlantıların tek kapısı — web `lib/external-link` +
 * `hooks/use-external-link` karşılığı.
 *
 * Ciklet DIŞINA çıkan her bağlantı açılmadan önce GERÇEK adresi (alan adı
 * ayrıca yazılarak) gösteren bir onaydan geçer: markdown'daki
 * `[metin](adres)` ya da bot düğmesinde görünen metin ile gidilen adres
 * farklı olabilir. Onaysız açılan tek küme Ciklet'in kendi adresleri (marka
 * alan adları + API kökeni, alt alan adlarıyla) ve `mailto:` / `tel:`.
 *
 * Eşleşme tam alan adı ya da onun alt alan adıdır: `ciklet.xyz.evil.com` ve
 * `evil-ciklet.xyz` eşleşmez. Ayrıştırılamayan adres, kullanıcı bilgisi ya
 * da ters bölü taşıyan adres (`https://evil.com\@ciklet.xyz` tarayıcıda
 * evil.com'a gider) ve başka uygulama şeması (`intent:`, `market:`…) dış
 * sayılır. RN'nin `URL` uygulamasında `hostname` her sürümde olmadığı için
 * ana bilgisayar elle ayrıştırılır (bkz. lib/attachments).
 */

const BRAND_HOSTS = ["ciklet.xyz", "ciklet.app"];

/** http(s) adresinin ana bilgisayarı; şüpheli ya da ayrıştırılamazsa null. */
function httpHostOf(href: string): string | null {
  const match = /^https?:\/\/([^/?#]*)/i.exec(href.trim());
  if (!match) return null;
  const authority = match[1];
  if (!authority || /[\\@\s%]/.test(authority)) return null;
  const host = authority.replace(/:\d*$/, "").replace(/\.$/, "").toLowerCase();
  return host || null;
}

const OWN_HOSTS = [...new Set([...BRAND_HOSTS, httpHostOf(API_BASE_URL)].filter((host): host is string => !!host))];

function isCikletHost(host: string): boolean {
  return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
}

/** true → onay ister (Ciklet dışı site, bilinmeyen şema ya da bozuk adres). */
export function isExternalLink(href: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.trim())?.[1]?.toLowerCase();
  if (scheme === "mailto" || scheme === "tel") return false;
  if (scheme !== "http" && scheme !== "https") return true;
  const host = httpHostOf(href);
  return !host || !isCikletHost(host);
}

function open(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Bağlantıyı aç; Ciklet dışındaysa önce gerçek adresi gösterip onay iste. */
export function openGuardedLink(url: string | null | undefined) {
  if (!url) return;
  if (!isExternalLink(url)) {
    open(url);
    return;
  }
  const host = httpHostOf(url);
  showDialog(
    "Ciklet'ten ayrılıyorsun",
    host
      ? `Bu bağlantı seni ${host} sitesine götürüyor. Güvendiğin bir site değilse açma.\n\n${url}`
      : `Bu bağlantının gittiği yer doğrulanamadı. Güvendiğin bir adres değilse açma.\n\n${url}`,
    [
      { text: "Vazgeç", style: "cancel" },
      { text: "Aç", onPress: () => open(url) },
    ]
  );
}
