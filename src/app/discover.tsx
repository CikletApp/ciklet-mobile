import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type { DiscoverAppItem, DiscoverServerItem } from "@/api/types";
import {
  Avatar,
  EmptyState,
  Icon,
  Pressable,
  Screen,
  SegmentedTabs,
  Tag,
  showDialog,
  type TabItem,
} from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Keşfet — herkese açık sunucular ve listelenmiş uygulama/botlar.
 *
 * Web'deki /discover sayfalarının mobil karşılığı. Veri, mobil için istenen
 * JSON uçlarından gelir (`/api/discover/servers`, `/api/discover/apps` —
 * sözleşme ciklet-web oturumuyla kararlaştırıldı). Uçlar henüz yayında
 * değilse 404 "hazırlanıyor" olarak gösterilir; ekran web dağıtımı
 * yapıldığında kendiliğinden dolar.
 *
 * Katılma davetsiz katılım ucundan geçer (`POST /api/servers/[id]/join`);
 * herkese açık olmayan sunucu orada zaten reddedilir.
 */

type DiscoverTab = "servers" | "apps";

const TABS: TabItem<DiscoverTab>[] = [
  { id: "servers", label: "Sunucular" },
  { id: "apps", label: "Uygulamalar" },
];

export default function DiscoverScreen() {
  const [tab, setTab] = useState<DiscoverTab>("servers");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Keşfet" }} />

      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: radii.full,
          backgroundColor: colors.panel,
        }}
      >
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={tab === "servers" ? "Sunucu ara" : "Uygulama ara"}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            color: colors.bright,
            ...typography.body,
          }}
          accessibilityLabel="Keşfette ara"
        />
      </View>

      {tab === "servers" ? <ServerList query={query} /> : <AppList query={query} />}
    </Screen>
  );
}

/** 404 = uç henüz dağıtılmadı; kullanıcıya arıza gibi gösterilmez. */
function discoverError(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "Keşfet hazırlanıyor",
      description: "Sunucu tarafı güncellemesi yayınlandığında burası dolacak.",
    };
  }
  return {
    title: "Yüklenemedi",
    description: error instanceof ApiError ? error.message : "Liste alınamadı.",
  };
}

function ServerList({ query }: { query: string }) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: qk.discover("servers", query),
    queryFn: () =>
      api<{ items: DiscoverServerItem[] }>(endpoints.discoverServers(query || undefined)),
    staleTime: 60_000,
  });

  const join = useMutation({
    mutationFn: (serverId: string) =>
      api(endpoints.serverJoin(serverId), { method: "POST" }),
    onSuccess: async (_data, serverId) => {
      await queryClient.invalidateQueries({ queryKey: qk.memberships });
      void queryClient.invalidateQueries({ queryKey: qk.discover("servers", query) });
      router.push(`/servers/${serverId}`);
    },
    onError: (reason) =>
      showDialog(
        "Katılınamadı",
        reason instanceof ApiError ? reason.message : "Sunucuya katılınamadı."
      ),
  });

  if (list.isLoading) {
    return <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />;
  }
  if (list.error) {
    const { title, description } = discoverError(list.error);
    return <EmptyState icon="compass" title={title} description={description} />;
  }

  const items = list.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon="compass"
        title="Sonuç yok"
        description={
          query
            ? `“${query}” ile eşleşen herkese açık bir sunucu yok.`
            : "Henüz keşfedilebilir sunucu yok."
        }
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(server) => server.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}
      renderItem={({ item }) => (
        <ServerCard
          server={item}
          joining={join.isPending && join.variables === item.id}
          onJoin={() => join.mutate(item.id)}
          onOpen={() => router.push(`/servers/${item.id}`)}
        />
      )}
    />
  );
}

function ServerCard({
  server,
  joining,
  onJoin,
  onOpen,
}: {
  server: DiscoverServerItem;
  joining: boolean;
  onJoin: () => void;
  onOpen: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: radii.bento,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.bento,
        overflow: "hidden",
      }}
    >
      {/* Afiş: görsel yoksa marka tonlu blok — kart yine de banner düzenini korur. */}
      <View style={{ height: 96, backgroundColor: colors.brandSoft }}>
        {server.bannerUrl ? (
          <Image
            source={{ uri: server.bannerUrl }}
            contentFit="cover"
            transition={150}
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: -40 }}>
          <View
            style={{
              borderRadius: radii.lg,
              borderWidth: 4,
              borderColor: colors.bento,
              backgroundColor: colors.bento,
            }}
          >
            <Avatar
              imageUrl={server.imageUrl}
              fallbackText={server.name}
              size={56}
              shape="squircle"
              backgroundColor={colors.deep}
            />
          </View>
        </View>

        <Text style={{ ...typography.title, color: colors.bright }} numberOfLines={1}>
          {server.name}
        </Text>
        {server.description ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
            {server.description}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          {server.onlineCount !== null ? (
            <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>
              <Text style={{ color: colors.online }}>●</Text> {server.onlineCount} çevrimiçi
            </Text>
          ) : null}
          <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>
            <Text style={{ color: colors.muted }}>●</Text> {server.memberCount} üye
          </Text>
        </View>

        <Pressable
          onPress={server.isMember ? onOpen : onJoin}
          disabled={joining}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={server.isMember ? "Sunucuyu aç" : "Sunucuya katıl"}
          style={({ pressed }) => ({
            marginTop: spacing.xs,
            minHeight: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.md,
            backgroundColor: server.isMember
              ? pressed
                ? colors.raised
                : colors.panel
              : pressed
                ? colors.raised
                : colors.brand,
            opacity: joining ? 0.6 : 1,
          })}
        >
          {joining ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text
              style={{
                ...typography.bodyStrong,
                color: server.isMember ? colors.bright : colors.onBrand,
              }}
            >
              {server.isMember ? "Üyesin · Aç" : "Katıl"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function AppList({ query }: { query: string }) {
  const list = useQuery({
    queryKey: qk.discover("apps", query),
    queryFn: () =>
      api<{ items: DiscoverAppItem[] }>(endpoints.discoverApps(query || undefined)),
    staleTime: 60_000,
  });

  if (list.isLoading) {
    return <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />;
  }
  if (list.error) {
    const { title, description } = discoverError(list.error);
    return <EmptyState icon="compass" title={title} description={description} />;
  }

  const items = list.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon="compass"
        title="Sonuç yok"
        description={
          query
            ? `“${query}” ile eşleşen uygulama yok.`
            : "Henüz listelenmiş uygulama yok."
        }
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(app) => app.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: spacing["3xl"] }}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Avatar
            imageUrl={item.imageUrl}
            fallbackText={item.name}
            size={48}
            shape="squircle"
            backgroundColor={colors.panel}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isVerified ? (
                <Tag label="ONAYLI" tint={colors.brand} background={colors.brandSoft} />
              ) : null}
              {item.isActivity ? (
                <Tag label="AKTİVİTE" tint={colors.brand} background={colors.brandSoft} />
              ) : null}
              {item.hasBot ? (
                <Tag label="BOT" tint={colors.onBrand} background={colors.brand} />
              ) : null}
            </View>
            {item.description ? (
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}
