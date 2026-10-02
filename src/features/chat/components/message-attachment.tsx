import { useCallback, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

import { Icon, IconButton, Pressable, showToast, type IconName } from "@/components/ui";
import { openImageViewer } from "@/components/ui/image-viewer";
import {
  attachmentDisplayName,
  classifyAttachment,
  formatFileSize,
  readAttachmentInfo,
  type AttachmentInfo,
  type AttachmentKind,
} from "@/lib/attachments";
import { downloadAttachment } from "@/lib/downloads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Mesaj eki — ciklet-web `components/chat/v2/message-attachment.tsx`.
 *
 * Görsel gerçek oranıyla çizilir ve dokununca kökteki tek görüntüleyicide
 * (components/ui/image-viewer: yaklaştırma, çekerek kapatma) açılır; video
 * uygulamanın içinde oynar; ses, PDF, metin ve diğerleri ad + boyut taşıyan
 * dosya kartıdır. Tür kararı `lib/attachments.ts`'te (web'le aynı sıra).
 *
 * Hiçbir ek kullanıcıyı Ciklet dışına (tarayıcıya) göndermez: açmak yerine
 * uygulama içinde indirilir (`lib/downloads.ts`).
 */

/** Balon içindeki medyanın sınırı — web'deki 400×350'nin telefon karşılığı. */
const MAX_WIDTH = 260;
const MAX_HEIGHT = 320;

/** Altyazılı medya balonunun genişliği — medya bu genişliği kenardan kenara doldurur. */
export const MEDIA_BUBBLE_WIDTH = MAX_WIDTH;

/** Medya basılı tutulunca mesajın bağlam menüsü açılsın diye aynı gecikme. */
const LONG_PRESS_DELAY = 280;

/**
 * `default`: kendi köşeleri yuvarlak, gerçek oranında bağımsız medya.
 * `bubble`: altyazılı mesajda (Telegram gibi) balonun üst ve yan kenarlarına
 * yaslanır — köşeyi balonun kırpması belirler, genişlik balonun genişliği.
 */
export type AttachmentVariant = "default" | "bubble";

export function MessageAttachment({
  url,
  metadata,
  overlay,
  variant = "default",
  onLongPress,
}: {
  url: string;
  metadata: unknown;
  /**
   * Balonsuz çizimde (WhatsApp gibi) medyanın sağ alt köşesine bindirilen
   * içerik — mesaj saati. Balon içindeyken saat balonun kendisinde.
   */
  overlay?: ReactNode;
  variant?: AttachmentVariant;
  /**
   * Medyanın kendi dokunma alanı (büyütme, oynatma) basılı tutmayı yutuyor;
   * mesaj menüsünün görselin üstünden de açılması için buraya aktarılır.
   */
  onLongPress?: () => void;
}) {
  const info = readAttachmentInfo(metadata);
  const detected = classifyAttachment(url, info);
  // Tür bilinmeyen eski yükleme görsel olarak denenir; yüklenemezse kart.
  const [probeFailed, setProbeFailed] = useState(false);
  const kind: AttachmentKind = detected === "probe" ? (probeFailed ? "file" : "image") : detected;
  const fill = variant === "bubble";

  if (kind === "image") {
    return (
      <ImageAttachment
        url={url}
        info={info}
        overlay={overlay}
        fill={fill}
        onLongPress={onLongPress}
        onError={detected === "probe" ? () => setProbeFailed(true) : undefined}
      />
    );
  }
  if (kind === "video") {
    return <VideoAttachment url={url} info={info} overlay={overlay} fill={fill} onLongPress={onLongPress} />;
  }
  const card = <FileCard url={url} info={info} kind={kind} footer={overlay} onLongPress={onLongPress} />;
  // Balon kenarına yaslanmış düzende kart kenara yapışmasın.
  return fill ? <View style={{ padding: spacing.sm }}>{card}</View> : card;
}

/**
 * Eki cihaza indirir ve sonucu bildirim şeridiyle söyler; hata fırlatmaz.
 * Mesaj menüsündeki "Resmi kaydet" de bunu kullanır — menü hemen kapanır,
 * şerit kökte görünür.
 */
export async function saveAttachment(url: string, info: AttachmentInfo | null): Promise<void> {
  try {
    const result = await downloadAttachment({ url, name: info?.name, mimeType: info?.type });
    if (result === "downloads") showToast("İndirilenler › Ciklet klasörüne kaydedildi");
    else if (result === "folder") showToast("İndirildi");
  } catch {
    showToast("İndirilemedi. Bağlantını kontrol edip tekrar dene.", "error");
  }
}

/** İndirme + geri bildirim; aynı ek için çift dokunuşu yok sayar. */
function useDownload(url: string, info: AttachmentInfo | null) {
  const [busy, setBusy] = useState(false);
  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveAttachment(url, info);
    } finally {
      setBusy(false);
    }
  }, [busy, url, info]);
  return { busy, start };
}

/** Oranı koruyarak sınırlara sığdırır; küçük görseli büyütmez (web'le aynı). */
function fit(width: number, height: number) {
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Balonu dolduran medyanın en/boy oranı. Genişlik sabit (balon) olduğundan
 * yükseklik orandan çıkar: çok dikey görsel MAX_HEIGHT'ı, çok yatay görsel
 * de ince bir şeride dönmeyi aşmasın diye oran iki yönden sınırlanır;
 * taşan kısım `cover` ile kırpılır.
 */
function fillAspect(aspect: number) {
  return Math.min(Math.max(aspect, MAX_WIDTH / MAX_HEIGHT), 2);
}

/** Medyanın sağ alt köşesindeki koyu hap — saat okunur kalsın. */
function MediaOverlay({ children }: { children: ReactNode }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: spacing.sm,
        bottom: spacing.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
    >
      {children}
    </View>
  );
}

function ImageAttachment({
  url,
  info,
  overlay,
  fill,
  onLongPress,
  onError,
}: {
  url: string;
  info: AttachmentInfo | null;
  overlay?: ReactNode;
  fill: boolean;
  onLongPress?: () => void;
  onError?: () => void;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  return (
    <>
      <Pressable
        noHitSlop
        onPress={() => openImageViewer(url, info)}
        onLongPress={onLongPress}
        delayLongPress={LONG_PRESS_DELAY}
        accessibilityRole="imagebutton"
        accessibilityLabel={info?.name ? `${info.name} — büyüt` : "Görseli büyüt"}
      >
        <Image
          source={{ uri: url }}
          contentFit="cover"
          transition={150}
          recyclingKey={url}
          onLoad={(event) => {
            const { width, height } = event.source;
            if (width > 0 && height > 0) setNatural({ width, height });
          }}
          onError={onError}
          style={{
            ...(fill
              ? {
                  width: "100%",
                  aspectRatio: fillAspect(natural ? natural.width / natural.height : 4 / 3),
                }
              : // Boyut gelene kadar sabit bir yer tutucu; liste zıplamasın.
                natural
                ? fit(natural.width, natural.height)
                : { width: 220, height: 165 }),
            borderRadius: fill ? 0 : radii.lg,
            backgroundColor: colors.deep,
          }}
        />
        {overlay ? <MediaOverlay>{overlay}</MediaOverlay> : null}
      </Pressable>
    </>
  );
}

/**
 * Video — dokununca oynatıcı kurulur. Web `preload="metadata"` ile ilk kareyi
 * gösteriyor; telefonda her video mesajı için oynatıcı açmak, kullanıcı
 * izlemese de mobil veriyi harcardı.
 */
function VideoAttachment({
  url,
  info,
  overlay,
  fill,
  onLongPress,
}: {
  url: string;
  info: AttachmentInfo | null;
  overlay?: ReactNode;
  fill: boolean;
  onLongPress?: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const download = useDownload(url, info);

  if (failed) {
    const card = (
      <FileCard url={url} info={info} kind="video" hint="Video oynatılamadı — dokunarak indir" footer={overlay} onLongPress={onLongPress} />
    );
    return fill ? <View style={{ padding: spacing.sm }}>{card}</View> : card;
  }
  if (started) return <InlineVideo url={url} fill={fill} onError={() => setFailed(true)} />;

  const sizeLabel = formatFileSize(info?.size);
  return (
    <Pressable
      noHitSlop
      onPress={() => setStarted(true)}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_DELAY}
      accessibilityRole="button"
      accessibilityLabel={`Videoyu oynat${info?.name ? `: ${info.name}` : ""}`}
      style={{
        width: fill ? "100%" : MAX_WIDTH,
        maxWidth: "100%",
        aspectRatio: 16 / 9,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: fill ? 0 : radii.lg,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.full,
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      >
        <Icon name="play" size={24} color="#ffffff" filled />
      </View>
      <View style={{ position: "absolute", top: spacing.xs, right: spacing.xs }}>
        {download.busy ? (
          <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#ffffff" size="small" />
          </View>
        ) : (
          <IconButton icon="download" label="Videoyu indir" onPress={download.start} size={32} background="rgba(0,0,0,0.45)" tint="#ffffff" />
        )}
      </View>
      {info?.name || sizeLabel ? (
        <Text
          numberOfLines={1}
          style={{
            ...typography.caption,
            position: "absolute",
            left: spacing.sm,
            right: overlay ? 64 : spacing.sm,
            bottom: spacing.sm,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {[info?.name, sizeLabel].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {overlay ? <MediaOverlay>{overlay}</MediaOverlay> : null}
    </Pressable>
  );
}

function InlineVideo({ url, fill, onError }: { url: string; fill: boolean; onError: () => void }) {
  const [aspect, setAspect] = useState(16 / 9);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(url, (instance) => {
    instance.play();
  });

  useEventListener(player, "sourceLoad", ({ availableVideoTracks }) => {
    const size = availableVideoTracks[0]?.size;
    if (size && size.width > 0 && size.height > 0) setAspect(size.width / size.height);
  });
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") setReady(true);
    if (status === "error") onError();
  });

  // Yatay video genişliğe, dikey video yüksekliğe sığar. Balonu dolduran
  // düzende genişlik balonun kendisi; yükseklik sınırlı orandan çıkar.
  const width = aspect >= MAX_WIDTH / MAX_HEIGHT ? MAX_WIDTH : Math.round(MAX_HEIGHT * aspect);

  return (
    <View
      style={{
        width: fill ? "100%" : width,
        aspectRatio: fill ? fillAspect(aspect) : aspect,
        borderRadius: fill ? 0 : radii.lg,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        // Mesaj listesi ters çevrilmiş (inverted) bir FlatList; SurfaceView
        // görünüm dönüşümlerine uymuyor ve video baş aşağı çıkabiliyor.
        surfaceType={Platform.OS === "android" ? "textureView" : undefined}
        style={{ flex: 1 }}
      />
      {!ready ? (
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

const KIND_ICON: Partial<Record<AttachmentKind, { icon: IconName; tint: () => string }>> = {
  video: { icon: "video", tint: () => colors.brand },
  audio: { icon: "volume", tint: () => colors.brand },
  pdf: { icon: "file", tint: () => colors.danger },
  text: { icon: "file", tint: () => colors.brand },
};

/** Genel dosya kartı — web `FileCard`: simge, ad, boyut ve İndir. */
function FileCard({
  url,
  info,
  kind,
  hint,
  footer,
  onLongPress,
}: {
  url: string;
  info: AttachmentInfo | null;
  kind: AttachmentKind;
  hint?: string;
  footer?: ReactNode;
  onLongPress?: () => void;
}) {
  const name = attachmentDisplayName(url, info);
  const sizeLabel = formatFileSize(info?.size);
  const visual = KIND_ICON[kind];
  const download = useDownload(url, info);

  return (
    <Pressable
      noHitSlop
      onPress={download.start}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_DELAY}
      disabled={download.busy}
      accessibilityRole="button"
      accessibilityLabel={`${name} dosyasını indir`}
      style={({ pressed }) => ({
        minWidth: 220,
        maxWidth: MAX_WIDTH,
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : colors.deep,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Icon name={visual?.icon ?? "file"} size={26} color={visual ? visual.tint() : colors.brand} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...typography.caption, ...fw(600), color: colors.bright }}>
            {name}
          </Text>
          {hint || sizeLabel ? (
            <Text numberOfLines={1} style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>
              {hint ?? sizeLabel}
            </Text>
          ) : null}
        </View>
        {download.busy ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Icon name="download" size={18} color={colors.brand} />
        )}
      </View>
      {footer ? <View style={{ alignSelf: "flex-end" }}>{footer}</View> : null}
    </Pressable>
  );
}
