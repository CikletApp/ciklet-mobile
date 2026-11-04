import { useState } from "react";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useAnnotation, useBlockUser, useOpenDirect, useRemoveFriend, useSaveAnnotation, type FriendEntry } from "@/api/hooks";
import { ActionSheet, showDialog, showToast, type ActionSheetItem } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { useCallActions } from "@/realtime/use-call-events";

/**
 * Arkadaş satırına basılı tutunca açılan menü — web
 * `components/friends/friend-context-menu.tsx` sırası ve metinleri:
 * Profil, Mesaj Gönder, Bir Arama Başlat, Sunucuya Davet Et, Arkadaşı Çıkar,
 * Yoksay, Engelle. Not/takma ad profil ekranındaki "Kişisel" kartında.
 */
interface InvitableServer {
  id: string;
  name: string;
  imageUrl: string;
  inviteCode: string;
}

const INVITABLE_SERVERS = "/api/servers/invitable";

function failText(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}

export function FriendActionsSheet({ entry, onClose }: { entry: FriendEntry | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const openDirect = useOpenDirect();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const { placeCall } = useCallActions();
  const annotation = useAnnotation(entry?.profile.id);
  const saveAnnotation = useSaveAnnotation(entry?.profile.id ?? "");
  const [inviteFor, setInviteFor] = useState<FriendEntry | null>(null);
  // Kısa ömürlü: katılma/ayrılma ya da rol değişikliği bir dakikada yansısın (web ile aynı).
  const invitable = useQuery({
    queryKey: ["invitable-servers"],
    enabled: Boolean(inviteFor),
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await api<InvitableServer[]>(INVITABLE_SERVERS);
      return Array.isArray(rows) ? rows : [];
    },
  });
  const servers = invitable.data ?? null;
  const serversFailed = invitable.isError;

  const name = entry ? displayNameOf(entry.profile) : "";

  const openChat = (friend: FriendEntry) =>
    openDirect.mutate(friend.profile.id, { onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`) });

  const startCall = (friend: FriendEntry) =>
    openDirect.mutate(friend.profile.id, {
      onSuccess: (direct) => placeCall(friend.profile, direct.id, "audio"),
    });

  const inviteToServer = async (friend: FriendEntry, server: InvitableServer) => {
    const friendName = displayNameOf(friend.profile);
    try {
      const direct = await api<{ id: string }>(endpoints.directInit, {
        method: "POST",
        body: { friendId: friend.profile.id },
      });
      await api(endpoints.sendDirectMessage(direct.id), {
        method: "POST",
        body: { content: `https://ciklet.xyz/i/${server.inviteCode}` },
      });
      void queryClient.invalidateQueries({ queryKey: qk.directs });
      showToast(`${server.name} davetiyesi ${friendName} kişisine gönderildi.`);
    } catch (reason) {
      showToast(failText(reason, "Davet gönderilemedi."), "error");
    }
  };

  const items: (ActionSheetItem | "separator")[] = entry
    ? [
        { key: "profile", label: "Profil", icon: "user", onPress: () => router.push(`/profile/${entry.profile.id}`) },
        { key: "message", label: "Mesaj Gönder", icon: "message", onPress: () => openChat(entry) },
        { key: "call", label: "Bir Arama Başlat", icon: "phone", onPress: () => startCall(entry) },
        "separator",
        { key: "invite", label: "Sunucuya Davet Et", icon: "user-plus", onPress: () => setInviteFor(entry) },
        {
          key: "remove",
          label: "Arkadaşı Çıkar",
          icon: "close",
          onPress: () =>
            showDialog(
              `'${name}' Arkadaşlıktan Çıkarılsın mı?`,
              `${name} adlı kullanıcıyı arkadaşlarından kalıcı olarak çıkarmak istediğine emin misin?`,
              [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Arkadaşı Çıkar",
                  style: "destructive",
                  onPress: () =>
                    removeFriend.mutate(entry.id, {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: qk.profileCard(entry.profile.id) });
                        showToast(`${name} arkadaşlarından çıkarıldı.`);
                      },
                    }),
                },
              ]
            ),
        },
        {
          key: "ignore",
          label: annotation?.ignored ? "Yoksaymayı Bırak" : "Yoksay",
          icon: "eye-off",
          onPress: () => {
            const ignored = !annotation?.ignored;
            saveAnnotation.mutate(
              { ignored },
              {
                onSuccess: () =>
                  showToast(
                    ignored
                      ? `${name} yoksayılıyor. Mesajları daraltılacak ve sana bildirim göndermeyecek.`
                      : `${name} artık yoksayılmıyor.`
                  ),
                onError: (reason) => showToast(failText(reason, "İşlem gerçekleştirilemedi."), "error"),
              }
            );
          },
        },
        {
          key: "block",
          label: "Engelle",
          icon: "shield",
          destructive: true,
          onPress: () =>
            showDialog(
              `'${name}' Engellensin mi?`,
              "Engellediğin kişi sana mesaj gönderemez ve seni arayamaz; arkadaşlığınız da sona erer.",
              [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Engelle",
                  style: "destructive",
                  onPress: () =>
                    blockUser.mutate(entry.profile.id, { onSuccess: () => showToast(`${name} engellendi.`) }),
                },
              ]
            ),
        },
      ]
    : [];

  const inviteItems: ActionSheetItem[] = !inviteFor
    ? []
    : serversFailed
      ? [{ key: "failed", label: "Sunucular alınamadı", icon: "close", onPress: () => undefined }]
      : !servers
        ? [{ key: "loading", label: "Yükleniyor…", icon: "clock", onPress: () => undefined }]
        : servers.length === 0
          ? [{ key: "none", label: "Davet edebileceğin sunucu yok", icon: "close", onPress: () => undefined }]
          : servers.map((server) => ({
              key: server.id,
              label: server.name,
              icon: "users" as const,
              avatar: { imageUrl: server.imageUrl, fallbackText: server.name },
              onPress: () => void inviteToServer(inviteFor, server),
            }));

  return (
    <>
      <ActionSheet visible={Boolean(entry)} onClose={onClose} items={items} />
      <ActionSheet
        visible={Boolean(inviteFor)}
        onClose={() => setInviteFor(null)}
        items={[{ heading: "Sunucuya Davet Et" }, ...inviteItems]}
      />
    </>
  );
}
