import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "@/api/client";
import { useSendFriendRequest } from "@/api/hooks";
import { Icon } from "@/components/ui/icon";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kullanıcı adıyla arkadaş ekleme.
 *
 * Sunucu tarafında hedefin gizlilik ayarı (herkes / arkadaşın arkadaşı /
 * ortak sunucu) denetlenir; 403 yanıtındaki mesaj kullanıcıya olduğu gibi
 * gösterilir — burada tahmin yürütmüyoruz.
 */
export default function AddFriendScreen() {
  const [username, setUsername] = useState("");
  const sendRequest = useSendFriendRequest();

  const trimmed = username.trim();
  const canSubmit = trimmed.length >= 2 && !sendRequest.isPending;

  const onSubmit = () => {
    if (!canSubmit) return;
    sendRequest.mutate(trimmed, { onSuccess: () => setUsername("") });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.panel, padding: spacing.lg, gap: spacing.lg }}
    >
      <Text style={{ ...typography.body, color: colors.muted }}>
        Ciklet kullanıcı adını yazarak arkadaşlık isteği gönder. Kullanıcı
        adları büyük/küçük harfe duyarlı değildir.
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.lg,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{ ...typography.body, color: colors.muted }}>@</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="kullaniciadi"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            color: colors.bright,
            ...typography.body,
          }}
          accessibilityLabel="Kullanıcı adı"
        />
      </View>

      {sendRequest.isError ? (
        <Text style={{ ...typography.caption, color: colors.danger }}>
          {sendRequest.error instanceof ApiError
            ? sendRequest.error.message
            : "İstek gönderilemedi."}
        </Text>
      ) : null}

      {sendRequest.isSuccess ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="check" size={16} color={colors.success} />
          <Text style={{ ...typography.caption, color: colors.success }}>
            Arkadaşlık isteği gönderildi.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.md,
          borderRadius: radii.full,
          backgroundColor: canSubmit ? colors.brand : colors.raised,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {sendRequest.isPending ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <Text
            style={{
              ...typography.bodyStrong,
              color: canSubmit ? colors.onBrand : colors.muted,
            }}
          >
            Arkadaşlık İsteği Gönder
          </Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
