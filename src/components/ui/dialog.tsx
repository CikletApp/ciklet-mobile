import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import { create } from "zustand";

import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { Pressable } from "./pressable";

/**
 * Temalı onay diyaloğu — `Alert.alert` ile AYNI imza.
 *
 * Sistem diyaloğu Android'de gri bir Material kutusu; temadan, fonttan ve
 * web'deki onay modallerinden (ortada yuvarlak kart, başlık, açıklama, hap
 * düğmeler) tamamen kopuktu. İmza bilerek aynı tutuldu: çağrı yerleri
 * yalnızca fonksiyon adını değiştiriyor.
 *
 * Aynı anda tek diyalog gösterilir; arkadan gelenler sıraya girer.
 */

export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface Dialog {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

const useDialogs = create<{ queue: Dialog[] }>(() => ({ queue: [] }));

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const dialog: Dialog = {
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: "Tamam" }],
  };
  useDialogs.setState((state) => ({ queue: [...state.queue, dialog] }));
}

function dismiss() {
  useDialogs.setState((state) => ({ queue: state.queue.slice(1) }));
}

/** Kök düzende bir kez; sıradaki ilk diyaloğu çizer. */
export function DialogHost() {
  const dialog = useDialogs((state) => state.queue[0]);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((button) => button.style === "cancel");
  // Vazgeç solda, eylem sağda — web'deki onay modalleriyle aynı sıra.
  const ordered = [
    ...dialog.buttons.filter((button) => button.style === "cancel"),
    ...dialog.buttons.filter((button) => button.style !== "cancel"),
  ];
  const stacked = ordered.length > 2;

  const press = (button: DialogButton) => {
    dismiss();
    button.onPress?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => (cancel ? press(cancel) : dismiss())}
    >
      <RNPressable
        onPress={() => (cancel ? press(cancel) : undefined)}
        style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.scrim }}
        accessibilityLabel="Diyaloğu kapat"
      >
        <RNPressable
          // Kartın içine dokunmak arka plana geçmesin.
          onPress={() => undefined}
          accessibilityRole="alert"
          style={{
            gap: spacing.lg,
            padding: spacing.xl,
            borderRadius: radii.bentoWrapper,
            borderCurve: "continuous",
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            boxShadow: `0 18px 48px ${colors.shadow}`,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.title, fontSize: 19, lineHeight: 25, color: colors.bright }}>{dialog.title}</Text>
            {dialog.message ? (
              <Text style={{ ...typography.body, color: colors.muted }}>{dialog.message}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: stacked ? "column" : "row", gap: spacing.sm }}>
            {(stacked ? [...ordered].reverse() : ordered).map((button) => {
              const tone = button.style === "destructive" ? "danger" : button.style === "cancel" ? "quiet" : "brand";
              return (
                <Pressable
                  key={button.text}
                  onPress={() => press(button)}
                  haptic={tone === "danger" ? "warning" : "light"}
                  noHitSlop
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flex: stacked ? undefined : 1,
                    minHeight: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: spacing.lg,
                    borderRadius: radii.full,
                    backgroundColor:
                      tone === "danger" ? colors.dangerSolid : tone === "brand" ? colors.brand : pressed ? colors.border : colors.raised,
                    opacity: pressed && tone !== "quiet" ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      ...typography.body,
                      ...fw(700),
                      color: tone === "danger" ? "#ffffff" : tone === "brand" ? colors.onBrand : colors.bright,
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
