import { useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button, Icon, KeyboardAvoider, Pressable, TextField, showToast } from "@/components/ui";
import { formatFileSize } from "@/lib/attachments";
import { useT } from "@/lib/i18n";
import { pickDocuments, uploadMessageAttachment } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { chatScopeFor } from "./chat-scope";
import { SelectField } from "./components/component-select";
import { MessageMarkdown } from "./components/message-markdown";
import {
  fieldError,
  fileTypeAllowed,
  initialValue,
  useInteractionModal,
  VALUE_MAX,
  type ChoiceOption,
  type FieldValue,
  type FileUploadDef,
  type ModalFieldDef,
  type OpenModal,
  type UploadedFile,
} from "./interaction-modal-store";
import { waitForAck } from "./interactions";

/**
 * Bot etkileşim modalı — web `lib/modals` + `components/modals/interaction-modal`.
 *
 * Bot bir komut ya da bileşen etkileşimine callback type 9 ile yanıt
 * verince açılır. İki yoldan gelir: etkileşim isteğinin yanıtı
 * (`status: "MODAL"` + `modal`, HTTP uç noktalı botlar) ve kullanıcı
 * odasına düşen `interaction.modal` olayı (ağ geçidi botları). İkisi de
 * gelirse aynı etkileşim bir kez açılır.
 *
 * Alanlar: metin girişi, seçim menüleri (metin, kullanıcı, rol,
 * bahsedilebilir, kanal), dosya yükleme (seçince Ciklet'e yüklenir), radyo
 * grubu, onay kutusu grubu, onay kutusu; Metin bileşeni markdown çizilir.
 *
 * Gönderim aynı uca: `POST /api/channels/[id]/interactions`
 * `{ modalInteractionId, components: [{ custom_id, value? | values? }],
 * attachments? }`. Sunucu değerleri saklanan tanıma karşı yeniden doğrular;
 * bir modal bir kez gönderilebilir.
 */

/** Kök düzende bir kez. */
export function InteractionModalHost() {
  const current = useInteractionModal((s) => s.current);
  if (!current) return null;
  // Anahtar: yeni etkileşim formu baştan kursun (önceki değerler taşınmasın).
  return <InteractionModalForm key={current.interactionId} open={current} />;
}

function fields(open: OpenModal): { label: string; description?: string; field: ModalFieldDef }[] {
  return open.modal.items.flatMap((item) => (item.kind === "field" ? [item] : []));
}

function InteractionModalForm({ open }: { open: OpenModal }) {
  const t = useT();
  const { modal, channelId, interactionId } = open;
  const scope = chatScopeFor(channelId);
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(fields(open).map((f) => [f.field.custom_id, initialValue(f.field)]))
  );
  // Dosya alanı başına yüklenen dosyalar.
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => useInteractionModal.setState({ current: null });
  const setValue = (id: string, next: FieldValue) => setValues((current) => ({ ...current, [id]: next }));

  const errors: Record<string, string | null> = Object.fromEntries(
    fields(open).map((f) => [
      f.field.custom_id,
      fieldError(f.field, f.label, values[f.field.custom_id] ?? {}, files[f.field.custom_id] ?? []),
    ])
  );
  const hasError = Object.values(errors).some(Boolean);
  const anyUploading = Object.values(uploading).some(Boolean);

  const chooseFiles = async (f: FileUploadDef) => {
    const current = files[f.custom_id] ?? [];
    const room = (f.max_values ?? 1) - current.length;
    if (room <= 0) return;
    const picked = await pickDocuments(room);
    if (picked.length === 0) return;
    const accepted = picked.filter((asset) => fileTypeAllowed(f.file_types, asset.name));
    if (accepted.length < picked.length) showToast(t("messageComponents.fileTypeRejected"), "error");
    if (accepted.length === 0) return;
    setUploading((u) => ({ ...u, [f.custom_id]: true }));
    try {
      const uploaded = await Promise.all(accepted.map((asset) => uploadMessageAttachment(asset)));
      setFiles((prev) => {
        const list = [
          ...(prev[f.custom_id] ?? []),
          ...uploaded.map((file, i) => ({
            key: `${Date.now()}-${i}`,
            url: file.url,
            filename: file.name,
            size: file.size ?? 0,
            ...(file.mimeType ? { content_type: file.mimeType } : {}),
          })),
        ].slice(0, f.max_values ?? 1);
        setValue(f.custom_id, { values: list.map((x) => x.key) });
        return { ...prev, [f.custom_id]: list };
      });
    } catch (reason) {
      showToast(reason instanceof Error && reason.message ? reason.message : t("messageComponents.uploadFailed"), "error");
    } finally {
      setUploading((u) => ({ ...u, [f.custom_id]: false }));
    }
  };

  const removeFile = (fieldId: string, key: string) => {
    setFiles((prev) => {
      const list = (prev[fieldId] ?? []).filter((x) => x.key !== key);
      setValue(fieldId, { values: list.map((x) => x.key) });
      return { ...prev, [fieldId]: list };
    });
  };

  const submit = async () => {
    setTouched(true);
    if (hasError || anyUploading) return;
    // Dosya kimlikleri tüm alanlar boyunca "0", "1", … (web ile aynı).
    const attachments: { id: string; url: string; filename: string; size: number; content_type?: string }[] = [];
    const components = fields(open).map(({ field }) => {
      const v = values[field.custom_id] ?? {};
      switch (field.type) {
        case 4:
          return { custom_id: field.custom_id, value: typeof v.value === "string" ? v.value : "" };
        case 21:
          return { custom_id: field.custom_id, value: typeof v.value === "string" ? v.value : null };
        case 23:
          return { custom_id: field.custom_id, value: v.value === true };
        case 19: {
          const ids = (files[field.custom_id] ?? []).map((file) => {
            const id = String(attachments.length);
            attachments.push({
              id,
              url: file.url,
              filename: file.filename,
              size: file.size,
              ...(file.content_type ? { content_type: file.content_type } : {}),
            });
            return id;
          });
          return { custom_id: field.custom_id, values: ids };
        }
        default:
          return { custom_id: field.custom_id, values: v.values ?? [] };
      }
    });
    setBusy(true);
    try {
      const res = await api<{ id: string }>(endpoints.channelInteractions(channelId), {
        method: "POST",
        body: { modalInteractionId: interactionId, components, ...(attachments.length > 0 ? { attachments } : {}) },
      });
      close();
      void waitForAck(channelId, res.id).then((silent) => {
        if (silent) showToast(t("messageComponents.formNoResponse"));
      });
    } catch (error) {
      showToast(error instanceof ApiError && error.message ? error.message : t("messageComponents.formFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const firstTextId = fields(open).find((f) => f.field.type === 4)?.field.custom_id;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoider style={{ flex: 1, backgroundColor: colors.scrim }}>
        <RNPressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("messageComponents.cancel")}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Animated.View
            entering={SlideInDown.duration(200)}
            onStartShouldSetResponder={() => true}
            accessibilityLabel={t("messageComponents.formLabel")}
            style={{
              maxHeight: "88%",
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
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ ...typography.display, color: colors.bright }}>{modal.title}</Text>
              {modal.items.map((item, index) => {
                if (item.kind === "text") {
                  return <MessageMarkdown key={`t-${index}`} value={item.text.content} color={colors.bright} />;
                }
                const f = item.field;
                const error = touched ? errors[f.custom_id] : null;
                const v = values[f.custom_id] ?? {};
                const autoFocus = f.custom_id === firstTextId;
                if (f.type === 4) {
                  return (
                    <View key={f.custom_id} style={{ gap: 4 }}>
                      <TextField
                        label={`${item.label}${f.required ? " *" : ""}`}
                        hint={item.description}
                        value={typeof v.value === "string" ? v.value : ""}
                        onChangeText={(text) => setValue(f.custom_id, { value: text })}
                        placeholder={f.placeholder}
                        multiline={f.style === 2}
                        maxLength={f.max_length ?? VALUE_MAX}
                        autoFocus={autoFocus}
                        error={error}
                      />
                    </View>
                  );
                }
                if (f.type === 23) {
                  const checked = v.value === true;
                  return (
                    <View key={f.custom_id} style={{ gap: 4 }}>
                      <ChoiceRow
                        label={item.label}
                        description={item.description}
                        selected={checked}
                        shape="square"
                        onPress={() => setValue(f.custom_id, { value: !checked })}
                      />
                      <FieldError error={error} />
                    </View>
                  );
                }
                return (
                  <View key={f.custom_id} style={{ gap: 6 }}>
                    <FieldHeader label={item.label} description={item.description} required={isRequired(f)} />
                    {f.type === 21 || f.type === 22 ? (
                      <ChoiceList
                        options={f.options}
                        multi={f.type === 22}
                        value={v}
                        onChange={(next) => setValue(f.custom_id, next)}
                      />
                    ) : f.type === 19 ? (
                      <FileField
                        field={f}
                        files={files[f.custom_id] ?? []}
                        uploading={Boolean(uploading[f.custom_id])}
                        onPick={() => void chooseFiles(f)}
                        onRemove={(key) => removeFile(f.custom_id, key)}
                      />
                    ) : (
                      <SelectField
                        component={f}
                        scope={scope}
                        values={v.values ?? []}
                        error={error}
                        onCommit={(next) => setValue(f.custom_id, { values: next })}
                      />
                    )}
                    <FieldError error={error} />
                  </View>
                );
              })}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <Button label={t("messageComponents.cancel")} variant="ghost" onPress={close} />
                <Button
                  label={t("messageComponents.submit")}
                  loading={busy}
                  disabled={anyUploading || (touched && hasError)}
                  onPress={() => void submit()}
                />
              </View>
            </ScrollView>
          </Animated.View>
        </RNPressable>
      </KeyboardAvoider>
    </Modal>
  );
}

function isRequired(f: ModalFieldDef): boolean {
  if (f.type === 23) return false;
  return f.required !== false;
}

function FieldHeader({ label, description, required }: { label: string; description?: string; required: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>
        {label.toLocaleUpperCase("tr-TR")}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
    </View>
  );
}

function FieldError({ error }: { error: string | null | undefined }) {
  return error ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.danger }}>{error}</Text> : null;
}

function ChoiceList({
  options,
  multi,
  value,
  onChange,
}: {
  options: ChoiceOption[];
  multi: boolean;
  value: FieldValue;
  onChange: (next: FieldValue) => void;
}) {
  const selected = multi ? value.values ?? [] : typeof value.value === "string" ? [value.value] : [];
  return (
    <View style={{ gap: 2 }}>
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <ChoiceRow
            key={option.value}
            label={option.label}
            description={option.description}
            selected={on}
            shape={multi ? "square" : "circle"}
            onPress={() =>
              multi
                ? onChange({ values: on ? selected.filter((x) => x !== option.value) : [...selected, option.value] })
                : onChange({ value: option.value })
            }
          />
        );
      })}
    </View>
  );
}

function ChoiceRow({
  label,
  description,
  selected,
  shape,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  shape: "square" | "circle";
  onPress: () => void;
}) {
  return (
    <Pressable
      noHitSlop
      onPress={onPress}
      accessibilityRole={shape === "circle" ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 44,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: shape === "circle" ? 10 : 5,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected && shape === "square" ? colors.brand : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          shape === "square" ? (
            <Icon name="check" size={13} color={colors.onBrand} />
          ) : (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />
          )
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.body, ...fw(600), color: colors.bright }}>{label}</Text>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

function FileField({
  field,
  files,
  uploading,
  onPick,
  onRemove,
}: {
  field: FileUploadDef;
  files: UploadedFile[];
  uploading: boolean;
  onPick: () => void;
  onRemove: (key: string) => void;
}) {
  const t = useT();
  const max = field.max_values ?? 1;
  const full = files.length >= max;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={onPick}
        disabled={uploading || full}
        accessibilityRole="button"
        accessibilityLabel={t("messageComponents.uploadFile")}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minHeight: 64,
          padding: spacing.md,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: colors.border,
          backgroundColor: pressed ? colors.raised : "transparent",
          opacity: full ? 0.5 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="attachment" size={16} color={colors.brand} />}
          <Text style={{ ...typography.bodyStrong, color: colors.brand }}>
            {uploading ? t("messageComponents.uploading") : t("messageComponents.uploadFile")}
          </Text>
        </View>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("messageComponents.fileLimit", { max })}</Text>
        {field.file_types?.length ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {t("messageComponents.allowedTypes", { types: field.file_types.join(", ") })}
          </Text>
        ) : null}
      </Pressable>
      {files.map((file) => (
        <View
          key={file.key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            backgroundColor: colors.deep,
          }}
        >
          <Icon name="file" size={18} color={colors.brand} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ ...typography.caption, ...fw(600), color: colors.bright }}>
              {file.filename}
            </Text>
            <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>{formatFileSize(file.size)}</Text>
          </View>
          <Pressable onPress={() => onRemove(file.key)} accessibilityRole="button" accessibilityLabel={t("messageComponents.removeFile")}>
            <Text style={{ ...typography.caption, ...fw(600), color: colors.danger }}>{t("messageComponents.removeFile")}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
