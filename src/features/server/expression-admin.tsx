import { useEffect, useState } from "react";
import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, TextField } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Emoji / çıkartma / ses düzenleme sayfası — web'deki satır içi ad (ve
 * çıkartmada açıklama) alanlarının mobil karşılığı. "Kaydet" ile gönderilir.
 */
export function RenameSheet({
  visible,
  title,
  initialName,
  nameMax,
  prefix,
  initialDescription,
  descriptionMax,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialName: string;
  nameMax: number;
  /** Emoji adının iki yanındaki ":" gibi. */
  prefix?: string;
  /** Verilirse açıklama alanı da gösterilir (çıkartma). */
  initialDescription?: string | null;
  descriptionMax?: number;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const t = useT();
  const [description, setDescription] = useState(initialDescription ?? "");

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initialName);
    setDescription(initialDescription ?? "");
  }, [visible, initialName, initialDescription]);

  const withDescription = initialDescription !== undefined;
  const save = () => {
    const next = name.trim();
    if (!next) return;
    onSave(next, description.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <RNPressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          onStartShouldSetResponder={() => true}
          style={{
            margin: spacing.sm,
            marginBottom: spacing.sm + insets.bottom,
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{title}</Text>
          <TextField
            label={t("moreScreens.expression.name")}
            value={name}
            onChangeText={setName}
            maxLength={nameMax}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            prefix={prefix}
            onSubmitEditing={withDescription ? undefined : save}
          />
          {withDescription ? (
            <TextField
              label={t("moreScreens.expression.descriptionLabel")}
              value={description}
              onChangeText={setDescription}
              maxLength={descriptionMax}
              placeholder={t("moreScreens.expression.description")}
              onSubmitEditing={save}
            />
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Button label={t("common.cancel")} variant="ghost" onPress={onClose} />
            <Button label={t("common.save")} disabled={!name.trim()} onPress={save} />
          </View>
        </View>
      </RNPressable>
    </Modal>
  );
}
