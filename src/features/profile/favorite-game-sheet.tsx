import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

import { useMyGames, useSetFavoriteGame, type FavoriteGameInput } from "@/api/hooks";
import type { OwnProfileGame } from "@/api/types";
import { Icon, Pressable, ToastHost, showToast } from "@/components/ui";
import { resolveMediaUrl } from "@/lib/config";
import { FAVORITE_GAME_TAGS, favoriteCandidates } from "@/lib/favorite-game";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Favori oyun seçici — alttan açılan sayfa (web profile-editor
 * favorite-game-edit karşılığı).
 *
 * Koleksiyondaki (masaüstü tespiti) profilde GÖRÜNEBİLEN oyunların kapakları
 * listelenir — gizli, tanınmayan ve program satırları favori olamaz
 * (lib/favorite-game). Dokununca PUT /api/profile/games/favorite ile anında
 * kaydedilir; favori seçiliyken etiket çipleri ve "Favoriyi kaldır" görünür.
 */
export function FavoriteGameSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const games = useMyGames(visible);
  const save = useSetFavoriteGame();
  const { width } = useWindowDimensions();

  const candidates = favoriteCandidates(games.data ?? []);
  const favorite = candidates.find((g) => g.favorite) ?? null;
  const columns = 4;
  const gap = spacing.sm;
  const tile = Math.floor((width - spacing.lg * 2 - gap * (columns - 1)) / columns);

  const run = (input: FavoriteGameInput) =>
    save.mutate(input, {
      onSuccess: () => showToast("Kaydedildi"),
      onError: () => showToast("Favori kaydedilemedi.", "error"),
    });

  const choose = (game: OwnProfileGame) => {
    if (favorite && favorite.name === game.name && favorite.type === game.type) return;
    run({ name: game.name, type: game.type, tag: null });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <RNPressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "82%",
            paddingTop: spacing.lg,
            paddingBottom: spacing["2xl"],
            gap: spacing.md,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />
          <View style={{ paddingHorizontal: spacing.lg, gap: 2 }}>
            <Text style={{ ...typography.display, color: colors.bright }}>Favori Oyunun</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Masaüstü uygulamasının tanıdığı, profilde görünen oyunların.
            </Text>
          </View>

          {games.isLoading ? (
            <ActivityIndicator color={colors.muted} style={{ marginVertical: spacing.lg }} />
          ) : candidates.length === 0 ? (
            <Text
              style={{
                ...typography.caption,
                color: colors.muted,
                textAlign: "center",
                marginHorizontal: spacing.lg,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
              }}
            >
              {games.isError
                ? "Oyunlar yüklenemedi."
                : "Henüz favori seçilebilecek bir oyun yok. Masaüstü uygulamasıyla bir oyun açtığında burada belirir."}
            </Text>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap, paddingHorizontal: spacing.lg }}>
              {candidates.map((game) => {
                const active = Boolean(game.favorite);
                const cover = resolveMediaUrl(game.coverUrl);
                const icon = resolveMediaUrl(game.iconUrl);
                return (
                  <Pressable
                    key={`${game.type}:${game.name}`}
                    onPress={() => choose(game)}
                    haptic="light"
                    noHitSlop
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={game.name}
                    style={{ width: tile, gap: 4 }}
                  >
                    <View
                      style={{
                        width: tile,
                        height: Math.round(tile * 4 / 3),
                        borderRadius: radii.md,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: active ? colors.brand : "transparent",
                        backgroundColor: colors.raised,
                      }}
                    >
                      {cover ? (
                        <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} />
                      ) : icon ? (
                        <Image source={{ uri: icon }} style={{ width: "70%", height: "70%", borderRadius: radii.sm }} contentFit="contain" />
                      ) : (
                        <Text style={{ fontSize: 10, ...fw(700), color: colors.muted, textAlign: "center", paddingHorizontal: 4 }} numberOfLines={3}>
                          {game.name}
                        </Text>
                      )}
                      {active ? (
                        <View
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.brand,
                          }}
                        >
                          <Icon name="check" size={13} color={colors.onBrand} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 10, ...fw(600), color: colors.bright }} numberOfLines={1}>
                      {game.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {favorite ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>ETİKET</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {[{ id: null, label: "Etiket yok" }, ...FAVORITE_GAME_TAGS].map((tag) => {
                  const active = (favorite.favoriteTag ?? null) === tag.id;
                  return (
                    <Pressable
                      key={tag.id ?? "none"}
                      onPress={() => !active && run({ name: favorite.name, type: favorite.type, tag: tag.id })}
                      noHitSlop
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={{
                        minHeight: 34,
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        borderRadius: radii.full,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandSoft : colors.bg,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: active ? colors.brand : colors.text }}>{tag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => run(null)}
                haptic="warning"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.xs,
                  minHeight: 42,
                  marginTop: spacing.xs,
                  borderRadius: radii.md,
                  backgroundColor: pressed ? colors.raised : colors.panel,
                })}
              >
                <Icon name="trash" size={16} color={colors.danger} />
                <Text style={{ ...typography.bodyStrong, color: colors.danger }}>Favoriyi kaldır</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      <ToastHost />
    </Modal>
  );
}
