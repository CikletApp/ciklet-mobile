import { memo } from "react";
import { Image, Text, View } from "react-native";
import type { MessageWithMember } from "@ciklet/embedded-activities-sdk/types";

export const MessageItem = memo(function MessageItem({
  message,
}: {
  message: MessageWithMember;
}) {
  const profile = message.member.profile;
  const displayName = message.member.nickname ?? profile.name ?? profile.username;

  return (
    <View className="flex-row gap-3 px-4 py-2">
      <Image
        source={{ uri: profile.imageUrl ?? undefined }}
        className="h-10 w-10 rounded-full bg-surface"
      />
      <View className="flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="font-semibold text-text-primary">{displayName}</Text>
          <Text className="text-xs text-text-muted">
            {new Date(message.createdAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text className="text-text-primary">
          {message.deleted ? "Bu mesaj silindi." : message.content}
        </Text>
      </View>
    </View>
  );
});
