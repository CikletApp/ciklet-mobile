import { useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

import { Icon, KeyboardAvoider, Pressable } from "@/components/ui";
import type { Poll } from "@/lib/message-extras";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Anket oluşturma — ciklet-web `poll-composer-dialog.tsx` + `lib/polls`
 * `buildPoll`: soru, 2-10 seçenek, çoklu seçim, süre (1 sa – 1 hafta ya
 * da süresiz). Doğrulama burada da yapılır ki kullanıcı hatayı göndermeden
 * görsün; sunucu yine denetler. Gönderim çağıranın işi (messageType POLL).
 */

export const POLL_MAX_QUESTION = 300;
export const POLL_MAX_OPTIONS = 10;
const POLL_MAX_OPTION_TEXT = 80;

const DURATIONS: { id: string; label: string; ms: number | null }[] = [
  { id: "1h", label: "1 saat", ms: 60 * 60 * 1000 },
  { id: "4h", label: "4 saat", ms: 4 * 60 * 60 * 1000 },
  { id: "24h", label: "1 gün", ms: 24 * 60 * 60 * 1000 },
  { id: "3d", label: "3 gün", ms: 3 * 24 * 60 * 60 * 1000 },
  { id: "7d", label: "1 hafta", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "never", label: "Süresiz", ms: null },
];

export function buildPoll(input: {
  question: string;
  options: string[];
  multiple: boolean;
  durationMs: number | null;
}): { poll: Poll } | { error: string } {
  const question = input.question.replace(/\s+/g, " ").trim();
  if (!question) return { error: "Soru boş olamaz." };
  if (question.length > POLL_MAX_QUESTION) return { error: `Soru en fazla ${POLL_MAX_QUESTION} karakter olabilir.` };
  const texts = input.options.map((option) => option.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (texts.length < 2) return { error: "En az iki seçenek gerekli." };
  if (texts.length > POLL_MAX_OPTIONS) return { error: `En fazla ${POLL_MAX_OPTIONS} seçenek olabilir.` };
  const lowered = texts.map((text) => text.toLocaleLowerCase("tr-TR"));
  if (new Set(lowered).size !== lowered.length) return { error: "Seçenekler birbirinden farklı olmalı." };
  const options = texts.map((text, index) => ({ id: `o${index + 1}`, text }));
  return {
    poll: {
      question,
      options,
      multiple: input.multiple,
      expiresAt: input.durationMs != null ? new Date(Date.now() + input.durationMs).toISOString() : null,
      votes: Object.fromEntries(options.map((option) => [option.id, [] as string[]])),
    },
  };
}

export function PollComposer({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (poll: Poll) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [durationId, setDurationId] = useState("24h");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMultiple(false);
    setDurationId("24h");
    setError(null);
  };

  const submit = () => {
    const duration = DURATIONS.find((item) => item.id === durationId);
    const built = buildPoll({ question, options, multiple, durationMs: duration?.ms ?? null });
    if ("error" in built) {
      setError(built.error);
      return;
    }
    onCreate(built.poll);
    reset();
    onClose();
  };

  const canSubmit = question.trim().length > 0 && options.filter((option) => option.trim()).length >= 2;

  const inputStyle = {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.deep,
    color: colors.bright,
    ...typography.body,
  } as const;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoider style={{ flex: 1, backgroundColor: colors.scrim }}>
        <RNPressable
          onPress={onClose}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Icon name="list" size={20} color={colors.brand} />
                <Text style={{ ...typography.display, color: colors.bright }}>Anket Oluştur</Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Bir soru sor, seçenekleri yaz; herkes oy verebilir.
              </Text>

              <Text style={{ ...typography.overline, color: colors.muted }}>SORU</Text>
              <TextInput
                value={question}
                onChangeText={(text) => setQuestion(text.slice(0, POLL_MAX_QUESTION))}
                placeholder="Akşam ne oynuyoruz?"
                placeholderTextColor={colors.muted}
                autoFocus
                style={inputStyle}
              />

              <Text style={{ ...typography.overline, color: colors.muted }}>SEÇENEKLER</Text>
              {options.map((option, index) => (
                <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <TextInput
                    value={option}
                    onChangeText={(text) =>
                      setOptions((prev) => prev.map((item, i) => (i === index ? text.slice(0, POLL_MAX_OPTION_TEXT) : item)))
                    }
                    placeholder={`Seçenek ${index + 1}`}
                    placeholderTextColor={colors.muted}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {options.length > 2 ? (
                    <Pressable
                      onPress={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityRole="button"
                      accessibilityLabel={`Seçenek ${index + 1}'i kaldır`}
                      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon name="close" size={16} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {options.length < POLL_MAX_OPTIONS ? (
                <Pressable
                  onPress={() => setOptions((prev) => [...prev, ""])}
                  accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingVertical: spacing.xs }}
                >
                  <Icon name="plus" size={16} color={colors.brand} />
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>Seçenek ekle</Text>
                </Pressable>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, ...fw(600), color: colors.bright }}>Çoklu seçim</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>Birden çok seçenek işaretlenebilir.</Text>
                </View>
                <Switch
                  value={multiple}
                  onValueChange={setMultiple}
                  trackColor={{ true: colors.brand, false: colors.raised }}
                  accessibilityLabel="Çoklu seçim"
                />
              </View>

              <Text style={{ ...typography.overline, color: colors.muted }}>SÜRE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {DURATIONS.map((duration) => {
                  const chosen = duration.id === durationId;
                  return (
                    <Pressable
                      key={duration.id}
                      onPress={() => setDurationId(duration.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: chosen }}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radii.full,
                        borderWidth: 1,
                        borderColor: chosen ? colors.brand : colors.border,
                        backgroundColor: chosen ? colors.brandSoft : colors.deep,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: chosen ? colors.brand : colors.text }}>{duration.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={{ minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.lg }}
                >
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Vazgeç</Text>
                </Pressable>
                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  haptic="light"
                  accessibilityRole="button"
                  style={{
                    minHeight: 44,
                    paddingHorizontal: spacing.lg,
                    justifyContent: "center",
                    borderRadius: radii.lg,
                    backgroundColor: colors.brand,
                    opacity: canSubmit ? 1 : 0.45,
                  }}
                >
                  <Text style={{ ...typography.bodyStrong, color: colors.onBrand }}>Gönder</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </RNPressable>
      </KeyboardAvoider>
    </Modal>
  );
}
