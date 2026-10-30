import { useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Image } from "expo-image";

import { openGuardedLink } from "@/lib/external-link";
import { Icon, Pressable, emojify, showToast } from "@/components/ui";
import { openImageViewer } from "@/components/ui/image-viewer";
import { classifyAttachment } from "@/lib/attachments";
import { useT } from "@/lib/i18n";
import { isSensitive } from "@/lib/message-extras";
import {
  accentHex,
  type ActionRow,
  type AnySelectComponent,
  type ButtonComponent,
  type ContainerChild,
  type FileComponent,
  type MediaGalleryComponent,
  type MediaGalleryItem,
  type MessageComponent,
  type SectionComponent,
  type ThumbnailComponent,
} from "@/lib/message-components";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useChatScope } from "../chat-scope";
import { runComponentInteraction, waitForAck } from "../interactions";
import { SelectField, selectDefaults } from "./component-select";
import { MediaGate } from "./media-gate";
import { FileCard, MessageAttachment } from "./message-attachment";
import { MessageMarkdown } from "./message-markdown";

/**
 * Bot mesajı bileşenleri — ciklet-web `chat/v2/message-components.tsx`.
 *
 * Eski biçim: mesajın altında eylem satırları (butonlar / seçim menüsü).
 * Components V2 (`metadata.componentsV2`): mesajın tamamı bileşenlerden
 * oluşur — Kap (vurgu çizgili kart, spoiler örtüsü), Bölüm (metin + sağda
 * küçük görsel ya da buton), Metin (markdown), Medya Galerisi, Dosya,
 * Ayırıcı. Dokunma type 3 etkileşim açar (aynı uç; sunucu kanalı ve bot
 * DM'i); bot yanıtlayınca mesaj akıştan güncellenir. Bağlantı butonu
 * (stil 5) etkileşim açmaz, adresi açar.
 */
export function MessageComponents({ message, components }: { message: ChatMessagePayload; components: MessageComponent[] }) {
  const t = useT();
  const scope = useChatScope();
  const [busy, setBusy] = useState<string | null>(null);
  // Mesaj menüsü gönderildikten sonra varsayılanlara döner (anahtar yenilenir).
  const [resetKey, setResetKey] = useState(0);
  const chatId = scope?.chatId ?? (isChannelMessage(message) ? message.channelId : null);
  const profile = isChannelMessage(message) ? message.member.profile : message.profile;
  const botName = profile?.name?.trim() || profile?.username || "Bot";
  const sensitive = isSensitive(message.metadata);

  const fire = async (customId: string, values?: string[]) => {
    if (!chatId || busy) return;
    setBusy(customId);
    const result = await runComponentInteraction(chatId, message.id, customId, values);
    setBusy(null);
    if (values) setResetKey((k) => k + 1);
    if (!result.ok) {
      showToast(result.error || t("messageComponents.interactionFailed"), "error");
      return;
    }
    void waitForAck(chatId, result.id).then((silent) => {
      if (silent) showToast(t("messageComponents.botNoResponse", { name: botName }));
    });
  };

  if (!chatId) return null;
  const ctx: RenderCtx = { busy, fire, sensitive, resetKey, scope };

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
      {components.map((component, index) => (
        <TopComponent key={component.id ?? index} component={component} ctx={ctx} />
      ))}
    </View>
  );
}

interface RenderCtx {
  busy: string | null;
  fire: (customId: string, values?: string[]) => Promise<void>;
  sensitive: boolean;
  resetKey: number;
  scope: ReturnType<typeof useChatScope>;
}

function TopComponent({ component, ctx }: { component: MessageComponent; ctx: RenderCtx }) {
  if (component.type === 17) return <Container component={component} ctx={ctx} />;
  return <Child component={component} ctx={ctx} />;
}

function Child({ component, ctx }: { component: ContainerChild; ctx: RenderCtx }) {
  switch (component.type) {
    case 1:
      return <Row row={component} ctx={ctx} />;
    case 10:
      return <MessageMarkdown value={component.content} color={colors.bright} />;
    case 9:
      return <Section component={component} ctx={ctx} />;
    case 12:
      return <Gallery component={component} sensitive={ctx.sensitive} />;
    case 13:
      return <FileBlock component={component} sensitive={ctx.sensitive} />;
    case 14: {
      const gap = component.spacing === 2 ? 16 : 8;
      return (
        <View style={{ paddingVertical: gap / 2 }}>
          {component.divider !== false ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
        </View>
      );
    }
    default:
      return null;
  }
}

/** Kap: panel zemin, ince çerçeve, solda vurgu çizgisi; spoiler ise örtülü. */
function Container({ component, ctx }: { component: Extract<MessageComponent, { type: 17 }>; ctx: RenderCtx }) {
  const accent = accentHex(component.accent_color);
  const card = (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
        overflow: "hidden",
      }}
    >
      {accent ? <View style={{ width: 4, backgroundColor: accent }} /> : null}
      <View style={{ flex: 1, minWidth: 0, padding: spacing.lg, gap: 8 }}>
        {component.components.map((child, index) => (
          <Child key={child.id ?? index} component={child} ctx={ctx} />
        ))}
      </View>
    </View>
  );
  return component.spoiler ? <SpoilerCover>{card}</SpoilerCover> : card;
}

/** Kabın spoiler örtüsü — medya örtüsüyle aynı dil ("Spoiler", "Göster"). */
function SpoilerCover({ children }: { children: ReactNode }) {
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  if (revealed) return <>{children}</>;
  return (
    <Pressable
      onPress={() => setRevealed(true)}
      accessibilityRole="button"
      accessibilityLabel={`${t("messageComponents.spoiler")}, ${t("messageComponents.show")}`}
      style={{
        minHeight: 96,
        borderRadius: 8,
        borderCurve: "continuous",
        backgroundColor: colors.deep,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        padding: spacing.lg,
      }}
    >
      <Icon name="eye-off" size={22} color={colors.muted} />
      <Text style={{ ...typography.bodyStrong, color: colors.text }}>{t("messageComponents.spoiler")}</Text>
      <Text style={{ ...typography.caption, color: colors.brand }}>{t("messageComponents.show")}</Text>
    </Pressable>
  );
}

function Section({ component, ctx }: { component: SectionComponent; ctx: RenderCtx }) {
  const accessory = component.accessory;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {component.components.map((text, index) => (
          <MessageMarkdown key={text.id ?? index} value={text.content} color={colors.bright} />
        ))}
      </View>
      {accessory.type === 11 ? (
        <Thumbnail component={accessory} sensitive={ctx.sensitive} />
      ) : (
        <ComponentButton component={accessory} busy={ctx.busy === accessory.custom_id} onPress={() => pressButton(accessory, ctx)} />
      )}
    </View>
  );
}

function Thumbnail({ component, sensitive }: { component: ThumbnailComponent; sensitive: boolean }) {
  const t = useT();
  return (
    <MediaGate spoiler={Boolean(component.spoiler)} sensitive={sensitive}>
      <Pressable
        onPress={() => openImageViewer(component.media.url, null)}
        accessibilityRole="imagebutton"
        accessibilityLabel={component.description ?? t("messageComponents.openImage")}
      >
        <Image
          source={{ uri: component.media.url }}
          style={{ width: 85, height: 85, borderRadius: 8 }}
          contentFit="cover"
          accessibilityLabel={component.description}
        />
      </Pressable>
    </MediaGate>
  );
}

function isVideo(item: MediaGalleryItem): boolean {
  return classifyAttachment(item.media.url, item.media.content_type ? { type: item.media.content_type } : null) === "video";
}

/** Medya galerisi: 1 → tek görsel; 2 ya da 4 → iki sütun; 3 ya da ≥5 → üç sütun kare. */
function Gallery({ component, sensitive }: { component: MediaGalleryComponent; sensitive: boolean }) {
  const [width, setWidth] = useState(0);
  const items = component.items;
  if (items.length === 1) {
    const item = items[0];
    if (isVideo(item)) {
      // Spoiler bayrağı ek adındaki SPOILER_ önekiyle aynı örtüyü açar.
      return (
        <MessageAttachment
          url={item.media.url}
          metadata={{ attachment: { type: item.media.content_type, ...(item.spoiler ? { name: "SPOILER_video" } : {}) }, sensitive }}
        />
      );
    }
    return <SingleImage item={item} sensitive={sensitive} />;
  }
  const columns = items.length === 2 || items.length === 4 ? 2 : 3;
  const gap = 4;
  const tile = width > 0 ? (width - gap * (columns - 1)) / columns : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap, borderRadius: 8, overflow: "hidden" }}
    >
      {tile > 0
        ? items.map((item, index) => (
            <MediaGate key={`${item.media.url}-${index}`} spoiler={Boolean(item.spoiler)} sensitive={sensitive}>
              <GalleryTile item={item} size={tile} />
            </MediaGate>
          ))
        : null}
    </View>
  );
}

function GalleryTile({ item, size }: { item: MediaGalleryItem; size: number }) {
  const t = useT();
  if (isVideo(item)) {
    return (
      <Pressable
        onPress={() => openGuardedLink(item.media.url)}
        accessibilityRole="button"
        accessibilityLabel={item.description ?? t("messageComponents.attachment")}
        style={{ width: size, height: size, backgroundColor: colors.deep, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="play" size={26} color={colors.bright} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => openImageViewer(item.media.url, null)}
      accessibilityRole="imagebutton"
      accessibilityLabel={item.description ?? t("messageComponents.openImage")}
    >
      <Image source={{ uri: item.media.url }} style={{ width: size, height: size }} contentFit="cover" />
    </Pressable>
  );
}

function SingleImage({ item, sensitive }: { item: MediaGalleryItem; sensitive: boolean }) {
  const t = useT();
  const known = item.media.width && item.media.height ? item.media.width / item.media.height : null;
  const [aspect, setAspect] = useState<number | null>(known);
  const ratio = aspect ?? 4 / 3;
  return (
    <MediaGate spoiler={Boolean(item.spoiler)} sensitive={sensitive}>
      <Pressable
        onPress={() => openImageViewer(item.media.url, null)}
        accessibilityRole="imagebutton"
        accessibilityLabel={item.description ?? t("messageComponents.openImage")}
        style={{ alignSelf: "flex-start", width: "100%", maxHeight: 350 }}
      >
        <Image
          source={{ uri: item.media.url }}
          onLoad={(e) => {
            if (!known && e.source.width && e.source.height) setAspect(e.source.width / e.source.height);
          }}
          style={{ width: "100%", aspectRatio: ratio, maxHeight: 350, borderRadius: 8 }}
          contentFit="contain"
          contentPosition="left"
        />
      </Pressable>
    </MediaGate>
  );
}

function FileBlock({ component, sensitive }: { component: FileComponent; sensitive: boolean }) {
  const info = { name: component.name, type: component.file.content_type, size: component.size };
  const card = <FileCard url={component.file.url} info={info} kind={classifyAttachment(component.file.url, info) === "probe" ? "file" : classifyAttachment(component.file.url, info)} />;
  return component.spoiler || sensitive ? (
    <MediaGate spoiler={Boolean(component.spoiler)} sensitive={sensitive}>
      {card}
    </MediaGate>
  ) : (
    card
  );
}

function pressButton(component: ButtonComponent, ctx: RenderCtx) {
  if (component.style === 5) {
    if (component.url) openGuardedLink(component.url);
    return;
  }
  if (component.custom_id) void ctx.fire(component.custom_id);
}

function Row({ row, ctx }: { row: ActionRow; ctx: RenderCtx }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {row.components.map((component, index) =>
        component.type === 2 ? (
          <ComponentButton
            key={component.custom_id ?? component.url ?? index}
            component={component}
            busy={ctx.busy === component.custom_id}
            onPress={() => pressButton(component, ctx)}
          />
        ) : (
          <MessageSelect key={`${component.custom_id}-${ctx.resetKey}`} component={component} ctx={ctx} />
        )
      )}
    </View>
  );
}

function MessageSelect({ component, ctx }: { component: AnySelectComponent; ctx: RenderCtx }) {
  return (
    <SelectField
      component={component}
      scope={ctx.scope}
      values={selectDefaults(component)}
      busy={ctx.busy === component.custom_id}
      onCommit={(values) => void ctx.fire(component.custom_id, values)}
    />
  );
}

function buttonColors(style: ButtonComponent["style"]): { background: string; text: string } {
  switch (style) {
    case 1:
      return { background: colors.brand, text: colors.onBrand };
    case 3:
      return { background: colors.success, text: "#ffffff" };
    case 4:
      return { background: colors.dangerSolid, text: "#ffffff" };
    default:
      return { background: colors.raised, text: colors.bright };
  }
}

function ComponentButton({ component, busy, onPress }: { component: ButtonComponent; busy: boolean; onPress: () => void }) {
  const tone = buttonColors(component.style);
  const disabled = Boolean(component.disabled) || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole={component.style === 5 ? "link" : "button"}
      accessibilityLabel={component.label ?? component.emoji ?? "Düğme"}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        height: 32,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: tone.background,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone.text} /> : null}
      {component.emoji ? <Text style={{ fontSize: 14 }}>{emojify(component.emoji, `cb-${component.custom_id ?? component.url}`, 16)}</Text> : null}
      {component.label ? (
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, ...fw(600), color: tone.text, maxWidth: 200 }}>
          {component.label}
        </Text>
      ) : null}
      {component.style === 5 ? <Icon name="link" size={12} color={tone.text} /> : null}
    </Pressable>
  );
}
