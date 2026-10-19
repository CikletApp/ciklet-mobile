import { useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button, KeyboardAvoider, TextField, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import {
  inputError,
  useInteractionModal,
  VALUE_MAX,
  type OpenModal,
} from "./interaction-modal-store";
import { waitForAck } from "./interactions";

/**
 * Bot etkileşim modalı — web `lib/modals` + `components/modals/interaction-modal`.
 *
 * Bot bir komut ya da bileşen etkileşimine callback type 9 ile yanıt
 * verince açılır. İki yoldan gelir: etkileşim isteğinin yanıtı
 * (`status: "MODAL"` + `modal`, HTTP uç noktalı botlar) ve kullanıcı
 * odasına düşen `interaction.modal` olayı (ağ geçidi botları). İkisi de
 * gelirse aynı etkileşim bir kez açılır.
 *
 * Gönderim aynı uca: `POST /api/channels/[id]/interactions`
 * `{ modalInteractionId, components: [{ custom_id, value }] }`. Sunucu
 * değerleri saklanan modal tanımına karşı yeniden doğrular; bir modal bir
 * kez gönderilebilir.
 */

/** Kök düzende bir kez. */
export function InteractionModalHost() {
  const current = useInteractionModal((s) => s.current);
  if (!current) return null;
  // Anahtar: yeni etkileşim formu baştan kursun (önceki değerler taşınmasın).
  return <InteractionModalForm key={current.interactionId} open={current} />;
}

function InteractionModalForm({ open }: { open: OpenModal }) {
  const { modal, channelId, interactionId } = open;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(modal.inputs.map((input) => [input.custom_id, input.value ?? ""]))
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const close = () => useInteractionModal.setState({ current: null });

  const submit = async () => {
    const nextErrors = Object.fromEntries(
      modal.inputs.map((input) => [input.custom_id, inputError(input, values[input.custom_id] ?? "")])
    );
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true);
    try {
      const res = await api<{ id: string }>(endpoints.channelInteractions(channelId), {
        method: "POST",
        body: {
          modalInteractionId: interactionId,
          components: modal.inputs.map((input) => ({
            custom_id: input.custom_id,
            value: values[input.custom_id] ?? "",
          })),
        },
      });
      close();
      void waitForAck(channelId, res.id).then((silent) => {
        if (silent) showToast("Bot forma yanıt vermedi.");
      });
    } catch (error) {
      showToast(error instanceof ApiError && error.message ? error.message : "Form gönderilemedi.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoider style={{ flex: 1, backgroundColor: colors.scrim }}>
        <RNPressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Animated.View
            entering={SlideInDown.duration(200)}
            onStartShouldSetResponder={() => true}
            style={{
              maxHeight: "88%",
              marginHorizontal: spacing.sm,
              marginBottom: spacing.sm,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.bentoBorder,
              backgroundColor: colors.panel,
              overflow: "hidden",
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ ...typography.display, color: colors.bright }}>{modal.title}</Text>
              {modal.inputs.map((input, index) => (
                <TextField
                  key={input.custom_id}
                  label={`${input.label}${input.required ? " *" : ""}`}
                  value={values[input.custom_id] ?? ""}
                  onChangeText={(text) => {
                    setValues((current) => ({ ...current, [input.custom_id]: text }));
                    if (errors[input.custom_id]) setErrors((current) => ({ ...current, [input.custom_id]: null }));
                  }}
                  placeholder={input.placeholder}
                  multiline={input.style === 2}
                  maxLength={input.max_length ?? VALUE_MAX}
                  autoFocus={index === 0}
                  error={errors[input.custom_id]}
                />
              ))}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <Button label="Vazgeç" variant="ghost" onPress={close} />
                <Button label="Gönder" loading={busy} onPress={() => void submit()} />
              </View>
            </ScrollView>
          </Animated.View>
        </RNPressable>
      </KeyboardAvoider>
    </Modal>
  );
}
