import { ApiError } from "@/api/client";
import { useMyServerTag, useSetMyServerTag } from "@/api/hooks";
import { showToast, type ActionSheetItem } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * Sunucu menüsündeki "Etiketi Kullan" / "Etiketi Bırak" (Discord "Adopt
 * Tag") — web `components/server-tag/server-tag-menu-item.tsx` karşılığı.
 * Yalnızca etiketi açık sunucuda görünür (seçilebilir listede olması bunu
 * garanti eder). `open` menü açıkken sorguyu başlatır.
 */
export function useServerTagMenuItem(serverId: string, open: boolean): ActionSheetItem | null {
  const t = useT();
  const { data } = useMyServerTag(open);
  const setTag = useSetMyServerTag();
  const entry = data?.eligible.find((server) => server.serverId === serverId);
  if (!entry) return null;
  const using = data?.primaryGuild?.serverId === serverId;
  return {
    key: "server-tag",
    label: using ? t("serverTag.menu.remove") : t("serverTag.menu.adopt"),
    detail: entry.badge ? `${entry.badge} ${entry.tag}` : entry.tag,
    icon: "sparkles",
    onPress: () =>
      setTag.mutate(using ? null : serverId, {
        onSuccess: () => showToast(using ? t("serverTag.profile.removed") : t("serverTag.profile.updated")),
        onError: (error) =>
          showToast(error instanceof ApiError && error.message ? error.message : t("serverTag.profile.failed"), "error"),
      }),
  };
}
