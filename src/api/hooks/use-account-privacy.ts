import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../query-keys";
import type { CurrentProfile } from "../types";

/**
 * Ayarlar: gizlilik/KVKK, hesap durumu, vurgu kelimeleri, görevler, Ciklet
 * puanı ve Mentol ödeme geçmişi uçları (web ile aynı sözleşme).
 * Uçlar burada; `endpoints.ts` paylaşımlı olduğu için bu dosyada tutuluyor.
 */
export const accountEndpoints = {
  consents: "/api/account/consents",
  dataExport: "/api/account/data-export",
  deletion: "/api/account/deletion",
  dataRequests: "/api/account/data-requests",
  birthDate: "/api/account/birth-date",
  accountStatus: "/api/account-status",
  appeal: (violationId: string) => `/api/account-status/violations/${encodeURIComponent(violationId)}/appeal`,
  revokeOtherSessions: "/api/sessions/revoke-others",
  highlightKeywords: "/api/notification-settings/keywords",
  quests: "/api/quests",
  questAction: (questId: string, action: "enroll" | "claim") => `/api/quests/${encodeURIComponent(questId)}/${action}`,
  storePoints: "/api/store/points",
  mentolPayments: "/api/mentol/payments",
} as const;

// ── Profil ekleri (web `ClientProfile`; mobil tipte henüz yok) ──────────

export type AdultAssurance = "EXEMPT" | "SELF_DECLARED" | "PHONE" | string;

export interface ClientAgeStatus {
  band: string;
  adultVerified: boolean;
  assurance: AdultAssurance;
  teenSafe: boolean;
  needsBirthDate: boolean;
  blocked: boolean;
  canVerifyWithPhone: boolean;
}

export interface ProfileExtras {
  age?: ClientAgeStatus;
  blurSensitiveMedia?: boolean;
  groupDmFromServerMembers?: boolean;
  passwordChangedAt?: string | null;
}

export function profileExtras(profile: CurrentProfile | undefined | null): ProfileExtras {
  return (profile ?? {}) as ProfileExtras;
}

// ── Rızalar ────────────────────────────────────────────────────────────

export interface ConsentState {
  document: string;
  granted: boolean;
  version: string;
  at: string;
}

const consentsKey = ["account", "consents"] as const;

export function useConsents() {
  return useQuery({
    queryKey: consentsKey,
    queryFn: async () => (await api<{ consents: ConsentState[] }>(accountEndpoints.consents)).consents,
  });
}

export function useSetConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { document: string; granted: boolean }) =>
      api<{ consents: ConsentState[] }>(accountEndpoints.consents, { method: "POST", body: input }),
    onSuccess: (res) => queryClient.setQueryData(consentsKey, res.consents),
  });
}

// ── Hesap silme ────────────────────────────────────────────────────────

export interface DeletionState {
  pending: { id: string; status: string; createdAt: string; dueAt: string } | null;
  ownedServers: number;
}

const deletionKey = ["account", "deletion"] as const;

export function useDeletionState() {
  return useQuery({ queryKey: deletionKey, queryFn: () => api<DeletionState>(accountEndpoints.deletion) });
}

export function useRequestDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string; reason: string }) =>
      api<void>(accountEndpoints.deletion, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deletionKey }),
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(accountEndpoints.deletion, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deletionKey }),
  });
}

// ── KVKK başvuruları ───────────────────────────────────────────────────

export const DSR_FORM_KINDS = [
  "INFO",
  "ACCESS",
  "PURPOSE",
  "THIRD_PARTIES",
  "RECTIFICATION",
  "ERASURE",
  "NOTIFY_THIRD_PARTIES",
  "OBJECTION",
  "COMPENSATION",
] as const;
export type DsrFormKind = (typeof DSR_FORM_KINDS)[number];
export type DsrKind = DsrFormKind | "ACCOUNT_DELETION" | "UNDERAGE_ACCOUNT";
export type DsrStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "CANCELLED";
/** web lib/legal/dsr-kinds `DSR_DETAILS_MAX`. */
export const DSR_DETAILS_MAX = 4000;

export interface OwnDataRequest {
  id: string;
  kind: DsrKind;
  status: DsrStatus;
  details: string;
  response: string | null;
  createdAt: string;
  dueAt: string;
  decidedAt: string | null;
}

const dataRequestsKey = ["account", "data-requests"] as const;

export function useDataRequests() {
  return useQuery({ queryKey: dataRequestsKey, queryFn: () => api<OwnDataRequest[]>(accountEndpoints.dataRequests) });
}

export function useSubmitDataRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: DsrFormKind; details: string }) =>
      api<void>(accountEndpoints.dataRequests, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataRequestsKey }),
  });
}

export function useWithdrawDataRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`${accountEndpoints.dataRequests}?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataRequestsKey }),
  });
}

// ── Doğum tarihi ───────────────────────────────────────────────────────

export function useSaveBirthDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dateOfBirth: string) =>
      api<CurrentProfile>(accountEndpoints.birthDate, { method: "POST", body: { dateOfBirth } }),
    onSuccess: (profile) => queryClient.setQueryData(qk.currentProfile, profile),
  });
}

// ── Hesap durumu ───────────────────────────────────────────────────────

export type AccountStatusLevel = "GOOD" | "LIMITED" | "VERY_LIMITED" | "AT_RISK" | "SUSPENDED";

export interface StandingViolation {
  id: string;
  policyLabel: string;
  createdAt: string;
  expiresAt: string | null;
  restrictedUntil: string | null;
  active: boolean;
  content: string | null;
  appealStatus: "PENDING" | "ACCEPTED" | "REJECTED" | null;
  appealResponse: string | null;
  canAppeal: boolean;
}

export interface StandingResponse {
  accountStatus: AccountStatusLevel;
  trustScore?: number;
  restrictedUntil: string | null;
  violations: StandingViolation[];
}

const standingKey = ["account-status"] as const;

export function useAccountStanding() {
  return useQuery({ queryKey: standingKey, queryFn: () => api<StandingResponse>(accountEndpoints.accountStatus) });
}

export function useAppealViolation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api<void>(accountEndpoints.appeal(id), { method: "POST", body: { text } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: standingKey }),
  });
}

// ── Oturumlar ──────────────────────────────────────────────────────────

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(accountEndpoints.revokeOtherSessions, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
  });
}

// ── Vurgu kelimeleri ───────────────────────────────────────────────────

/** web lib/highlight-keywords ile aynı sınırlar. */
export const MAX_HIGHLIGHT_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 32;

/** web `normalizeKeywords`: kırp, küçült, boş/uzunları at, tekrarsız, sınırla. */
export function normalizeKeywords(input: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const word = raw.trim().replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    if (word.length < 2 || word.length > MAX_KEYWORD_LENGTH) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= MAX_HIGHLIGHT_KEYWORDS) break;
  }
  return out;
}

const keywordsKey = ["notification-settings", "keywords"] as const;

export function useHighlightKeywords() {
  return useQuery({
    queryKey: keywordsKey,
    queryFn: async () => {
      const res = await api<{ keywords?: string[] }>(accountEndpoints.highlightKeywords);
      return Array.isArray(res?.keywords) ? res.keywords : [];
    },
  });
}

export function useSaveHighlightKeywords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keywords: string[]) =>
      api<{ keywords: string[] }>(accountEndpoints.highlightKeywords, { method: "PUT", body: { keywords } }),
    onMutate: (keywords) => {
      const previous = queryClient.getQueryData<string[]>(keywordsKey);
      queryClient.setQueryData(keywordsKey, keywords);
      return { previous };
    },
    onError: (_error, _keywords, context) => queryClient.setQueryData(keywordsKey, context?.previous ?? []),
    onSuccess: (res) => queryClient.setQueryData(keywordsKey, res.keywords),
  });
}

// ── Görevler ───────────────────────────────────────────────────────────

export type QuestKind = "PLAY_GAME" | "VOICE_TIME" | "ACTIVITY_TIME" | "CREATE_SERVER" | "INVITE_FRIEND" | "STREAK";
export type QuestStatus = "available" | "enrolled" | "completed" | "claimed" | "expired";

/** web lib/quests/shared `QuestListEntry`. */
export interface QuestEntry {
  id: string;
  kind: QuestKind;
  title: string;
  description: string | null;
  targetName: string | null;
  targetValue: number;
  streakUnit: "DAY" | "WEEK" | null;
  streakSource: "VOICE" | "GAME" | "ACTIVITY" | null;
  streakMinutes: number | null;
  rewardPoints: number;
  rewardItemId: string | null;
  rewardMentolPlan: "PLUS" | "PRO" | null;
  rewardMentolDays: number | null;
  sponsorName: string | null;
  sponsorImageUrl: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: QuestStatus;
  enrolledAt: string | null;
  claimedAt: string | null;
  progress: { value: number; target: number; complete: boolean } | null;
}

export interface QuestsResponse {
  balance: number;
  lifetimeEarned: number;
  quests: QuestEntry[];
}

const questsKey = ["quests"] as const;

export function useQuests() {
  return useQuery({ queryKey: questsKey, queryFn: () => api<QuestsResponse>(accountEndpoints.quests) });
}

export interface QuestClaimResult {
  status?: "claimed" | "already_claimed";
  itemAlreadyOwned?: boolean;
}

export function useQuestAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, action }: { questId: string; action: "enroll" | "claim" }) =>
      api<QuestClaimResult>(accountEndpoints.questAction(questId, action), { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: questsKey }),
  });
}

/** Ciklet puan bakiyesi (görevler ucundan; mağaza da aynı değeri gösterir). */
export function usePointsBalance() {
  return useQuery({
    queryKey: questsKey,
    queryFn: () => api<QuestsResponse>(accountEndpoints.quests),
    select: (data) => data.balance,
  });
}

export function useBuyWithPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: true; balance: number }>(accountEndpoints.storePoints, { method: "POST", body: { itemId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: questsKey });
      void queryClient.invalidateQueries({ queryKey: ["store"] });
    },
  });
}

// ── Mentol ödeme geçmişi ───────────────────────────────────────────────

export function useMentolPayments<T>() {
  return useQuery({ queryKey: ["mentol", "payments"], queryFn: () => api<T>(accountEndpoints.mentolPayments) });
}
