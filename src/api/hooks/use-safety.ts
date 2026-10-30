import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import type { JoinAnswer, JoinApplicationStatus, JoinQuestion } from "@/lib/join-application";
import type { QuarantineInfo } from "@/lib/quarantine";
import type { SafetyAlertAction, SafetyAlertMeta } from "@/lib/safety";

/**
 * Güvenlik Eylemleri, karantina ve Katılım Başvurusu — web
 * `safety-section.tsx`, `join-application-section.tsx`,
 * `join-application-dialog.tsx` ve `safety-alert-card.tsx`'in verisi. Yetki
 * uçlarda (Sunucuyu Yönet / Üyeleri At / Yasakla / Zaman Aşımı).
 */
export interface ServerSafetyState {
  invitesPausedUntil: string | null;
  dmsPausedUntil: string | null;
  safetyAlertsChannelId?: string | null;
  quarantinedCount?: number;
  pendingApplications?: number;
}

export interface QuarantinedMember {
  memberId: string;
  nickname: string | null;
  quarantinedAt: string | null;
  quarantine: QuarantineInfo | null;
  profile: { id: string; username: string; name: string | null; imageUrl: string | null };
}

export interface PendingApplication {
  id: string;
  answers: JoinAnswer[];
  createdAt: string;
  profile: { id: string; username: string; name: string | null; imageUrl: string | null; createdAt: string };
}

export interface JoinApplicationForm {
  server: { id: string; name: string; imageUrl: string };
  description: string;
  questions: JoinQuestion[];
  requireRules: boolean;
  rulesText: string | null;
  application: { id?: string; status: JoinApplicationStatus; rejectionReason: string | null } | null;
}

const safetyKey = (serverId: string) => ["server-safety", serverId] as const;
const quarantineKey = (serverId: string) => ["server-quarantine", serverId] as const;
const applicationsKey = (serverId: string) => ["server-join-applications", serverId] as const;

export function useServerSafety(serverId: string | undefined) {
  return useQuery({
    queryKey: safetyKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerSafetyState>(endpoints.serverSafety(serverId!)),
  });
}

/** Davet / DM duraklatma (anında; kayıt çubuğuna bağlı değil). 0 saat = yeniden aç. */
export function useSetServerPauses(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { invitesHours?: number; dmsHours?: number }) =>
      api<ServerSafetyState>(endpoints.serverSafety(serverId), { method: "POST", body: input }),
    onSuccess: (state) => {
      queryClient.setQueryData<ServerSafetyState>(safetyKey(serverId), (prev) => ({ ...prev, ...state }));
    },
  });
}

export function useQuarantinedMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: quarantineKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => (await api<{ members: QuarantinedMember[] }>(endpoints.serverQuarantine(serverId!))).members ?? [],
  });
}

export function useLiftQuarantine(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api<{ ok: true; lifted: boolean }>(endpoints.serverQuarantineMember(serverId, memberId), { method: "DELETE" }),
    onSuccess: (_res, memberId) => {
      queryClient.setQueryData<QuarantinedMember[]>(quarantineKey(serverId), (prev) => (prev ?? []).filter((m) => m.memberId !== memberId));
    },
  });
}

export function useSafetyAlertAction(serverId: string) {
  return useMutation({
    mutationFn: (input: { messageId: string; action: SafetyAlertAction }) =>
      api<{ alert: SafetyAlertMeta }>(endpoints.serverSafetyAlert(serverId, input.messageId), { method: "POST", body: { action: input.action } }),
  });
}

export function usePendingApplications(serverId: string | undefined) {
  return useQuery({
    queryKey: applicationsKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => (await api<{ applications: PendingApplication[] }>(endpoints.joinApplications(serverId!))).applications ?? [],
  });
}

export function useReviewApplication(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicationId: string; action: "approve" | "reject"; reason?: string }) =>
      api<{ ok: true }>(endpoints.joinApplicationReview(serverId, input.applicationId), {
        method: "PATCH",
        body: { action: input.action, ...(input.action === "reject" ? { reason: input.reason ?? "" } : {}) },
      }),
    onSuccess: (_res, input) => {
      queryClient.setQueryData<PendingApplication[]>(applicationsKey(serverId), (prev) => (prev ?? []).filter((a) => a.id !== input.applicationId));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: applicationsKey(serverId) });
    },
  });
}

/** Başvuranın formu (`code`: davet; gizli sunucuda şart). */
export function useJoinApplicationForm(serverId: string | null, code: string | null) {
  return useQuery({
    queryKey: ["join-application-form", serverId ?? "yok", code ?? ""] as const,
    enabled: Boolean(serverId),
    queryFn: () => api<JoinApplicationForm>(endpoints.joinApplication(serverId!, code)),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useSubmitJoinApplication(serverId: string) {
  return useMutation({
    mutationFn: (input: { code: string | null; rulesAccepted: boolean; answers: { questionId: string; value: string }[] }) =>
      api<{ ok: true; application: { id: string; status: JoinApplicationStatus } }>(endpoints.joinApplication(serverId), { method: "POST", body: input }),
  });
}
