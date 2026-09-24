import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { IconButton } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type ExpiryMode = "OFF" | "ONE_DAY" | "SEVEN_DAYS" | "THIRTY_DAYS" | "NINETY_DAYS";

interface ExpiryResponse {
  ok?: boolean;
  mode: ExpiryMode;
  label?: string;
}

const OPTIONS: { value: ExpiryMode; label: string; description: string }[] = [
  { value: "OFF", label: "Kapalı", description: "Mesajlar otomatik silinmez." },
  { value: "ONE_DAY", label: "24 saat", description: "Yeni mesajlar bir gün sonra silinir." },
  { value: "SEVEN_DAYS", label: "7 gün", description: "Yeni mesajlar bir hafta sonra silinir." },
  { value: "THIRTY_DAYS", label: "30 gün", description: "Yeni mesajlar bir ay sonra silinir." },
  { value: "NINETY_DAYS", label: "90 gün", description: "Yeni mesajlar üç ay sonra silinir." },
];

export function DirectExpiryButton({ directId }: { directId: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <IconButton icon="timer" label="Süreli mesajlar" background="transparent" tint={colors.muted} onPress={() => setVisible(true)} />
      <DirectExpirySheet directId={directId} visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

/** Süreli mesaj seçimi — başlıktaki menüden ya da düğmeden açılır. */
export function DirectExpirySheet({
  directId,
  visible,
  onClose,
}: {
  directId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const setVisible = (open: boolean) => {
    if (!open) onClose();
  };
  const current = useQuery({
    queryKey: ["direct-expiry", directId],
    queryFn: () => api<ExpiryResponse>(endpoints.directExpiry(directId)),
    enabled: false,
  });
  const update = useMutation({
    mutationFn: (mode: ExpiryMode) => api<ExpiryResponse>(endpoints.directExpiry(directId), { method: "PATCH", body: { mode } }),
    onSuccess: (data) => {
      current.refetch();
      if (data.mode === "OFF") setVisible(false);
    },
  });

  useEffect(() => {
    if (visible) void current.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca açılışta tazelenir
  }, [visible]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setVisible(false)} style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }} />
          <View style={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.bento }}>
            <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />
            <View style={{ gap: 3 }}>
              <Text style={{ ...typography.display, color: colors.bright }}>Süreli mesajlar</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>Seçim iki tarafı bağlar ve yalnızca bundan sonra gönderilen mesajları etkiler.</Text>
            </View>
            {current.isFetching && !current.data ? (
              <ActivityIndicator color={colors.brand} />
            ) : OPTIONS.map((option) => {
              const selected = current.data?.mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={update.isPending}
                  onPress={() => update.mutate(option.value)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: selected ? colors.brand : colors.border, backgroundColor: pressed || selected ? colors.raised : colors.panel, opacity: update.isPending ? 0.65 : 1 })}
                >
                  <View style={{ width: 16, height: 16, borderRadius: radii.full, borderWidth: 2, borderColor: selected ? colors.brand : colors.muted, alignItems: "center", justifyContent: "center" }}>
                    {selected ? <View style={{ width: 8, height: 8, borderRadius: radii.full, backgroundColor: colors.brand }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{option.label}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
            {current.isError || update.isError ? <Text style={{ ...typography.caption, color: colors.danger }}>Süre ayarı alınamadı. Lütfen tekrar dene.</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
