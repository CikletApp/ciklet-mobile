import { create } from "zustand";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { MessageKey } from "@/lib/i18n";

/**
 * Aile Merkezi — web `lib/family-center` uçlarının istemcisi (aynı biçimler).
 * Özet yalnızca adları ve sayıları taşır; mesaj içeriği hiç gelmez.
 */

export interface FamilyPerson {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}
export interface FamilyServer {
  id: string;
  name: string;
  imageUrl: string | null;
}
export interface FamilyLinkView {
  id: string;
  status: "PENDING" | "ACTIVE";
  side: "parent" | "teen";
  other: FamilyPerson;
  createdAt: string;
  acceptedAt: string | null;
  weeklyEmail: boolean;
}
export interface FamilyOverview {
  role: "teen" | "parent" | "ineligible";
  links: FamilyLinkView[];
  code: { active: boolean; expiresAt: string | null };
}
export interface FamilyCode {
  code: string;
  display: string;
  url: string;
  qr: string;
  expiresAt: string;
}
export interface FamilySummary {
  since: string;
  until: string;
  newFriends: { total: number; items: FamilyPerson[] };
  serversJoined: { total: number; items: FamilyServer[] };
  usersMessaged: { total: number; items: FamilyPerson[] };
  usersCalled: { total: number; items: FamilyPerson[] };
}

export const fetchOverview = () => api<FamilyOverview>(endpoints.familyCenter);
export const createCode = () => api<FamilyCode>(endpoints.familyCenterCode, { method: "POST" });
export const requestLink = (code: string) =>
  api<{ linkId: string; teen: FamilyPerson }>(endpoints.familyCenterLinks, { method: "POST", body: { code } });
export const respondLink = (linkId: string, action: "accept" | "decline") =>
  api(endpoints.familyCenterLink(linkId), { method: "PATCH", body: { action } });
export const setWeeklyEmail = (linkId: string, weeklyEmail: boolean) =>
  api(endpoints.familyCenterLink(linkId), { method: "PATCH", body: { weeklyEmail } });
export const removeLink = (linkId: string) => api(endpoints.familyCenterLink(linkId), { method: "DELETE" });
export const fetchSummary = (teenId?: string) =>
  api<FamilySummary>(teenId ? `${endpoints.familyCenterSummary}?teenId=${encodeURIComponent(teenId)}` : endpoints.familyCenterSummary);

const ERROR_CODES = new Set([
  "invalid_code", "not_parent", "not_teen", "self_link", "teen_has_parent",
  "parent_limit", "already_linked", "rate_limited",
]);

/** Sunucu hata kodu → web ile aynı metin anahtarı. */
export function familyErrorKey(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  return (code && ERROR_CODES.has(code) ? `familyCenter.errors.${code}` : "familyCenter.errors.generic") as MessageKey;
}

/** QR'dan okunan kodu Aile Merkezi ekranına taşır (tarama ekranı geri dönünce). */
export const useScannedFamilyCode = create<{ code: string | null; set: (code: string | null) => void }>((set) => ({
  code: null,
  set: (code) => set({ code }),
}));

/** Kod ya da QR bağlantısı → "ABCD2345" (web `normalizeLinkCode` ile aynı kural). */
export function normalizeFamilyCode(raw: string): string | null {
  let value = raw.trim();
  const match = value.match(/[?&]code=([A-Za-z0-9-]+)/);
  if (match) value = match[1];
  value = value.replace(/[\s-]/g, "").toUpperCase();
  if (value.length !== 8) return null;
  return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(value) ? value : null;
}
