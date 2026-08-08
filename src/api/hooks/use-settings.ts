import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLIENT_VERSION, getDeviceId } from "@/lib/device";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { AccountSession, AuthorizedApplication } from "../types";

export function useAccountSessions() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: async () => {
      const deviceToken = await getDeviceId();
      await api<AccountSession>(endpoints.sessions, {
        method: "POST",
        body: {
          deviceToken,
          hwid: deviceToken,
          clientType: "MOBILE",
          userAgent: `Ciklet Mobile/${CLIENT_VERSION} (${Platform.OS})`,
        },
      });
      return api<AccountSession[]>(endpoints.sessions);
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api<void>(endpoints.session(sessionId), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
  });
}

export function useAuthorizedApps() {
  return useQuery({
    queryKey: qk.authorizedApps,
    queryFn: () => api<AuthorizedApplication[]>(endpoints.authorizedApps),
  });
}

export function useRevokeAuthorizedApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (authorizationId: string) =>
      api<void>(`${endpoints.authorizedApps}?id=${encodeURIComponent(authorizationId)}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.authorizedApps }),
  });
}
