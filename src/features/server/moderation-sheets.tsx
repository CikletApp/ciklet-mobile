import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import {
  AUDIT_REASON_MAX,
  BAN_DURATIONS,
  BAN_PURGE_OPTIONS,
  BAN_REASON_MAX,
  PRUNE_DAY_OPTIONS,
  usePrunePreview,
  usePruneMembers,
  type BanInput,
  type PruneDays,
} from "@/api/hooks";
import { Button, KeyboardAvoider, SegmentedTabs, TextField, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Moderasyon sayfaları — web `ban-dialog`, üye temizleme ve toplu silme
 * diyaloglarının mobil karşılığı. Metinler web'le BİREBİR aynı.
 *
 * Her sayfa açıldığında gövdesi yeniden kurulur (durum sıfırlanır). Hata
 * sayfanın içinde gösterilir: Modal ayrı bir pencere, kökteki bildirim
 * şeridi onun altında kalırdı. Başarıda sayfa kapanır, sonuç şeritte.
 */

const sheetLabel = (text: string) => text.toLocaleUpperCase("tr");

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

/** Alttan açılan form sayfası: başlık, açıklama, alanlar ve İptal / onay. */
function ModerationSheet({
  title,
  description,
  children,
  confirmLabel,
  confirmDisabled,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const close = () => {
    if (!pending) onClose();
  };
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoider style={{ backgroundColor: "transparent" }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <RNPressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              maxHeight: "88%",
              paddingTop: spacing.md,
              paddingBottom: spacing["2xl"],
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.bento,
            }}
          >
            <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md }} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg }}>
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}>
                <Text style={{ ...typography.title, color: colors.bright }}>{title}</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
              </View>
              {children}
              {error ? (
                <Text style={{ ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg }}>{error}</Text>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                <Button label="İptal" variant="ghost" disabled={pending} onPress={close} />
                <Button
                  label={confirmLabel}
                  variant="danger"
                  loading={pending}
                  disabled={confirmDisabled}
                  onPress={onConfirm}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

/** Başlıklı seçenek şeridi (web Select karşılığı). */
function ChoiceField<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.overline, color: colors.muted, paddingHorizontal: spacing.lg }}>{sheetLabel(label)}</Text>
      <SegmentedTabs variant="pill" items={items} value={value} onChange={onChange} />
    </View>
  );
}

function ReasonField({ value, onChange, placeholder, maxLength }: { value: string; onChange: (text: string) => void; placeholder: string; maxLength: number }) {
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <TextField
        label={sheetLabel("Sebep (isteğe bağlı)")}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </View>
  );
}

// ── Yasaklama (tek ve toplu) ────────────────────────────────────────

/**
 * Yasak sayfası — web `BanDialog`. `title` tek üyede "{ad} yasaklansın mı?",
 * toplu yasakta "{n} üye yasaklansın mı?". Gönderim çağıranda: tek ve toplu
 * uç farklı sonuç döndürür.
 */
export function BanSheet({
  visible,
  title,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Başarıda çözülür; hata fırlatırsa sayfa açık kalır ve hata gösterilir. */
  onSubmit: (input: BanInput, duration: (typeof BAN_DURATIONS)[number]) => Promise<void>;
}) {
  if (!visible) return null;
  return <BanSheetBody title={title} onClose={onClose} onSubmit={onSubmit} />;
}

function BanSheetBody({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (input: BanInput, duration: (typeof BAN_DURATIONS)[number]) => Promise<void>;
}) {
  const [durationId, setDurationId] = useState("forever");
  const [purgeId, setPurgeId] = useState("none");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const duration = BAN_DURATIONS.find((d) => d.id === durationId) ?? BAN_DURATIONS[BAN_DURATIONS.length - 1];
    const purge = BAN_PURGE_OPTIONS.find((p) => p.id === purgeId) ?? BAN_PURGE_OPTIONS[0];
    setPending(true);
    setError(null);
    try {
      await onSubmit({ reason: reason.trim() || undefined, durationSeconds: duration.seconds, purgeHours: purge.hours }, duration);
      onClose();
    } catch (reasonError) {
      setError(errorText(reasonError, "Üye yasaklanamadı."));
    } finally {
      setPending(false);
    }
  };

  return (
    <ModerationSheet
      title={title}
      description="Sunucudan çıkarılır ve yasak sürerken geri katılamaz. Süreli yasak bitince kendiliğinden kalkar."
      confirmLabel="Yasakla"
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <ChoiceField label="Süre" items={BAN_DURATIONS.map((d) => ({ id: d.id, label: d.label }))} value={durationId} onChange={setDurationId} />
      <ChoiceField label="Mesaj geçmişini sil" items={BAN_PURGE_OPTIONS.map((p) => ({ id: p.id, label: p.label }))} value={purgeId} onChange={setPurgeId} />
      <ReasonField value={reason} onChange={setReason} placeholder="Denetim günlüğünde ve yasak listesinde görünür" maxLength={BAN_REASON_MAX} />
    </ModerationSheet>
  );
}

// ── Üyeleri temizle ─────────────────────────────────────────────────

/**
 * Rolsüz ve seçilen süre boyunca görülmeyen üyeleri çıkarır (web üye
 * temizleme diyaloğu). Sayı her süre değişiminde sunucudan önizlenir.
 */
export function PruneSheet({ serverId, visible, onClose }: { serverId: string; visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return <PruneSheetBody serverId={serverId} onClose={onClose} />;
}

function PruneSheetBody({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const [days, setDays] = useState<PruneDays>(7);
  const [reason, setReason] = useState("");
  const preview = usePrunePreview(serverId, days, true);
  const prune = usePruneMembers(serverId);
  const count = preview.data?.count ?? null;

  const previewText = preview.isFetching && count === null
    ? "Hesaplanıyor…"
    : preview.error
      ? "Önizleme yüklenemedi."
      : count === null
        ? "Hesaplanıyor…"
        : count === 0
          ? "Bu ölçüte uyan üye yok."
          : `${count} üye çıkarılacak.`;

  const submit = () =>
    prune.mutate(
      { days, reason },
      {
        onSuccess: (result) => {
          showToast(`${result.pruned} üye temizlendi.`);
          onClose();
        },
      }
    );

  return (
    <ModerationSheet
      title="Üyeleri Temizle"
      description="Rolü olmayan ve seçilen süre boyunca görülmeyen üyeler sunucudan çıkarılır. Davetle yeniden katılabilirler."
      confirmLabel="Temizle"
      confirmDisabled={!count || preview.isFetching}
      pending={prune.isPending}
      error={prune.error ? errorText(prune.error, "Üyeler temizlenemedi.") : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <ChoiceField
        label="Son görülme"
        items={PRUNE_DAY_OPTIONS.map((d) => ({ id: String(d), label: `${d} gün` }))}
        value={String(days)}
        onChange={(id) => setDays(Number(id) as PruneDays)}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        {preview.isFetching ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        <Text style={{ ...typography.bodyStrong, color: count ? colors.danger : colors.text }}>{previewText}</Text>
      </View>
      <ReasonField value={reason} onChange={setReason} placeholder="Denetim kaydında görünür" maxLength={AUDIT_REASON_MAX} />
    </ModerationSheet>
  );
}

// ── Toplu mesaj silme onayı ─────────────────────────────────────────

/** "{n} mesaj silinsin mi?" — sebep alanlı onay (web toplu silme diyaloğu). */
export function BulkDeleteSheet({
  count,
  visible,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  count: number;
  visible: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  if (!visible) return null;
  return <BulkDeleteBody count={count} pending={pending} error={error} onClose={onClose} onConfirm={onConfirm} />;
}

function BulkDeleteBody({
  count,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  count: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ModerationSheet
      title={`${count} mesaj silinsin mi?`}
      description="Seçilen mesajlar herkes için silinir. Bu işlem geri alınamaz."
      confirmLabel="Sil"
      confirmDisabled={count === 0}
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={() => onConfirm(count > 1 ? reason : "")}
    >
      {/* Tek mesaj tekil silme ucuna gider; o uç sebep almıyor. */}
      {count > 1 ? (
        <ReasonField value={reason} onChange={setReason} placeholder="Denetim kaydında görünür" maxLength={AUDIT_REASON_MAX} />
      ) : null}
    </ModerationSheet>
  );
}
