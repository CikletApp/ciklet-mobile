import { useCallback, useEffect, useState } from "react";

import { showToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/stores/auth";
import {
  MAX_ACCOUNTS,
  beginAddAccount,
  listSwitcherAccounts,
  removeSavedAccount,
  switchToAccount,
  type SwitcherAccount,
} from "./switcher";

/** Hesap listesi + eylemler — Ayarlar → Hesap Değiştir ve karşılama ekranı (web ile aynı davranış). */
export function useSwitcherAccounts() {
  const t = useT();
  const [accounts, setAccounts] = useState<SwitcherAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    void listSwitcherAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const onSwitch = useCallback(async (account: SwitcherAccount) => {
    if (busy || account.current) return;
    setBusy(account.id);
    const result = await switchToAccount(account.id);
    setBusy(null);
    if (result === "needsLogin") {
      // Oturumu düşmüş hesap: ekle akışı, kullanıcı adı dolu (parola + 2FA yine sorulur).
      if (useAuth.getState().status === "signedIn") {
        const started = await beginAddAccount({ reauth: true });
        if (started === "limit") { showToast(t("accountSwitcher.limitReached", { max: MAX_ACCOUNTS }), "error"); return; }
      }
      // Karşılama ekranı bu ipucuyla girişi kullanıcı adı dolu açar.
      useAuth.setState({ loginHint: account.username });
    } else if (result === "failed") {
      showToast(t("accountSwitcher.failed"), "error");
      reload();
    }
  }, [busy, reload, t]);

  const onAdd = useCallback(async () => {
    const started = await beginAddAccount();
    if (started === "limit") showToast(t("accountSwitcher.limitReached", { max: MAX_ACCOUNTS }), "error");
  }, [t]);

  const onRemove = useCallback(async (account: SwitcherAccount) => {
    if (await removeSavedAccount(account.id)) {
      showToast(t("accountSwitcher.removed"));
      reload();
    }
  }, [reload, t]);

  return { accounts, busy, reload, onSwitch, onAdd, onRemove };
}

export const accountDisplayName = (account: { name: string | null; username: string }) =>
  account.name?.trim() || account.username;
