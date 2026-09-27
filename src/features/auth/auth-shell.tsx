import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { CikletLogo, Icon, IconButton, KeyboardAvoider, Pressable } from "@/components/ui";
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
  const scroll = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardOpen(true);
      // Kart sıkışan başlığın altında; alttaki düğmeyi görünür tut.
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bentoShell }} edges={["top", "bottom"]}>
      <AuthBackdrop />
      {/*
        Android'de edge-to-edge açık: pencere klavyeyle yeniden boyutlanmıyor
        ve KeyboardAvoidingView orada hiçbir şey yapmıyordu — klavye "Giriş
        Yap" düğmesinin üstüne biniyordu. Reanimated klavye yüksekliğini her
        iki platformda da doğrudan veriyor.
      */}
      <KeyboardAvoider applySafeArea={false}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            paddingVertical: keyboardOpen ? spacing.lg : spacing["2xl"],
          }}
        >
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            {onBack && !keyboardOpen ? (
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

            {/* Klavye açıkken başlık sıkışır: form ve düğme görünür kalsın. */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: keyboardOpen ? spacing.lg : spacing["2xl"] }}>
              {keyboardOpen ? null : <CikletLogo height={38} color={colors.bright} />}
              <Text
                style={{
                  ...(keyboardOpen ? typography.display : typography.displayLg),
                  color: colors.bright,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>
              {subtitle && !keyboardOpen ? (
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
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

export const AuthField = forwardRef<TextInput, TextInputProps & { label: string; error?: string }>(
function AuthField({ label, error, secureTextEntry, ...props }, ref) {
  // Şifre alanlarında göz düğmesi — web'deki AuthPasswordField gibi. Telefonda
  // yanlış yazmak kolay; gizli alanda hatayı görmenin başka yolu yok.
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.overline, color: error ? colors.danger : colors.muted }}>
        {label}
      </Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          ref={ref}
          {...props}
          secureTextEntry={secureTextEntry && !revealed}
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
            secureTextEntry ? { paddingRight: 52 } : null,
            props.multiline ? { minHeight: 88, textAlignVertical: "top" } : null,
            props.style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
            style={{ position: "absolute", right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name={revealed ? "eye-off" : "eye"} size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
    </View>
  );
});
