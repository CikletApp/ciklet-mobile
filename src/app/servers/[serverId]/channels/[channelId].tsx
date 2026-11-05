import { useEffect, useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { useChannel, useDeleteChannel, useServerBoost } from "@/api/hooks";
import {
  useCreateChannelIn,
  usePatchChannel,
  useServerCategories,
  type ChannelAdminExtras,
  type ChannelPatch,
} from "@/api/hooks/use-channel-admin";
import type { ChannelExtras } from "@/api/types";
import {
  Button,
  Divider,
  EmojiText,
  Icon,
  KeyboardAvoider,
  ListGroup,
  ListRow,
  Pressable,
  SegmentedTabs,
  TextField,
  showDialog,
  showToast,
} from "@/components/ui";
import { EmojiPickerPanel } from "@/features/chat/components/emoji-picker";
import { Card, PillPicker, ToggleRow } from "@/features/moderation/ui";
import {
  FORUM_TAG_MAX,
  MAX_FORUM_TAGS,
  parseForumLayout,
  parseForumSort,
  parseForumTags,
  type ForumLayout,
  type ForumSort,
} from "@/lib/forum";
import { SLOW_MODE_OPTIONS } from "@/lib/slow-mode";
import {
  VIDEO_QUALITY_OPTIONS,
  VOICE_BITRATE_MAX,
  VOICE_BITRATE_OPTIONS_KBPS,
  VOICE_USER_LIMIT_MAX,
  bitrateLabel,
  parseUserLimit,
  readBitrate,
  readVideoQualityMode,
  type VideoQualityMode,
} from "@/lib/voice-settings";
import { LEGACY_PERK_FLOOR } from "@/lib/server-boost";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Kanal Oluştur / Kanal Ayarları — web `create-channel-modal.tsx` ve
 * `channel-settings/overview-tab.tsx` (+ `forum-settings-section.tsx`):
 * ad, kategori (izinler: eşitle / koru), açıklama, ses kanalı durumu ve
 * ses ayarları, yavaş mod, yaş sınırı, sahne / medya / duyuru / forum
 * kanalı ve forum ayarları. Yalnızca değişen alanlar gönderilir.
 * Varsayılan "general" kanalının yalnızca adı kilitli (web ile aynı).
 */

const VOICE_STATUS_MAX = 80;
const TOPIC_MAX = 1024;
const NAME_MAX = 100;
const NO_CATEGORY = "__none__";

type DraftTag = { key: string; id?: string; name: string; emoji: string | null; moderated: boolean };
type ForumDraft = {
  tags: DraftTag[];
  requireTag: boolean;
  defaultReaction: string | null;
  defaultSort: ForumSort;
  defaultLayout: ForumLayout;
};

type FullChannel = ChannelExtras & ChannelAdminExtras & { id: string; name: string; type: ChannelType };

let draftKey = 0;
const newDraftKey = () => `t${++draftKey}`;

function forumDraftOf(channel: FullChannel | undefined): ForumDraft {
  return {
    tags: parseForumTags(channel?.availableTags).map((t) => ({ ...t, key: t.id })),
    requireTag: Boolean(channel?.forumRequireTag),
    defaultReaction: channel?.forumDefaultReaction ?? null,
    defaultSort: parseForumSort(channel?.forumDefaultSort),
    defaultLayout: parseForumLayout(channel?.forumDefaultLayout),
  };
}

function forumFingerprint(draft: ForumDraft): string {
  return JSON.stringify({
    tags: draft.tags.map((t) => [t.id ?? null, t.name.trim(), t.emoji, t.moderated]),
    requireTag: draft.requireTag,
    defaultReaction: draft.defaultReaction,
    defaultSort: draft.defaultSort,
    defaultLayout: draft.defaultLayout,
  });
}

export default function ChannelSettingsScreen() {
  const { serverId, channelId, categoryId: categoryParam } = useLocalSearchParams<{
    serverId: string;
    channelId: string;
    categoryId?: string;
  }>();
  const t = useT();
  const creating = channelId === "new";
  const channel = useChannel(serverId, creating ? undefined : channelId) as FullChannel | undefined;
  const create = useCreateChannelIn(serverId);
  const update = usePatchChannel(serverId, channelId);
  const remove = useDeleteChannel(serverId, channelId);
  const { data: categories } = useServerCategories(serverId);

  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(ChannelType.TEXT);
  const [categoryId, setCategoryId] = useState<string>(categoryParam || NO_CATEGORY);
  const [permissionMode, setPermissionMode] = useState<"sync" | "keep">("sync");
  const [topic, setTopic] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [slowMode, setSlowMode] = useState(0);
  const [nsfw, setNsfw] = useState(false);
  const [stage, setStage] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [announcement, setAnnouncement] = useState(false);
  const [forum, setForum] = useState(false);
  const [forumDraft, setForumDraft] = useState<ForumDraft>(() => forumDraftOf(undefined));
  const [userLimit, setUserLimit] = useState("0");
  const [bitrate, setBitrate] = useState(readBitrate(undefined));
  const [videoQuality, setVideoQuality] = useState<VideoQualityMode>("auto");
  const { data: boost } = useServerBoost(serverId, !creating);
  const maxBitrate = boost?.perks.maxBitrate ?? LEGACY_PERK_FLOOR.maxBitrate;
  const bitrateChoices = VOICE_BITRATE_OPTIONS_KBPS.filter((kbps) => kbps * 1000 <= maxBitrate || kbps * 1000 === bitrate);

  const reset = () => {
    if (!channel) return;
    setName(channel.name);
    setType(channel.type);
    setCategoryId(channel.categoryId ?? NO_CATEGORY);
    setPermissionMode("sync");
    setTopic(channel.topic ?? "");
    setVoiceStatus(channel.voiceStatus ?? "");
    setSlowMode(channel.slowModeSeconds ?? 0);
    setNsfw(Boolean(channel.nsfw));
    setStage(Boolean(channel.stage));
    setMediaOnly(Boolean(channel.mediaOnly));
    setAnnouncement(Boolean(channel.announcement));
    setForum(Boolean(channel.forum));
    setForumDraft(forumDraftOf(channel));
    setUserLimit(String(channel.userLimit ?? 0));
    setBitrate(readBitrate(channel.bitrate));
    setVideoQuality(readVideoQualityMode(channel.videoQualityMode));
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !creating && channel?.name.toLocaleLowerCase("tr") === "general";
  const isVoice = !creating && Boolean(channel) && type !== ChannelType.TEXT;
  const parsedUserLimit = parseUserLimit(userLimit.trim() === "" ? 0 : userLimit);
  const currentCategoryId = channel?.categoryId ?? NO_CATEGORY;
  const categoryList = categories ?? [];
  const fail = (fallback: string) => (error: unknown) =>
    showToast(userErrorMessage(error, fallback), "error");

  const buildPatch = (): ChannelPatch => {
    if (!channel) return {};
    const patch: ChannelPatch = {};
    const trimmedName = name.trim();
    const trimmedTopic = topic.trim();
    const trimmedStatus = voiceStatus.trim();
    if (!locked && trimmedName !== channel.name) patch.name = trimmedName;
    if (trimmedTopic !== (channel.topic ?? "")) patch.topic = trimmedTopic || null;
    if (slowMode !== (channel.slowModeSeconds ?? 0)) patch.slowModeSeconds = slowMode;
    if (nsfw !== Boolean(channel.nsfw)) patch.nsfw = nsfw;
    if (mediaOnly !== Boolean(channel.mediaOnly)) patch.mediaOnly = mediaOnly;
    if (stage !== Boolean(channel.stage)) patch.stage = stage;
    if (announcement !== Boolean(channel.announcement)) patch.announcement = announcement;
    if (forum !== Boolean(channel.forum)) patch.forum = forum;
    const saved = forumDraftOf(channel);
    if (forumFingerprint(forumDraft) !== forumFingerprint(saved)) {
      if (forumFingerprint({ ...saved, tags: forumDraft.tags }) !== forumFingerprint(saved)) {
        patch.availableTags = forumDraft.tags
          .filter((t) => t.name.trim())
          .map((t) => ({ ...(t.id ? { id: t.id } : {}), name: t.name.trim(), emoji: t.emoji, moderated: t.moderated }));
      }
      if (forumDraft.requireTag !== saved.requireTag) patch.forumRequireTag = forumDraft.requireTag;
      if (forumDraft.defaultReaction !== saved.defaultReaction) patch.forumDefaultReaction = forumDraft.defaultReaction;
      if (forumDraft.defaultSort !== saved.defaultSort) patch.forumDefaultSort = forumDraft.defaultSort;
      if (forumDraft.defaultLayout !== saved.defaultLayout) patch.forumDefaultLayout = forumDraft.defaultLayout;
    }
    if (isVoice) {
      if (trimmedStatus !== (channel.voiceStatus ?? "")) patch.voiceStatus = trimmedStatus || null;
      if (parsedUserLimit !== null && parsedUserLimit !== (channel.userLimit ?? 0)) patch.userLimit = parsedUserLimit;
      if (bitrate !== readBitrate(channel.bitrate)) patch.bitrate = bitrate;
      if (videoQuality !== readVideoQualityMode(channel.videoQualityMode)) patch.videoQualityMode = videoQuality;
    }
    if (categoryId !== currentCategoryId) {
      patch.categoryId = categoryId === NO_CATEGORY ? null : categoryId;
      patch.permissionMode = categoryId === NO_CATEGORY ? "keep" : permissionMode;
    }
    return patch;
  };

  const patch = creating ? {} : buildPatch();
  const dirty = Object.keys(patch).length > 0;

  const submit = () => {
    if (creating) {
      create.mutate(
        { name: name.trim(), type, ...(categoryId !== NO_CATEGORY ? { categoryId } : {}) },
        { onSuccess: () => router.back(), onError: fail("Kanal oluşturulamadı") }
      );
      return;
    }
    if (isVoice && parsedUserLimit === null) {
      showToast(`Kullanıcı sınırı 0 ile ${VOICE_USER_LIMIT_MAX} arasında olmalı.`, "error");
      return;
    }
    if (!dirty) return;
    update.mutate(patch, {
      onSuccess: () => {
        showToast("Kanal ayarları kaydedildi");
        router.back();
      },
      onError: fail("Kanal ayarları kaydedilemedi"),
    });
  };

  const mutation = creating ? create : update;
  const categoryItems = [
    { id: NO_CATEGORY, label: "Kategorisiz" },
    ...categoryList.map((c) => ({ id: c.id, label: c.name })),
  ];

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: creating ? "Kanal Oluştur" : "Kanal Ayarları" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing["3xl"] }}>
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="KANAL ADI"
            value={name}
            onChangeText={setName}
            autoFocus={creating}
            maxLength={NAME_MAX}
            editable={!locked}
            placeholder="kanal-adi"
          />
          {locked ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Varsayılan kanalın adı değiştirilemez; açıklama, yavaş mod ve izinleri düzenlenebilir.
            </Text>
          ) : null}
        </View>

        {creating ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>KANAL TÜRÜ</Text>
            <SegmentedTabs
              items={[
                { id: ChannelType.TEXT, label: "Metin" },
                { id: ChannelType.AUDIO, label: "Ses" },
                { id: ChannelType.VIDEO, label: "Video" },
              ]}
              value={type}
              onChange={setType}
            />
          </View>
        ) : null}

        {categoryList.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>KATEGORİ</Text>
            <PillPicker
              items={categoryItems}
              selected={[categoryId]}
              disabled={mutation.isPending}
              emptyLabel=""
              onToggle={setCategoryId}
            />
            {!creating ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>Kanal seçilen kategorinin sonuna taşınır.</Text>
            ) : null}
            {!creating && categoryId !== currentCategoryId && categoryId !== NO_CATEGORY ? (
              <Card>
                <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>Kanal izinleri ne olsun?</Text>
                {(
                  [
                    ["sync", "Kategoriyle Eşitle", "Kanal yeni kategorinin izinlerini kullanır; kategori değiştikçe o da değişir."],
                    ["keep", "Geçerli İzinleri Koru", "Kanalın şu anki izinleri olduğu gibi kalır."],
                  ] as const
                ).map(([mode, title, description]) => (
                  <Pressable
                    key={mode}
                    onPress={() => setPermissionMode(mode)}
                    haptic="light"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: permissionMode === mode }}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.xs }}
                  >
                    <Icon
                      name={permissionMode === mode ? "check" : "chevron-right"}
                      size={16}
                      color={permissionMode === mode ? colors.brand : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.caption, ...fw(700), color: colors.text }}>{title}</Text>
                      <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
                    </View>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </View>
        ) : null}

        {!creating && channel ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <TextField
                label="KANAL AÇIKLAMASI"
                value={topic}
                onChangeText={setTopic}
                maxLength={TOPIC_MAX}
                multiline
                placeholder="Bu kanalın ne için olduğunu anlat."
              />
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Başlıkta kanal adının yanında görünür. · {TOPIC_MAX - topic.length}
              </Text>
            </View>

            {isVoice ? (
              <View style={{ gap: spacing.xs }}>
                <TextField
                  label="KANAL DURUMU"
                  value={voiceStatus}
                  onChangeText={setVoiceStatus}
                  maxLength={VOICE_STATUS_MAX}
                  placeholder="Ne oynanıyor, ne konuşuluyor?"
                />
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  Kenar çubuğunda kanal adının altında herkese görünür. Boş bırakırsan gizlenir. · {VOICE_STATUS_MAX - voiceStatus.length}
                </Text>
              </View>
            ) : null}

            {isVoice ? (
              <>
                <TextField
                  label="KULLANICI SINIRI"
                  value={userLimit}
                  onChangeText={(value) => setUserLimit(value.replace(/[^0-9]/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  error={parsedUserLimit === null ? `Kullanıcı sınırı 0 ile ${VOICE_USER_LIMIT_MAX} arasında olmalı.` : null}
                />
                <Text style={{ ...typography.caption, color: colors.muted, marginTop: -spacing.md }}>
                  {parsedUserLimit === 0 ? "Sınırsız · " : parsedUserLimit ? `${parsedUserLimit} kişi · ` : ""}
                  Kanala aynı anda katılabilecek kişi sayısı (0 = sınırsız). Dolunca yalnızca Üyeleri Taşı izni olanlar katılabilir.
                </Text>

                <View style={{ gap: spacing.sm }}>
                  <Text style={{ ...typography.overline, color: colors.muted }}>BİT HIZI</Text>
                  <ListGroup>
                    {bitrateChoices.map((kbps, index) => (
                      <View key={kbps}>
                        {index > 0 ? <Divider inset={16} /> : null}
                        <ListRow
                          title={bitrateLabel(kbps)}
                          detail={bitrate === kbps * 1000 ? "Seçili" : undefined}
                          chevron={false}
                          onPress={() => setBitrate(kbps * 1000)}
                        />
                      </View>
                    ))}
                  </ListGroup>
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    Yüksek bit hızı daha net ses demek ama zayıf bağlantılarda kesintiye yol açabilir.
                    {maxBitrate < VOICE_BITRATE_MAX ? ` ${maxBitrate / 1000} kbps üstü için sunucunun Takviye seviyesi yükselmeli.` : ""}
                  </Text>
                </View>

                <View style={{ gap: spacing.sm }}>
                  <Text style={{ ...typography.overline, color: colors.muted }}>GÖRÜNTÜ KALİTESİ</Text>
                  <SegmentedTabs
                    items={VIDEO_QUALITY_OPTIONS.map((option) => ({ id: option.value, label: option.label }))}
                    value={videoQuality}
                    onChange={setVideoQuality}
                  />
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    Otomatik: kamera kalitesi bağlantıya göre ayarlanır. 720p: kanaldaki herkesin kamerası en az 720p yayınlanır.
                  </Text>
                </View>
              </>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>YAVAŞ MOD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                {SLOW_MODE_OPTIONS.map((option) => {
                  const on = slowMode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setSlowMode(option.value)}
                      haptic="light"
                      noHitSlop
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={{
                        minHeight: 32,
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        borderRadius: radii.full,
                        borderWidth: 1,
                        borderColor: on ? colors.brand : colors.border,
                        backgroundColor: on ? colors.brandSoft : "transparent",
                      }}
                    >
                      <Text style={{ ...typography.caption, ...fw(on ? 700 : 500), color: on ? colors.bright : colors.muted }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Yöneticiler ve moderatörler dışındaki üyeler bu sürede en fazla bir mesaj gönderebilir.
              </Text>
            </View>

            <Card>
              <ToggleRow
                title="Yaş sınırlı kanal"
                hint="Kanal ilk açıldığında içerik gizlenir, üye onaylayınca görünür. Yetişkinlere yönelik içerik için."
                value={nsfw}
                onChange={setNsfw}
              />
              {channel.type === ChannelType.AUDIO ? (
                <ToggleRow
                  title="Sahne kanalı"
                  hint="Herkes dinleyici olarak katılır; konuşmak için el kaldırır. Sahne moderatörleri (sustur, taşı ya da kanal yönetme yetkisi olanlar) konuşmacıları seçer. Kanal Durumu sahne konusu olarak görünür."
                  value={stage}
                  onChange={setStage}
                />
              ) : null}
              {!isVoice ? (
                <>
                  <ToggleRow
                    title="Medya kanalı"
                    hint="Yalnızca görsel, video ya da dosya içeren mesajlar gönderilebilir; düz metin reddedilir. Galeri kanalları için."
                    value={mediaOnly}
                    onChange={setMediaOnly}
                  />
                  <ToggleRow
                    title="Duyuru kanalı"
                    hint="Yalnızca yöneticiler ve moderatörler yazar. Başka sunucular kanalı takip edebilir; mesajın menüsündeki Yayınla ile takipçilere gönderilir."
                    value={announcement}
                    onChange={setAnnouncement}
                  />
                  {!channel.parentChannelId ? (
                    <ToggleRow
                      title="Forum kanalı"
                      hint="Doğrudan mesaj yazılmaz; üyeler başlıklı gönderiler açar, her gönderi kendi alt başlığında konuşulur."
                      value={forum}
                      onChange={setForum}
                    />
                  ) : null}
                </>
              ) : null}
            </Card>

            {forum && !isVoice ? <ForumSettings value={forumDraft} onChange={setForumDraft} /> : null}

            <ListGroup>
              <ListRow
                title="İzinler"
                subtitle="Rol ve üye bazında kanal izinleri"
                icon="shield"
                onPress={() => router.push(`/servers/${serverId}/channel-permissions?channelId=${channelId}`)}
              />
              {/* Kanal Ayarları › Davetler (web channel-settings/invites-tab; yetkiyi uç denetler). */}
              <ListRow
                title={t("parityScreens.channelInvites.title")}
                subtitle={t("parityScreens.channelInvites.subtitle")}
                icon="link"
                onPress={() =>
                  router.push({
                    pathname: "/servers/[serverId]/invites",
                    params: { serverId, channelId, channelName: channel.name },
                  })
                }
              />
            </ListGroup>
          </>
        ) : null}

        <Button
          label={creating ? "Kanalı Oluştur" : "Değişiklikleri Kaydet"}
          fullWidth
          size="lg"
          loading={mutation.isPending}
          disabled={creating ? name.trim().length < 1 : !dirty || name.trim().length < 1 || (isVoice && parsedUserLimit === null)}
          onPress={submit}
        />
        {!creating && dirty ? <Button label="Sıfırla" variant="ghost" fullWidth onPress={reset} /> : null}
        {!creating && !locked ? (
          <Button
            label="Kanalı Sil"
            variant="danger"
            fullWidth
            onPress={() =>
              showDialog("Kanalı sil", "Kanal ve mesajları kalıcı olarak silinecek.", [
                { text: "Vazgeç", style: "cancel" },
                { text: "Sil", style: "destructive", onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }) },
              ])
            }
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** Forum ayarları — web `forum-settings-section.tsx`. */
function ForumSettings({ value, onChange }: { value: ForumDraft; onChange: (next: ForumDraft) => void }) {
  const [emojiFor, setEmojiFor] = useState<string | "reaction" | null>(null);
  const setTags = (tags: DraftTag[]) => onChange({ ...value, tags });
  const updateTag = (key: string, patch: Partial<DraftTag>) =>
    setTags(value.tags.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  return (
    <Card>
      <Text style={{ ...typography.overline, color: colors.muted }}>FORUM ETİKETLERİ</Text>
      {value.tags.map((tag) => (
        <View key={tag.key} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <EmojiSlot value={tag.emoji} label="Etiket emojisi" onPress={() => setEmojiFor(tag.key)} onClear={() => updateTag(tag.key, { emoji: null })} />
            <View style={{ flex: 1 }}>
              <TextField
                label=""
                value={tag.name}
                onChangeText={(name) => updateTag(tag.key, { name })}
                maxLength={FORUM_TAG_MAX}
                placeholder="Etiket adı"
              />
            </View>
            <Pressable
              onPress={() => setTags(value.tags.filter((t) => t.key !== tag.key))}
              accessibilityRole="button"
              accessibilityLabel="Etiketi sil"
              style={{ padding: spacing.sm }}
            >
              <Icon name="trash" size={18} color={colors.danger} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => updateTag(tag.key, { moderated: !tag.moderated })}
            haptic="light"
            accessibilityRole="switch"
            accessibilityState={{ checked: tag.moderated }}
            accessibilityHint="Moderasyonlu: yalnızca moderatörler bu etiketi ekleyip kaldırabilir"
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.md,
              backgroundColor: tag.moderated ? colors.brandSoft : colors.raised,
            }}
          >
            <Icon name="shield" size={13} color={tag.moderated ? colors.brand : colors.muted} />
            <Text style={{ ...typography.caption, ...fw(600), color: tag.moderated ? colors.brand : colors.muted }}>Moderasyonlu</Text>
          </Pressable>
        </View>
      ))}
      {value.tags.length < MAX_FORUM_TAGS ? (
        <Pressable
          onPress={() => setTags([...value.tags, { key: newDraftKey(), name: "", emoji: null, moderated: false }])}
          haptic="light"
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: spacing.xs }}
        >
          <Icon name="plus" size={16} color={colors.brand} />
          <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Etiket ekle</Text>
        </Pressable>
      ) : null}
      <Text style={{ ...typography.caption, color: colors.muted }}>
        En fazla {MAX_FORUM_TAGS} etiket; gönderi en fazla 5 etiket taşır. Moderasyonlu etiketi yalnızca mesajları yönetebilenler ekleyip kaldırabilir (ör. “Çözüldü”).
      </Text>

      <ToggleRow
        title="Etiket zorunlu"
        hint="Gönderi açarken en az bir etiket seçilmesi gerekir."
        value={value.requireTag}
        onChange={(requireTag) => onChange({ ...value, requireTag })}
      />

      <Text style={{ ...typography.overline, color: colors.muted, marginTop: spacing.sm }}>VARSAYILAN TEPKİ</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <EmojiSlot
          value={value.defaultReaction}
          label="Varsayılan tepki emojisi"
          onPress={() => setEmojiFor("reaction")}
          onClear={() => onChange({ ...value, defaultReaction: null })}
        />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
          Gönderi kartlarında tek dokunuşla verilebilen tepki. Boş bırakırsan gösterilmez.
        </Text>
      </View>

      <Text style={{ ...typography.overline, color: colors.muted, marginTop: spacing.sm }}>VARSAYILAN SIRALAMA</Text>
      <SegmentedTabs
        items={[
          { id: "activity" as const, label: "Son hareket" },
          { id: "created" as const, label: "Oluşturma tarihi" },
        ]}
        value={value.defaultSort}
        onChange={(defaultSort) => onChange({ ...value, defaultSort })}
      />
      <Text style={{ ...typography.overline, color: colors.muted, marginTop: spacing.sm }}>VARSAYILAN GÖRÜNÜM</Text>
      <SegmentedTabs
        items={[
          { id: "list" as const, label: "Liste" },
          { id: "gallery" as const, label: "Galeri" },
        ]}
        value={value.defaultLayout}
        onChange={(defaultLayout) => onChange({ ...value, defaultLayout })}
      />

      <Modal visible={emojiFor !== null} transparent animationType="slide" onRequestClose={() => setEmojiFor(null)}>
        <RNPressable onPress={() => setEmojiFor(null)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View
            onStartShouldSetResponder={() => true}
            style={{
              height: 440,
              marginHorizontal: spacing.sm,
              marginBottom: spacing.sm,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.bentoBorder,
              backgroundColor: colors.panel,
              overflow: "hidden",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                {emojiFor === "reaction" ? "Varsayılan tepki emojisi" : "Etiket emojisi"}
              </Text>
              <Pressable onPress={() => setEmojiFor(null)} accessibilityRole="button" accessibilityLabel="Kapat" style={{ padding: spacing.xs }}>
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <EmojiPickerPanel
              onEmoji={(emoji) => {
                if (emojiFor === "reaction") onChange({ ...value, defaultReaction: emoji });
                else if (emojiFor) updateTag(emojiFor, { emoji });
                setEmojiFor(null);
              }}
            />
          </View>
        </RNPressable>
      </Modal>
    </Card>
  );
}

function EmojiSlot({ value, label, onPress, onClear }: { value: string | null; label: string; onPress: () => void; onClear: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.md,
          backgroundColor: colors.raised,
        }}
      >
        {value ? <EmojiText style={{ fontSize: 20, lineHeight: 24 }}>{value}</EmojiText> : <Icon name="emoji" size={18} color={colors.muted} />}
      </Pressable>
      {value ? (
        <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Emojiyi kaldır" style={{ padding: 4 }}>
          <Icon name="close" size={13} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
