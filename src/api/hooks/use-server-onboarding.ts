import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { GuideConfig, GuideView } from "@/lib/server-guide";
import type { OnboardingAnswers, OnboardingConfig } from "@/lib/server-onboarding";
import type { WelcomeChannelEntry, WelcomeScreenView } from "@/lib/welcome-screen";

/**
 * Sunucuya katılım akışı — web'deki üç parça:
 *   • Katılım Soruları (`/onboarding`): soru perdesi + ayar ekranı
 *   • Karşılama Ekranı (`/welcome-screen`): yeni üyeye bir kez açılan pencere + ayar
 *   • Sunucu Rehberi (`/guide`): kalıcı başlangıç sayfası + ayar
 * Tipler ve sınırlar `lib/server-onboarding`, `lib/welcome-screen`,
 * `lib/server-guide` (web modüllerinin kopyaları).
 */

// ── Katılım Soruları ────────────────────────────────────────────────

export interface ServerOnboardingState {
  serverName: string;
  config: OnboardingConfig;
  /** Üyenin soruları yanıtlaması gerekiyor mu (sahip/yönetici muaf). */
  pending: boolean;
  rulesPending: boolean;
  answers: OnboardingAnswers;
}

const onboardingKey = (serverId: string) => ["server-onboarding", serverId] as const;
const guideKey = (serverId: string) => ["server-guide", serverId] as const;

export function useServerOnboarding(serverId: string | undefined) {
  return useQuery({
    queryKey: onboardingKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerOnboardingState>(endpoints.serverOnboarding(serverId!)),
    staleTime: 5 * 60_000,
  });
}

export function useSaveOnboarding(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: OnboardingConfig) =>
      api<{ config: OnboardingConfig }>(endpoints.serverOnboarding(serverId), { method: "PUT", body: config }),
    onSuccess: ({ config }) => {
      queryClient.setQueryData<ServerOnboardingState>(onboardingKey(serverId), (state) => (state ? { ...state, config } : state));
    },
  });
}

/** Yanıtları gönderir: roller bağlanır, seçilen kanallar döner (ilkine gidilir). */
export function useCompleteOnboarding(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: OnboardingAnswers) =>
      api<{ ok: true; channelIds: string[] }>(endpoints.serverOnboardingComplete(serverId), {
        method: "POST",
        body: { answers },
      }),
    onSuccess: (_result, answers) => {
      queryClient.setQueryData<ServerOnboardingState>(onboardingKey(serverId), (state) =>
        state ? { ...state, pending: false, answers } : state
      );
      // Roller değişti: görünen kanallar, izinler ve rehber (rolle açılan kanallar) tazelensin.
      void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) });
      void queryClient.invalidateQueries({ queryKey: qk.myPermissions(serverId) });
      void queryClient.invalidateQueries({ queryKey: guideKey(serverId) });
      void queryClient.invalidateQueries({ queryKey: ["server-roles", serverId] });
    },
  });
}

// ── Karşılama Ekranı ────────────────────────────────────────────────

const welcomeKey = (serverId: string) => ["server-welcome-screen", serverId] as const;

export function useWelcomeScreen(serverId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: welcomeKey(serverId ?? "yok"),
    enabled: Boolean(serverId) && enabled,
    queryFn: () => api<WelcomeScreenView>(endpoints.serverWelcomeScreen(serverId!)),
    staleTime: 5 * 60_000,
  });
}

export interface WelcomeScreenInput {
  enabled: boolean;
  description: string | null;
  channels: WelcomeChannelEntry[];
}

export function useSaveWelcomeScreen(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WelcomeScreenInput) =>
      api<WelcomeScreenView>(endpoints.serverWelcomeScreen(serverId), { method: "PUT", body: input }),
    onSuccess: (screen) => queryClient.setQueryData(welcomeKey(serverId), screen),
  });
}

// ── Sunucu Rehberi ──────────────────────────────────────────────────

export interface ServerGuideResponse {
  /** Üyenin görünümü; rehber kapalıysa ya da üye değilse null. */
  guide: GuideView | null;
  /** Üye rehberi hiç açmamış: sunucu kökü bir kez rehbere götürür. */
  shouldOpen?: boolean;
  /** Yalnızca Sunucuyu Yönet izni olana: yapılandırmanın tamamı. */
  config?: GuideConfig;
}

export function useServerGuide(serverId: string | undefined) {
  return useQuery({
    queryKey: guideKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerGuideResponse>(endpoints.serverGuide(serverId!)),
    staleTime: 60_000,
  });
}

export function useSaveGuide(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: GuideConfig) =>
      api<{ config: GuideConfig }>(endpoints.serverGuide(serverId), { method: "PUT", body: config }),
    // Üye görünümü (kanal adları, görünürlük) sunucuda kurulur: yeniden okunur.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: guideKey(serverId) }),
  });
}

function setCompleted(queryClient: ReturnType<typeof useQueryClient>, serverId: string, update: (current: string[]) => string[]) {
  queryClient.setQueryData<ServerGuideResponse>(guideKey(serverId), (data) =>
    data?.guide ? { ...data, guide: { ...data.guide, completed: update(data.guide.completed) } } : data
  );
}

/** Yapılacak elle işaretle / kaldır — iyimser; hata olursa geri alınır. */
export function useToggleGuideTask(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      api<{ completed: string[] }>(endpoints.serverGuideProgress(serverId), { method: "POST", body: { taskId, done } }),
    onMutate: ({ taskId, done }) => {
      const previous = queryClient.getQueryData<ServerGuideResponse>(guideKey(serverId))?.guide?.completed ?? [];
      setCompleted(queryClient, serverId, (current) =>
        done ? [...new Set([...current, taskId])] : current.filter((id) => id !== taskId)
      );
      return { previous };
    },
    onSuccess: ({ completed }) => setCompleted(queryClient, serverId, () => completed),
    onError: (_error, _input, context) => {
      if (context) setCompleted(queryClient, serverId, () => context.previous);
    },
  });
}

/** Rehber ilk kez açıldı: sunucu kökü bir daha yönlendirmez (web rehber sayfası yüklenince yapar). */
export function useMarkGuideSeen(serverId: string | undefined, active: boolean) {
  const queryClient = useQueryClient();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!serverId || !active || sent.current === serverId) return;
    sent.current = serverId;
    void api(endpoints.serverGuideProgress(serverId), { method: "POST", body: { seen: true } })
      .then(() =>
        queryClient.setQueryData<ServerGuideResponse>(guideKey(serverId), (data) => (data ? { ...data, shouldOpen: false } : data))
      )
      .catch(() => {
        sent.current = null;
      });
  }, [serverId, active, queryClient]);
}

/**
 * Kanal açıldı: o kanala bağlı, henüz yapılmamış yapılacaklar tamamlanır
 * (web kanal sayfası sunucuda yapar). İstek yalnızca böyle bir yapılacak
 * varsa atılır — rehber önbellekteki görünümden okunur.
 */
export function useGuideVisit(serverId: string | undefined, channelId: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useServerGuide(serverId);
  const guide = data?.guide;
  const due = Boolean(
    guide && channelId && guide.tasks.some((task) => task.channelId === channelId && !guide.completed.includes(task.id))
  );
  useEffect(() => {
    if (!serverId || !channelId || !due) return;
    void api<{ added: string[] }>(endpoints.serverGuideProgress(serverId), {
      method: "POST",
      body: { visitChannelId: channelId },
    })
      .then(({ added }) => {
        if (added.length) setCompleted(queryClient, serverId, (current) => [...new Set([...current, ...added])]);
      })
      .catch(() => undefined);
  }, [serverId, channelId, due, queryClient]);
}
