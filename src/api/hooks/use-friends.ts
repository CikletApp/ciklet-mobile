import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FriendRequestStatus,
  type FriendWithProfiles,
  type PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Arkadaşlık kayıtları. Sunucu tek listede üç durumu birden döner
 * (`PENDING` / `ACCEPTED` / `BLOCKED`); ayrıştırma istemcide yapılır.
 */
export function useFriendships() {
  return useQuery({
    queryKey: qk.friends,
    queryFn: () => api<FriendWithProfiles[]>(endpoints.friends),
  });
}

export interface FriendEntry {
  /** Friend kaydının kimliği — kabul/sil işlemleri bunu kullanır. */
  id: string;
  profile: PublicProfile;
}

/**
 * Arkadaş listesini üç kovaya ayırır:
 *  - `accepted`  kabul edilmiş arkadaşlar (ada göre sıralı)
 *  - `incoming`  bana gelen, yanıt bekleyen istekler
 *  - `outgoing`  benim gönderdiğim, yanıt bekleyen istekler
 *
 * Yönü belirleyen `profileOneId` alanıdır: isteği BAŞLATAN taraf odur.
 */
export function useFriends() {
  const query = useFriendships();
  const myId = useAuth((s) => s.profile?.id);

  const buckets = useMemo(() => {
    const accepted: FriendEntry[] = [];
    const incoming: FriendEntry[] = [];
    const outgoing: FriendEntry[] = [];

    for (const row of query.data ?? []) {
      if (!myId) break;
      const iAmInitiator = row.profileOneId === myId;
      const other = iAmInitiator ? row.profileTwo : row.profileOne;
      const entry: FriendEntry = { id: row.id, profile: other };

      if (row.status === FriendRequestStatus.ACCEPTED) accepted.push(entry);
      else if (row.status === FriendRequestStatus.PENDING) {
        (iAmInitiator ? outgoing : incoming).push(entry);
      }
    }

    const byName = (a: FriendEntry, b: FriendEntry) =>
      displayName(a.profile).localeCompare(displayName(b.profile), "tr");

    return {
      accepted: accepted.sort(byName),
      incoming: incoming.sort(byName),
      outgoing: outgoing.sort(byName),
    };
  }, [query.data, myId]);

  return { ...query, ...buckets };
}

/** Kullanıcı adıyla arkadaşlık isteği gönder. */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUsername: string) =>
      api(endpoints.friends, { method: "POST", body: { targetUsername } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.friends });
    },
  });
}

/** Gelen isteği kabul et. */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) =>
      api(endpoints.friend(friendId), {
        method: "PATCH",
        body: { status: FriendRequestStatus.ACCEPTED },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.friends });
    },
  });
}

/** İsteği reddet, iptal et veya arkadaşlıktan çıkar — hepsi aynı uç. */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) =>
      api(endpoints.friend(friendId), { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.friends });
    },
  });
}

/** Görünen ad: takma ad > gerçek ad > kullanıcı adı. */
export function displayName(profile: Pick<PublicProfile, "name" | "username">) {
  return profile.name?.trim() || profile.username;
}
