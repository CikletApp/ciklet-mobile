import { useMemo, useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api/client";
import { Avatar, Button, Icon, Pressable } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Mesaj aramasının süzgeçleri — web `components/chat/search/
 * direct-search-filters-modal.tsx` + `hooks/use-direct-search.ts` +
 * `lib/message-search.ts` karşılığı. DM ve sunucu aramasında ortak:
 * Tarafından (`from`), Şunu içeren (`has`), Bahsedilmeler (`mentions`),
 * Tarih (`after` / `before`, gün sınırı kullanıcının saat diliminde) ve
 * sıralama (En yeni / En eski). Metinler web ile aynı.
 */

export type SearchHasKind = "image" | "video" | "link" | "file" | "embed";
export const SEARCH_HAS_KINDS: readonly SearchHasKind[] = ["image", "video", "link", "file", "embed"];
export const SEARCH_HAS_LABELS: Record<SearchHasKind, string> = {
  image: "görsel",
  video: "video",
  link: "bağlantı",
  file: "dosya",
  embed: "gömülü",
};

export type SearchOrder = "newest" | "oldest";

export interface SearchParticipant {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

export interface SearchFilters {
  from: SearchParticipant[];
  mentions: SearchParticipant[];
  has: SearchHasKind[];
  /** YYYY-MM-DD; dâhil. */
  after: string;
  /** YYYY-MM-DD; dâhil. */
  before: string;
}

export const EMPTY_FILTERS: SearchFilters = { from: [], mentions: [], has: [], after: "", before: "" };

export function activeFilterCount(filters: SearchFilters): number {
  return (
    filters.from.length +
    filters.mentions.length +
    filters.has.length +
    (filters.after ? 1 : 0) +
    (filters.before ? 1 : 0)
  );
}

/** YYYY-MM-DD → o günün YEREL başlangıcı (+ gün kaydırması). */
function localDayStart(day: string, plusDays = 0): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + plusDays);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isValidDay(day: string): boolean {
  return !day.trim() || localDayStart(day) !== null;
}

/**
 * Süzgeci uç adresine eklenecek sorgu parçasına çevirir (`&from=…&has=…`).
 * "Bitiş" dâhil bir gün olduğu için ertesi günün başlangıcı HARİÇ üst sınır
 * olarak gider (web `searchCriteriaParams` ile aynı).
 */
export function filterQuery(filters: SearchFilters, order: SearchOrder): string {
  const parts: string[] = [];
  const add = (key: string, value: string) => parts.push(`${key}=${encodeURIComponent(value)}`);
  for (const p of filters.from) add("from", p.id);
  for (const p of filters.mentions) add("mentions", p.id);
  for (const kind of filters.has) add("has", kind);
  const after = filters.after ? localDayStart(filters.after) : null;
  const before = filters.before ? localDayStart(filters.before, 1) : null;
  if (after) add("after", after.toISOString());
  if (before) add("before", before.toISOString());
  add("order", order);
  return parts.join("&");
}

/** Uç adresine sorgu parçasını ekler. */
export function withFilters(url: string, filters: SearchFilters, order: SearchOrder): string {
  const extra = filterQuery(filters, order);
  return extra ? `${url}${url.includes("?") ? "&" : "?"}${extra}` : url;
}

/** Ölçütün sorgu anahtarı (önbellek). */
export function filtersKey(filters: SearchFilters, order: SearchOrder): string {
  return JSON.stringify([
    filters.from.map((p) => p.id).sort(),
    filters.mentions.map((p) => p.id).sort(),
    [...filters.has].sort(),
    filters.after,
    filters.before,
    order,
  ]);
}

/** Arama kutusunun altındaki şerit: Filtreler düğmesi + En yeni / En eski. */
export function SearchFilterBar({
  filters,
  order,
  onOpenFilters,
  onOrderChange,
  onClear,
}: {
  filters: SearchFilters;
  order: SearchOrder;
  onOpenFilters: () => void;
  onOrderChange: (order: SearchOrder) => void;
  onClear: () => void;
}) {
  const count = activeFilterCount(filters);
  const chip = (label: string, active: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(600), color: active ? colors.brand : colors.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      {chip(count > 0 ? `Filtreler (${count})` : "Filtreler", count > 0, onOpenFilters, "filters")}
      {count > 0 ? chip("Temizle", false, onClear, "clear") : null}
      <View style={{ flex: 1 }} />
      {chip("En yeni", order === "newest", () => onOrderChange("newest"), "newest")}
      {chip("En eski", order === "oldest", () => onOrderChange("oldest"), "oldest")}
    </View>
  );
}

/** Kişi sağlayıcı: DM'de sabit liste, sunucuda üye araması. */
export type ParticipantSource =
  | { kind: "fixed"; participants: SearchParticipant[] }
  | { kind: "server"; serverId: string };

interface MemberRow {
  nickname?: string | null;
  serverImageUrl?: string | null;
  profile: { id: string; username: string; name: string | null; imageUrl: string | null };
}

function useParticipants(source: ParticipantSource, query: string): SearchParticipant[] {
  const needle = query.trim().toLocaleLowerCase("tr");
  const serverId = source.kind === "server" ? source.serverId : undefined;
  const remote = useQuery({
    queryKey: ["search-members", serverId ?? "", needle],
    enabled: Boolean(serverId),
    staleTime: 60_000,
    queryFn: async () => {
      const qs = `serverId=${encodeURIComponent(serverId!)}&limit=20${needle ? `&q=${encodeURIComponent(needle)}` : ""}`;
      const data = await api<{ items?: MemberRow[] } | MemberRow[]>(`/api/members?${qs}`);
      const rows = Array.isArray(data) ? data : (data?.items ?? []);
      return rows.slice(0, 20).map(
        (m): SearchParticipant => ({
          id: m.profile.id,
          username: m.profile.username,
          name: m.nickname || m.profile.name,
          imageUrl: m.serverImageUrl || m.profile.imageUrl,
        })
      );
    },
  });
  return useMemo(() => {
    if (source.kind === "server") return remote.data ?? [];
    if (!needle) return source.participants;
    return source.participants.filter(
      (p) =>
        p.username.toLocaleLowerCase("tr").includes(needle) ||
        (p.name ?? "").toLocaleLowerCase("tr").includes(needle)
    );
  }, [source, needle, remote.data]);
}

/** "Filtreler" sayfası — web Filtreler penceresinin dört bölümü. */
export function SearchFiltersSheet({
  visible,
  value,
  source,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: SearchFilters;
  source: ParticipantSource;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilters>(value);
  // Her açılışta uygulanmış ölçütten başla (render sırasında, efekt turu olmadan).
  const [openedWith, setOpenedWith] = useState<SearchFilters | null>(null);
  if (visible && openedWith !== value) {
    setOpenedWith(value);
    setDraft(value);
  }
  if (!visible && openedWith !== null) setOpenedWith(null);

  const datesValid = isValidDay(draft.after) && isValidDay(draft.before);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <RNPressable
          onPress={() => undefined}
          accessible={false}
          style={{
            margin: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            maxHeight: "88%",
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ ...typography.body, ...fw(700), color: colors.bright, flex: 1 }}>Filtreler</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg }}
          >
            <Section title="Tarafından" description="Seçilen kullanıcılardan herhangi biri tarafından gönderildi">
              <PeoplePicker
                source={source}
                selected={draft.from}
                onChange={(from) => setDraft((d) => ({ ...d, from }))}
              />
            </Section>
            <Section title="Şunu içeren" description="Seçilen veri türlerinden herhangi birini içerir">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {SEARCH_HAS_KINDS.map((kind) => {
                  const on = draft.has.includes(kind);
                  return (
                    <Pressable
                      key={kind}
                      onPress={() =>
                        setDraft((d) => ({ ...d, has: on ? d.has.filter((k) => k !== kind) : [...d.has, kind] }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 6,
                        borderRadius: radii.full,
                        borderWidth: 1,
                        borderColor: on ? colors.brand : colors.border,
                        backgroundColor: on ? colors.brandSoft : colors.panel,
                      }}
                    >
                      <Text style={{ ...typography.caption, ...fw(600), color: on ? colors.brand : colors.text }}>
                        {SEARCH_HAS_LABELS[kind]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>
            <Section title="Bahsedilmeler" description="Seçilen kullanıcılardan herhangi birinden bahseder">
              <PeoplePicker
                source={source}
                selected={draft.mentions}
                onChange={(mentions) => setDraft((d) => ({ ...d, mentions }))}
              />
            </Section>
            <Section title="Tarih" description="Mesajın gönderildiği gün aralığı; iki uç da dâhil">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <DayField label="Başlangıç" value={draft.after} onChange={(after) => setDraft((d) => ({ ...d, after }))} />
                <DayField label="Bitiş" value={draft.before} onChange={(before) => setDraft((d) => ({ ...d, before }))} />
              </View>
              {!datesValid ? (
                <Text style={{ ...typography.caption, color: colors.danger }}>Tarihi YYYY-AA-GG biçiminde yaz.</Text>
              ) : null}
            </Section>
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              justifyContent: "flex-end",
              padding: spacing.lg,
              paddingTop: spacing.sm,
            }}
          >
            <Button label="Temizle" variant="ghost" onPress={() => setDraft(EMPTY_FILTERS)} />
            <Button
              label="Uygula"
              disabled={!datesValid}
              onPress={() => {
                onApply({ ...draft, after: draft.after.trim(), before: draft.before.trim() });
                onClose();
              }}
            />
          </View>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{title}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

function DayField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^\d-]/g, "").slice(0, 10))}
        placeholder="YYYY-AA-GG"
        placeholderTextColor={colors.muted}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        accessibilityLabel={label}
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.deep,
          color: colors.text,
          ...typography.body,
        }}
      />
    </View>
  );
}

function PeoplePicker({
  source,
  selected,
  onChange,
}: {
  source: ParticipantSource;
  selected: SearchParticipant[];
  onChange: (next: SearchParticipant[]) => void;
}) {
  const [query, setQuery] = useState("");
  const people = useParticipants(source, query);
  const selectedIds = new Set(selected.map((p) => p.id));
  // Seçilenler her zaman görünür; aramada çıkmasa da kaldırılabilsin.
  const rows = [...selected, ...people.filter((p) => !selectedIds.has(p.id))];
  const showSearch = source.kind === "server" || source.participants.length > 6;

  if (rows.length === 0 && !showSearch) {
    return <Text style={{ ...typography.caption, color: colors.muted }}>Bu sohbette seçilecek kimse yok.</Text>;
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {showSearch ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kullanıcı ara"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.deep,
            color: colors.text,
            ...typography.body,
          }}
        />
      ) : null}
      {rows.slice(0, 12).map((person) => {
        const on = selectedIds.has(person.id);
        return (
          <Pressable
            key={person.id}
            onPress={() => onChange(on ? selected.filter((p) => p.id !== person.id) : [...selected, person])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={person.name || person.username}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: radii.md,
              backgroundColor: on ? colors.brandSoft : pressed ? colors.raised : "transparent",
            })}
          >
            <Avatar profileId={person.id} imageUrl={person.imageUrl} fallbackText={person.username} size={28} decorationId={null} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.text }} numberOfLines={1}>
                {person.name || person.username}
              </Text>
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                @{person.username}
              </Text>
            </View>
            {on ? <Icon name="check" size={16} color={colors.brand} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
