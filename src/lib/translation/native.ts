/**
 * Mesaj çevirisi — mobil motor ve durum (web hooks/use-message-translation
 * karşılığı; aynı davranış, aynı metinler).
 *
 * Motor yerel modül (modules/ciklet-translate): Android'de ML Kit, iOS 18+'da
 * Apple Translation. Çeviri cihazda; mesaj içeriği sunucuya gitmez. Sonuçlar
 * lib/translation/core'un bellek içi önbelleğinde.
 */
import { useCallback } from "react";
import { create } from "zustand";

import { CikletTranslate } from "../../../modules/ciklet-translate";
import { showToast } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
import {
  languageName,
  normalizeLanguageTag,
  resolveTargetLanguage,
  TranslationCache,
  TranslationError,
  translateMessage,
  type TranslationEngine,
} from "./core";

export function nativeTranslationSupported(): boolean {
  try {
    return Boolean(CikletTranslate?.isSupported());
  } catch {
    return false;
  }
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
}

const engine: TranslationEngine = {
  detect: async (text) => {
    if (!CikletTranslate) throw new TranslationError("unsupported");
    return normalizeLanguageTag(await CikletTranslate.detectLanguage(text));
  },
  translate: async (text, source, target) => {
    if (!CikletTranslate) throw new TranslationError("unsupported");
    try {
      return await CikletTranslate.translate(text, source, target);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ERR_UNAVAILABLE") throw new TranslationError("unavailable");
      if (code === "ERR_UNSUPPORTED") throw new TranslationError("unsupported");
      throw new TranslationError("failed");
    }
  },
};

const cache = new TranslationCache();

export type MessageTranslationEntry =
  | { status: "loading" }
  | { status: "done"; text: string; source: string; showOriginal: boolean };

interface TranslationState {
  entries: Record<string, MessageTranslationEntry>;
  toggleOriginal: (messageId: string) => void;
  dismiss: (messageId: string) => void;
  clear: () => void;
}

export const useMessageTranslation = create<TranslationState>((set) => ({
  entries: {},
  toggleOriginal: (messageId) =>
    set((state) => {
      const entry = state.entries[messageId];
      if (!entry || entry.status !== "done") return state;
      return { entries: { ...state.entries, [messageId]: { ...entry, showOriginal: !entry.showOriginal } } };
    }),
  dismiss: (messageId) =>
    set((state) => {
      if (!state.entries[messageId]) return state;
      const entries = { ...state.entries };
      delete entries[messageId];
      return { entries };
    }),
  clear: () => set({ entries: {} }),
}));

// Hedef dil değişince açık çeviriler eski dilde kalmasın (web ile aynı).
let lastTarget = usePreferences.getState().translationTarget;
usePreferences.subscribe((state) => {
  if (state.translationTarget !== lastTarget) {
    lastTarget = state.translationTarget;
    useMessageTranslation.getState().clear();
  }
});

export function useMessageTranslationEntry(messageId: string): MessageTranslationEntry | undefined {
  return useMessageTranslation((state) => state.entries[messageId]);
}

export function useTranslationTarget(): string {
  const locale = useLocale();
  const preference = usePreferences((state) => state.translationTarget);
  return resolveTargetLanguage(preference, locale);
}

/** Menüdeki "Çevir". */
export function useTranslateMessage(): (messageId: string, content: string) => void {
  const t = useT();
  const locale = useLocale();
  const target = useTranslationTarget();
  return useCallback(
    (messageId, content) => {
      if (!nativeTranslationSupported()) {
        showToast(t("translation.menu.unsupportedDevice"));
        return;
      }
      const set = useMessageTranslation.setState;
      set((s) => ({ entries: { ...s.entries, [messageId]: { status: "loading" } } }));
      void translateMessage({ engine, cache, messageId, content, target })
        .then((result) => {
          if (result.kind === "same") {
            useMessageTranslation.getState().dismiss(messageId);
            showToast(t("translation.errors.same", { language: languageName(result.target, locale) }));
            return;
          }
          set((s) => ({
            entries: { ...s.entries, [messageId]: { status: "done", text: result.text, source: result.source, showOriginal: false } },
          }));
        })
        .catch((error: unknown) => {
          useMessageTranslation.getState().dismiss(messageId);
          const code = error instanceof TranslationError ? error.code : "failed";
          showToast(
            code === "unsupported"
              ? t("translation.menu.unsupportedDevice")
              : code === "unavailable"
                ? t("translation.errors.unavailable")
                : code === "undetected"
                  ? t("translation.errors.undetected")
                  : code === "empty"
                    ? t("translation.errors.empty")
                    : t("translation.errors.failed"),
          );
        });
    },
    [locale, t, target],
  );
}
