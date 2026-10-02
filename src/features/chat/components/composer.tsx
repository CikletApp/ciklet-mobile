import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type RefObject } from "react";
import { BackHandler, Keyboard, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconButton, Pressable, emojify } from "@/components/ui";
import { splitEmoji } from "@/lib/emoji";
import type { MessageAttachment } from "@/lib/uploads";
import type { ChatMessagePayload } from "@/realtime/events";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { KeyboardGlyph } from "./composer-glyphs";
import { ComposerPanel } from "./composer-picker";
import {
  rememberPanelTab,
  useKeyboardSpace,
  useLastPanelTab,
  usePanelHeight,
  type PanelTab,
} from "./keyboard-space";

/**
 * Mesaj yazma çubuğu + klavyenin yerini alan emoji/GIF/aktivite paneli.
 *
 * Çubuğun altındaki boşluk TEK yerde hesaplanır: klavye açıksa klavye
 * kadar, panel açıksa son klavye yüksekliği kadar (ikisinden büyüğü).
 * Böylece klavye ↔ panel geçişinde çubuk yerinden oynamaz:
 *  • panele geçerken klavye kapanırken alan panelle dolu kalır;
 *  • klavyeye dönerken panel, klavye açılana (`keyboardDidShow`) kadar
 *    yerinde durur, sonra çekilir.
 * Sohbet ekranı bu yüzden `KeyboardAvoider` kullanmıyor.
 */

/** Panel içinde arama yazılırken klavyenin üstünde kalan dar panelin boyu. */
const SEARCH_PANEL_HEIGHT = 180;

/** Sohbet ekranının panele dışarıdan erişimi — eski mesajlara kaydırınca kapatmak için. */
export interface ComposerHandle {
  closePanel: () => void;
  isPanelOpen: () => boolean;
}
const INPUT_BUTTON_SIZE = 36;

export function Composer({
  inputRef,
  value,
  onChangeText,
  onSend,
  placeholder,
  attachment,
  replyingTo,
  uploadProgress,
  uploadError,
  onPickAttachment,
  onRemoveAttachment,
  onCancelReply,
  onSelectGif,
  onSelectActivity,
  commandsAvailable = false,
  controlRef,
}: {
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  attachment: MessageAttachment | null;
  replyingTo: ChatMessagePayload | null;
  uploadProgress: number | null;
  uploadError: string | null;
  onPickAttachment: () => void;
  onRemoveAttachment: () => void;
  onCancelReply: () => void;
  onSelectGif: (url: string) => void;
  onSelectActivity: (activityId: string) => void;
  /** Kanaldaki botların "/" komutu var — klavye açıkken "/" düğmesi görünür. */
  commandsAvailable?: boolean;
  controlRef?: RefObject<ComposerHandle | null>;
}) {
  const insets = useSafeAreaInsets();
  const { height: keyboardHeight, visible: keyboardVisible } = useKeyboardSpace();
  const storedHeight = usePanelHeight();
  const lastTab = useLastPanelTab();
  const [panel, setPanel] = useState<PanelTab | null>(null);
  /** Panelin kendi arama kutusu odakta (emoji ya da GIF araması). */
  const [searching, setSearching] = useState(false);
  /** İmleç — emoji sona değil imlecin olduğu yere girer. */
  const selection = useRef({ start: 0, end: 0 });

  const canSend = value.trim().length > 0 || Boolean(attachment);
  const isUploading = uploadProgress !== null;
  const panelOpen = panel !== null;
  // Arama klavyesi açıkken panel klavyenin üstünde dar bir şerit olarak kalır.
  const compact = panelOpen && searching && keyboardVisible;
  const panelHeight = compact ? SEARCH_PANEL_HEIGHT : storedHeight;
  const bottomInset = insets.bottom;

  // Klavye YAZI KUTUSU için açıldıysa panel artık çekilebilir; panelin
  // arama kutusunun klavyesiyse panel yerinde kalır.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      if (inputRef.current?.isFocused()) {
        setPanel(null);
        setSearching(false);
      }
    });
    return () => subscription.remove();
  }, [inputRef]);

  // Android geri tuşu önce paneli kapatır, ekrandan çıkmaz.
  useEffect(() => {
    if (!panelOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPanel(null);
      setSearching(false);
      return true;
    });
    return () => subscription.remove();
  }, [panelOpen]);

  const spacerStyle = useAnimatedStyle(() => {
    const keyboard = keyboardHeight.get();
    if (!panelOpen) return { height: Math.max(keyboard, bottomInset) };
    if (searching) return { height: Math.max(keyboard + SEARCH_PANEL_HEIGHT, storedHeight) };
    return { height: Math.max(keyboard, storedHeight) };
  }, [panelOpen, searching, storedHeight, bottomInset]);

  const openPanel = () => {
    setSearching(false);
    setPanel(lastTab);
    Keyboard.dismiss();
  };

  const closePanel = () => {
    setPanel(null);
    setSearching(false);
  };

  useImperativeHandle(controlRef, () => ({ closePanel, isPanelOpen: () => panelOpen }), [panelOpen]);

  /** Klavye düğmesi: yazmaya dönülür, boş alan kalmasın diye klavye gelir. */
  const returnToKeyboard = () => {
    inputRef.current?.focus();
    // Arama klavyesi zaten açıksa `keyboardDidShow` yeniden gelmez.
    if (keyboardVisible) closePanel();
  };

  const changeTab = (tab: PanelTab) => {
    rememberPanelTab(tab);
    setSearching(false);
    setPanel(tab);
  };

  const currentRange = () => {
    const start = Math.min(selection.current.start, value.length);
    const end = Math.min(Math.max(selection.current.end, start), value.length);
    return { start, end };
  };

  const replaceRange = (start: number, end: number, text: string) => {
    const caret = start + text.length;
    selection.current = { start: caret, end: caret };
    onChangeText(value.slice(0, start) + text + value.slice(end));
    // Değer bir sonraki çizimde yerleşir; imleç ondan sonra taşınır.
    requestAnimationFrame(() => inputRef.current?.setSelection(caret, caret));
  };

  const insertEmoji = (emoji: string) => {
    const { start, end } = currentRange();
    replaceRange(start, end, emoji);
  };

  const backspace = () => {
    const { start, end } = currentRange();
    if (start !== end) return replaceRange(start, end, "");
    if (start === 0) return;
    const cut = lastGraphemeLength(value.slice(0, start));
    replaceRange(start - cut, end, "");
  };

  const slashVisible = commandsAvailable && keyboardVisible && !panelOpen && value.length === 0;

  return (
    <View>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.deep,
          gap: spacing.sm,
        }}
      >
        {attachment ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              borderCurve: "continuous",
              backgroundColor: colors.panel,
            }}
          >
            <IconButton icon="attachment" label="Ek" background="transparent" tint={colors.brand} disabled size={28} />
            <Text style={{ ...typography.caption, color: colors.text, flex: 1 }} numberOfLines={1}>
              {attachment.name}
            </Text>
            <IconButton
              icon="close"
              label="Eki kaldır"
              background="transparent"
              tint={colors.muted}
              onPress={onRemoveAttachment}
              size={28}
            />
          </View>
        ) : null}

        {/* Yazı kutusu emojiyi telefonun yazı tipiyle çiziyor ve Dokimorji
            (özel kullanım alanı karakterleri) orada boş kutu görünüyor; taslakta
            Dokimorji varsa gönderilecek hâli Twemoji'yle burada önizlenir. */}
        {/[\u{F0000}-\u{FFFFD}]/u.test(value) ? (
          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radii.sm,
              backgroundColor: colors.panel,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={2}>
              {emojify(value, "draft", 18)}
            </Text>
          </View>
        ) : null}

        {replyingTo ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderLeftWidth: 2,
              borderLeftColor: colors.brand,
              borderRadius: radii.sm,
              backgroundColor: colors.panel,
            }}
          >
            <IconButton icon="reply" label="Yanıt" background="transparent" tint={colors.brand} disabled size={28} />
            <Text style={{ ...typography.caption, color: colors.text, flex: 1 }} numberOfLines={1}>
              {replyingTo.content}
            </Text>
            <IconButton
              icon="close"
              label="Yanıtı iptal et"
              background="transparent"
              tint={colors.muted}
              onPress={onCancelReply}
              size={28}
            />
          </View>
        ) : null}

        {isUploading || uploadError ? (
          <Text style={{ ...typography.caption, color: uploadError ? colors.danger : colors.muted }}>
            {uploadError ?? `Dosya yükleniyor… %${Math.round(uploadProgress ?? 0)}`}
          </Text>
        ) : null}

        {/* Telegram düzeni: [+] [yazı kutusu (içinde "/" ve emoji/klavye)] [gönder].
            GIF ve aktiviteler artık panelin sekmeleri. */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
          <IconButton
            icon="plus"
            label="Dosya ekle"
            background="transparent"
            tint={colors.muted}
            disabled={isUploading}
            onPress={onPickAttachment}
          />

          <View
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              flexDirection: "row",
              alignItems: "flex-end",
              paddingRight: 2,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.panel,
            }}
          >
            <TextInput
              ref={inputRef}
              autoFocus
              value={value}
              onChangeText={onChangeText}
              onSelectionChange={(event) => {
                selection.current = event.nativeEvent.selection;
              }}
              onFocus={() => {
                // Panel aramasının klavyesi açıkken yazı kutusuna dönülürse
                // `keyboardDidShow` gelmez; panel burada çekilir.
                if (panelOpen && keyboardVisible) closePanel();
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              multiline
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 40,
                paddingLeft: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.bright,
                ...typography.body,
              }}
              accessibilityLabel="Mesaj yaz"
            />
            {slashVisible ? (
              <InputButton
                label="Bot komutları"
                onPress={() => {
                  selection.current = { start: 1, end: 1 };
                  onChangeText("/");
                }}
              >
                <Text style={{ fontSize: 18, lineHeight: 22, ...fw(700), color: colors.muted }}>/</Text>
              </InputButton>
            ) : null}
            <InputButton
              label={panelOpen ? "Klavyeye dön" : "Emoji, GIF ve aktiviteler"}
              onPress={panelOpen ? returnToKeyboard : openPanel}
            >
              {panelOpen ? (
                <KeyboardGlyph size={19} color={colors.muted} />
              ) : (
                <Icon name="emoji" size={18} color={colors.muted} />
              )}
            </InputButton>
          </View>

          <IconButton
            icon="send"
            label="Gönder"
            onPress={onSend}
            disabled={!canSend || isUploading}
            background={canSend ? colors.brand : colors.panel}
            tint={canSend ? colors.onBrand : colors.muted}
            size={40}
            haptic="light"
          />
        </View>
      </View>

      {/* Klavyenin ya da panelin kapladığı alan. */}
      <Animated.View style={[{ overflow: "hidden" }, spacerStyle]}>
        {panel ? (
          <ComposerPanel
            tab={panel}
            height={panelHeight}
            compact={compact}
            onTabChange={changeTab}
            onEmoji={insertEmoji}
            onBackspace={backspace}
            onGif={(url) => {
              closePanel();
              onSelectGif(url);
            }}
            onActivity={(activityId) => {
              closePanel();
              onSelectActivity(activityId);
            }}
            onSearchFocusChange={setSearching}
            onDismiss={closePanel}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Yazı kutusunun içindeki küçük yuvarlak düğme ("/", emoji, klavye). */
function InputButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: INPUT_BUTTON_SIZE,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.full,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

type GraphemeSegmenter = new (
  locale: string,
  options: { granularity: "grapheme" }
) => { segment(text: string): Iterable<{ segment: string }> };

/**
 * Metnin sonundaki son "karakterin" (grafem) UTF-16 uzunluğu — geri silme
 * bir emojiyi, bayrağı ya da ZWJ dizisini yarıda bölmesin. Hermes'te
 * `Intl.Segmenter` yoksa sondaki emoji Twemoji ayrıştırıcısıyla bulunur;
 * değilse son kod noktası silinir (vekil çifti bölünmez).
 */
function lastGraphemeLength(text: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenter }).Segmenter;
  if (typeof Segmenter === "function") {
    let last = "";
    for (const part of new Segmenter("tr", { granularity: "grapheme" }).segment(text)) last = part.segment;
    if (last) return last.length;
  }
  const segments = splitEmoji(text);
  const tail = segments[segments.length - 1];
  if (tail?.kind === "emoji") return tail.text.length;
  const points = Array.from(text);
  return points[points.length - 1]?.length ?? 1;
}
