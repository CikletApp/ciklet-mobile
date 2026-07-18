import { create } from "zustand";
import type { OwnProfile } from "@ciklet/embedded-activities-sdk/types";

import * as apiClient from "@/api/client";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  profile: OwnProfile | null;
  /** Açılışta güvenli depodan oturumu yükler ve token'ı tazeler. */
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  profile: null,

  bootstrap: async () => {
    const session = await apiClient.getSession();
    if (!session) {
      set({ status: "signedOut" });
      return;
    }
    const ok = await apiClient.refreshSession();
    if (!ok) {
      set({ status: "signedOut", profile: null });
      return;
    }
    try {
      const profile = await apiClient.api<OwnProfile>("/api/current-profile");
      set({ status: "signedIn", profile });
    } catch {
      set({ status: "signedOut", profile: null });
    }
  },

  login: async (username, password) => {
    const res = await apiClient.login({
      username,
      password,
      clientType: "mobile",
    });
    set({ status: "signedIn", profile: res.profile });
  },

  logout: async () => {
    await apiClient.logout();
    set({ status: "signedOut", profile: null });
  },
}));
