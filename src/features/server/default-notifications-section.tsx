import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useUpdateServer } from "@/api/hooks";
import { Divider, ListGroup, ListRow, SectionHeader, showToast } from "@/components/ui";
import { useNotificationSettings } from "@/api/hooks/use-notification-settings";
import { colors, spacing, typography } from "@/theme/tokens";

type DefaultLevel = "ALL" | "MENTIONS";

/**
 * Varsayılan bildirim ayarı (Discord "Default Notification Settings") —
 * web Sunucu Ayarları › Genel Görünüm'deki bölümün karşılığı; aynı seçenekler
 * ve metinler. Bildirim ayarını değiştirmemiş üyeler tüm mesajlarda mı yoksa
 * yalnızca bahsedildiklerinde mi bildirim alır. "Hiçbiri" Discord'daki gibi
 * sunulmaz. Seçim hemen kaydedilir (Sunucuyu Yönet).
 */
const OPTIONS: { value: DefaultLevel; label: string }[] = [
  { value: "ALL", label: "Tüm Mesajlar" },
  { value: "MENTIONS", label: "Yalnızca @bahsetmeler" },
];

export function DefaultNotificationsSection({ serverId, level }: { serverId: string; level: string | undefined }) {
  const update = useUpdateServer(serverId);
  const notificationSettings = useNotificationSettings();
  const [value, setValue] = useState<DefaultLevel>(level === "MENTIONS" ? "MENTIONS" : "ALL");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(level === "MENTIONS" ? "MENTIONS" : "ALL");
  }, [level]);

  const choose = (next: DefaultLevel) => {
    if (next === value || update.isPending) return;
    const previous = value;
    setValue(next);
    update.mutate(
      { defaultNotificationLevel: next },
      {
        // Kendi bildirim kararlarımız da yeni varsayılanı hemen görsün.
        onSuccess: () => void notificationSettings.refetch(),
        onError: () => {
          setValue(previous);
          showToast("Varsayılan bildirim ayarı kaydedilemedi.", "error");
        },
      }
    );
  };

  return (
    <>
      <SectionHeader title="VARSAYILAN BİLDİRİM AYARLARI" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Bildirim ayarlarını kendisi değiştirmemiş üyeler bu sunucudaki her mesaj için mi yoksa yalnızca bahsedildiklerinde mi bildirim alsın?
        </Text>
        <ListGroup>
          {OPTIONS.map((option, index) => (
            <View key={option.value}>
              {index > 0 ? <Divider inset={16} /> : null}
              <ListRow
                title={option.label}
                detail={value === option.value ? "Seçili" : undefined}
                chevron={false}
                disabled={update.isPending}
                onPress={() => choose(option.value)}
              />
            </View>
          ))}
        </ListGroup>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Herkese açık büyük sunucularda gereksiz bildirimleri önlemek için &quot;Yalnızca @bahsetmeler&quot; önerilir.
        </Text>
      </View>
    </>
  );
}
