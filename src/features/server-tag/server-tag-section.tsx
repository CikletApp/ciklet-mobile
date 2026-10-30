import { useEffect, useState } from "react";
import { Modal, Pressable as RNPressable, Switch, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useUpdateServerTag } from "@/api/hooks";
import type { ServerDetails } from "@/api/types";
import { Button, Icon, ListGroup, Pressable, SectionHeader, TextField, emojify, showToast } from "@/components/ui";
import { EmojiPickerPanel } from "@/features/chat/components/emoji-picker";
import { ServerTagPill } from "@/features/server-tag/server-tag-pill";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/** web lib/server-tag `parseServerTag` ile aynı kural (istemci ipucu; asıl doğrulama uçta). */
function tagLooksValid(tag: string): boolean {
  const length = Array.from(tag).length;
  if (length < 2 || length > 4) return false;
  try {
    return new RegExp("^[\\p{L}\\p{N}]+$", "u").test(tag);
  } catch {
    // Unicode özellik kaçışı desteklenmiyorsa karar uca bırakılır.
    return true;
  }
}

/**
 * Sunucu Ayarları › Sunucu Etiketi (Discord "Server Tag") — web
 * `components/server-settings/server-tag-section.tsx` karşılığı: etiket,
 * emoji rozet, önizleme, "Üyeler etiketi kullanabilsin" anahtarı ve kendi
 * Kaydet düğmesi. Uç "Sunucuyu Yönet" ister.
 */
export function ServerTagSection({ server }: { server: ServerDetails }) {
  const t = useT();
  const update = useUpdateServerTag(server.id);
  const [tag, setTag] = useState(server.tag ?? "");
  const [badge, setBadge] = useState(server.tagBadge ?? "");
  const [enabled, setEnabled] = useState(server.tagEnabled === true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTag(server.tag ?? "");
    setBadge(server.tagBadge ?? "");
    setEnabled(server.tagEnabled === true);
  }, [server.id, server.tag, server.tagBadge, server.tagEnabled]);

  const trimmed = tag.trim();
  const tagInvalid = trimmed.length > 0 && !tagLooksValid(trimmed);
  const dirty =
    trimmed !== (server.tag ?? "") || badge !== (server.tagBadge ?? "") || enabled !== (server.tagEnabled === true);

  const save = () => {
    if (tagInvalid) return showToast(t("serverTag.settings.invalidTag"), "error");
    if (enabled && !trimmed) return showToast(t("serverTag.settings.needTag"), "error");
    update.mutate(
      { tag: trimmed || null, tagBadge: badge || null, tagEnabled: enabled },
      {
        onSuccess: () => showToast(t("serverTag.settings.saved")),
        onError: (error) =>
          showToast(error instanceof ApiError && error.message ? error.message : t("serverTag.settings.saveFailed"), "error"),
      }
    );
  };

  return (
    <>
      <SectionHeader title={t("serverTag.settings.title").toLocaleUpperCase("tr")} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverTag.settings.description")}</Text>
        <TextField
          label={t("serverTag.settings.tagLabel").toLocaleUpperCase("tr")}
          value={tag}
          onChangeText={(value) => setTag(value.replace(/\s/g, ""))}
          placeholder={t("serverTag.settings.tagPlaceholder")}
          autoCorrect={false}
          maxLength={8}
          hint={t("serverTag.settings.tagHint")}
          error={tagInvalid ? t("serverTag.settings.invalidTag") : null}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>
            {t("serverTag.settings.badgeLabel").toLocaleUpperCase("tr")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("serverTag.settings.badgePick")}
              style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.deep }}
            >
              {badge ? (
                <Text style={{ fontSize: 22, lineHeight: 26 }}>{emojify(badge, "server-tag-badge", 24)}</Text>
              ) : (
                <Icon name="emoji" size={20} color={colors.muted} />
              )}
            </Pressable>
            {badge ? (
              <Pressable
                onPress={() => setBadge("")}
                accessibilityRole="button"
                accessibilityLabel={t("serverTag.settings.badgeClear")}
                style={{ padding: spacing.sm }}
              >
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>{t("serverTag.settings.badgeHint")}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>
            {t("serverTag.settings.preview").toLocaleUpperCase("tr")}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.deep }}
          >
            <Text style={{ ...typography.body, ...fw(600), color: colors.bright }}>{t("serverTag.settings.previewName")}</Text>
            {trimmed ? <ServerTagPill guild={{ tag: trimmed, badge: badge || null, serverName: server.name }} /> : null}
          </View>
        </View>

        <ListGroup>
          <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.text }}>{t("serverTag.settings.enabledLabel")}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverTag.settings.enabledDesc")}</Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
        </ListGroup>

        <Button label={t("serverTag.settings.save")} onPress={save} loading={update.isPending} disabled={!dirty} />
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <RNPressable
          onPress={() => setPickerOpen(false)}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
        >
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
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{t("serverTag.settings.badgePick")}</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                style={{ padding: spacing.xs }}
              >
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <EmojiPickerPanel
              onEmoji={(emoji) => {
                setPickerOpen(false);
                setBadge(emoji);
              }}
            />
          </View>
        </RNPressable>
      </Modal>
    </>
  );
}
