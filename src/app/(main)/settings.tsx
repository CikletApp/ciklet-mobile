import { Image, Text, TouchableOpacity, View } from "react-native";

import { disconnectSocket } from "@/lib/socket";
import { useAuth } from "@/stores/auth";

export default function SettingsScreen() {
  const profile = useAuth((s) => s.profile);
  const logout = useAuth((s) => s.logout);

  return (
    <View className="flex-1 bg-main-bg p-4">
      <View className="mb-6 flex-row items-center gap-4 rounded-xl bg-surface p-4">
        <Image
          source={{ uri: profile?.imageUrl ?? undefined }}
          className="h-16 w-16 rounded-full bg-surface-2"
        />
        <View>
          <Text className="text-lg font-semibold text-text-primary">
            {profile?.name ?? profile?.username}
          </Text>
          <Text className="text-text-muted">@{profile?.username}</Text>
        </View>
      </View>

      <TouchableOpacity
        className="items-center rounded-lg bg-surface py-3"
        onPress={() => {
          disconnectSocket();
          logout();
        }}
      >
        <Text className="font-semibold text-danger">Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}
