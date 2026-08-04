import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Server } from "@ciklet/embedded-activities-sdk/types";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import {
  Button,
  Icon,
  ListGroup,
  KeyboardAvoider,
  ListRow,
  SegmentedTabs,
  TextField,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu oluştur veya davetle katıl.
 *
 * Şablonlar `POST /api/servers` gövdesindeki `template` alanına karşılık
 * gelir; sunucu şablona göre başlangıç kanallarını kendisi açar — istemci
 * kanal listesi göndermez.
 */
type Mode = "create" | "join";

const TEMPLATES = [
  { id: "gaming", label: "Oyun", icon: "compass" as const },
  { id: "study", label: "Çalışma Grubu", icon: "hash" as const },
  { id: "friends", label: "Arkadaşlar", icon: "users" as const },
] as const;

export default function NewServerScreen() {
  const [mode, setMode] = useState<Mode>("create");

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <SegmentedTabs
        items={[
          { id: "create" as const, label: "Sunucu Oluştur" },
          { id: "join" as const, label: "Davetle Katıl" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "create" ? <CreateServer /> : <JoinServer />}
    </KeyboardAvoider>
  );
}

function CreateServer() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string | null>(null);

  const createServer = useMutation({
    mutationFn: () =>
      api<Server>(endpoints.createServer, {
        method: "POST",
        body: {
          name: name.trim(),
          // Sunucu, imageUrl boşsa kendi varsayılanını üretir.
          template: template ?? undefined,
        },
      }),
    onSuccess: (server) => {
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
      router.replace(`/servers/${server.id}`);
    },
  });

  const canSubmit = name.trim().length >= 2 && !createServer.isPending;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text style={{ ...typography.body, color: colors.muted }}>
        Sunucun, arkadaşlarınla takıldığın yerdir. Bir ad ver ve konuşmaya başla.
      </Text>

      <TextField
        label="SUNUCU ADI"
        value={name}
        onChangeText={setName}
        placeholder="Örn. Hafta Sonu Ekibi"
        maxLength={60}
        autoFocus
        error={
          createServer.error instanceof ApiError ? createServer.error.message : null
        }
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.overline, color: colors.muted }}>
          BİR ŞABLONLA BAŞLA
        </Text>
        <ListGroup>
          {TEMPLATES.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: colors.border }} />
              ) : null}
              <ListRow
                icon={item.icon}
                iconTint={template === item.id ? colors.brand : colors.muted}
                title={item.label}
                titleColor={template === item.id ? colors.bright : colors.text}
                onPress={() => setTemplate(template === item.id ? null : item.id)}
                chevron={false}
                trailing={
                  template === item.id ? (
                    <Icon name="check" size={18} color={colors.brand} />
                  ) : undefined
                }
              />
            </View>
          ))}
        </ListGroup>
      </View>

      <Button
        label="Sunucuyu Oluştur"
        onPress={() => createServer.mutate()}
        disabled={!canSubmit}
        loading={createServer.isPending}
        fullWidth
        size="lg"
      />
    </ScrollView>
  );
}

interface InvitePreview {
  id: string;
  name: string;
  imageUrl: string;
  memberCount: number;
  onlineCount: number;
  ownerName: string;
}

/**
 * Davetle katılım — iki adım.
 *
 * 1. `GET /api/i/[code]` sunucunun herkese açık kartını döner (önizleme).
 * 2. `POST /api/servers/[id]/join` katılımı yapar.
 *
 * ⚠️ Backend boşluğu: ikinci uç YALNIZCA `isPublic` sunucular için çalışır.
 * Gizli bir sunucuya davetle katılım ciklet-web'de bir sunucu bileşeni
 * sayfasında (`(invite)/(routes)/i/[inviteCode]/page.tsx`) gerçekleşiyor ve
 * karşılık gelen bir API ucu YOK. Mobil için o mantığın bir uca taşınması
 * gerekiyor — bkz. docs/ROADMAP.md. O zamana kadar gizli sunucu daveti 404
 * döner ve kullanıcıya aşağıdaki açıklama gösterilir.
 */
function JoinServer() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);

  const lookup = useMutation({
    mutationFn: () => {
      // Kullanıcı tam davet bağlantısını yapıştırabilir; koda indir.
      const trimmed = code.trim();
      const inviteCode = trimmed.split("/").filter(Boolean).pop() ?? trimmed;
      return api<InvitePreview>(endpoints.invite(inviteCode));
    },
    onSuccess: setPreview,
  });

  const join = useMutation({
    mutationFn: (serverId: string) =>
      api(endpoints.serverJoin(serverId), { method: "POST" }),
    onSuccess: (_result, serverId) => {
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
      router.replace(`/servers/${serverId}`);
    },
  });

  const lookupError = lookup.error instanceof ApiError ? lookup.error : null;
  const joinError = join.error instanceof ApiError ? join.error : null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text style={{ ...typography.body, color: colors.muted }}>
        Davet bağlantısını veya kodunu yapıştır.
      </Text>

      <TextField
        label="DAVET KODU"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setPreview(null);
        }}
        placeholder="ciklet.xyz/i/abc123 veya abc123"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        error={
          lookupError
            ? lookupError.status === 404
              ? "Böyle bir davet bulunamadı. Bağlantının süresi dolmuş olabilir."
              : lookupError.message
            : null
        }
      />

      {preview ? (
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colors.panel,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Icon name="compass" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                {preview.name}
              </Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {preview.memberCount} üye · {preview.onlineCount} çevrimiçi
              </Text>
            </View>
          </View>

          <Button
            label="Sunucuya Katıl"
            onPress={() => join.mutate(preview.id)}
            loading={join.isPending}
            fullWidth
          />

          {joinError ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {joinError.status === 404
                ? "Bu sunucu davete kapalı katılım kabul etmiyor. Mobilden gizli sunucuya katılım henüz desteklenmiyor."
                : joinError.message}
            </Text>
          ) : null}
        </View>
      ) : (
        <Button
          label="Daveti Bul"
          onPress={() => lookup.mutate()}
          disabled={code.trim().length < 4 || lookup.isPending}
          loading={lookup.isPending}
          fullWidth
          size="lg"
        />
      )}
    </ScrollView>
  );
}
