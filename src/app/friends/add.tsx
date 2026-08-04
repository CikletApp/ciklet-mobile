import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useSendFriendRequest } from "@/api/hooks";
import { Button, Icon, KeyboardAvoider, TextField } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

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
    <KeyboardAvoider
      style={{
        backgroundColor: colors.panel,
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Text style={{ ...typography.body, color: colors.muted }}>
        Ciklet kullanıcı adını yazarak arkadaşlık isteği gönder. Kullanıcı
        adları büyük/küçük harfe duyarlı değildir.
      </Text>

      <TextField
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          if (sendRequest.isError || sendRequest.isSuccess) sendRequest.reset();
        }}
        placeholder="kullaniciadi"
        prefix="@"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={32}
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        error={
          sendRequest.error instanceof ApiError ? sendRequest.error.message : null
        }
      />

      {sendRequest.isSuccess ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="check" size={16} color={colors.success} />
          <Text style={{ ...typography.caption, color: colors.success }}>
            Arkadaşlık isteği gönderildi.
          </Text>
        </View>
      ) : null}

      <Button
        label="Arkadaşlık İsteği Gönder"
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={sendRequest.isPending}
        haptic="success"
        fullWidth
        size="lg"
      />
    </KeyboardAvoider>
  );
}
