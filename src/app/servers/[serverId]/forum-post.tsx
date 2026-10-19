import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useChannel, useCreateForumPost, useForumPosts } from "@/api/hooks";
import { Button, KeyboardAvoider, Pressable, TextField } from "@/components/ui";
import { openThread } from "@/features/server/thread-nav";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Yeni forum gönderisi — başlık + içerik + etiket (web "Yeni gönderi").
 * Sunucu alt başlığı ve ilk mesajı birlikte açar; ardından gönderi açılır.
 */
export default function ForumPostScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const forum = useChannel(serverId, channelId);
  const posts = useForumPosts(serverId, channelId, { sort: "activity", archived: false });
  const create = useCreateForumPost(serverId, channelId);
  const tags = posts.data?.tags ?? [];

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (tag: string) =>
    setSelected((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

  const submit = () => {
    setError(null);
    create.mutate(
      { title: title.trim(), content: content.trim(), tags: selected },
      {
        onSuccess: ({ id }) =>
          openThread(serverId, channelId, { id, name: title.trim() || content.trim().slice(0, 60) }, { replace: true }),
        onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Gönderi açılamadı."),
      }
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: forum ? `#${forum.name} · Yeni gönderi` : "Yeni gönderi" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <TextField label="BAŞLIK" value={title} onChangeText={setTitle} maxLength={100} autoFocus />
        <TextField label="İÇERİK" value={content} onChangeText={setContent} maxLength={4000} multiline />
        {tags.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>ETİKETLER</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {tags.map((tag) => {
                const on = selected.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggle(tag)}
                    haptic="light"
                    noHitSlop
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radii.full,
                      borderWidth: 1,
                      borderColor: on ? colors.brand : colors.bentoBorder,
                      backgroundColor: on ? colors.brandSoft : pressed ? colors.raised : colors.panel,
                    })}
                  >
                    <Text style={{ ...typography.caption, ...fw(on ? 700 : 500), color: on ? colors.brand : colors.text }}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
        <Button
          label="Gönderiyi Paylaş"
          fullWidth
          size="lg"
          disabled={!content.trim()}
          loading={create.isPending}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoider>
  );
}
