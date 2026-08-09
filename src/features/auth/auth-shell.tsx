import { forwardRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { CikletLogo, IconButton } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export function AuthBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: 180,
          top: -170,
          right: -150,
          backgroundColor: colors.bubbleOwn,
          opacity: 0.9,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 250,
          height: 250,
          borderRadius: 125,
          bottom: -100,
          left: -125,
          backgroundColor: colors.accent,
          opacity: 0.08,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 118,
          height: 118,
          borderRadius: radii.bentoWrapper,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.bento,
          opacity: 0.38,
          top: 108,
          left: -54,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export function BrandSplash() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bentoShell,
      }}
    >
      <AuthBackdrop />
      <View
        style={{
          width: 104,
          height: 104,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 34,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.bento,
        }}
      >
        <BrandMark size={78} />
      </View>
      <Text style={{ ...typography.caption, color: colors.muted, marginTop: spacing.xl }}>
        Birlikte daha yakın.
      </Text>
    </View>
  );
}

export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require("../../../assets/images/splash-icon.png")}
      contentFit="contain"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      accessibilityLabel="Ciklet"
    />
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bentoShell }} edges={["top", "bottom"]}>
      <AuthBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing["2xl"],
          }}
        >
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            {onBack ? (
              <View style={{ marginBottom: spacing.lg }}>
                <IconButton
                  icon="chevron-left"
                  label="Geri"
                  onPress={onBack}
                  size={44}
                  background={colors.bento}
                  tint={colors.bright}
                />
              </View>
            ) : null}

            <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing["2xl"] }}>
              <CikletLogo height={38} color={colors.brand} />
              <Text style={{ ...typography.displayLg, color: colors.bright, textAlign: "center" }}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    ...typography.body,
                    color: colors.muted,
                    textAlign: "center",
                    maxWidth: 360,
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View
              style={{
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radii.bentoWrapper,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.bentoBorder,
                backgroundColor: colors.bento,
              }}
            >
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const AuthField = forwardRef<TextInput, TextInputProps & { label: string; error?: string }>(
function AuthField({ label, error, ...props }, ref) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.overline, color: error ? colors.danger : colors.muted }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        {...props}
        placeholderTextColor={colors.muted}
        selectionColor={colors.brand}
        style={[
          {
            minHeight: 52,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.deep,
            color: colors.bright,
            ...typography.body,
          },
          props.multiline ? { minHeight: 88, textAlignVertical: "top" } : null,
          props.style,
        ]}
      />
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
    </View>
  );
});
