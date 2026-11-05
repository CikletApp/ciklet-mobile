import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import {
  useCheckout,
  useClaimStoreItem,
  useCurrentProfile,
  useStoreCatalog,
  useUpdateProfile,
  type CheckoutRequest,
} from "@/api/hooks";
import type { StoreCatalogResponse, StoreItemKind, UpdateProfileInput } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  Screen,
  ScreenLoader,
  SegmentedTabs,
  TextField,
  showToast,
} from "@/components/ui";
import { CosmeticBackdrop } from "@/components/cosmetics/cosmetic-backdrop";
import { NameplateBackground } from "@/features/profile/nameplate";
import { ProfileEffectOverlay } from "@/features/profile/profile-effect";
import { displayNameOf } from "@/lib/format";
import { STORE_KIND_LABEL, formatPriceTry } from "@/lib/profile-extras";
import { PURCHASES_ENABLED, STORE_TITLE } from "@/lib/purchases";
import { formatCountdown, groupByCollection, hasMobileRenderer } from "@/lib/store-display";
import {
  EMPTY_STORE_FILTERS,
  STORE_SORTS,
  STORE_THEMES,
  activeFilterCount,
  filterStoreItems,
  hasActiveFilters,
  sortStoreItems,
  type StoreFilters,
  type StoreSort,
} from "@/lib/store-browse";
import { useNow } from "@/lib/use-now";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { useBuyWithPoints } from "@/api/hooks/use-account-privacy";
import { INTL_LOCALES, useLocale, useT, type MessageKey } from "@/lib/i18n";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Mağaza (web `/magaza`) — avatar süsleri, isim plakaları, profil efektleri.
 *
 * Katalog, önizleme ve sahip olunan ürünü TAKMA uygulama içinde. Satın alma
 * ve hediye ise ödeme kaydı açılıp web ödeme sayfasına sistem tarayıcısıyla
 * gidilerek yapılır (bkz. `use-store.ts`: mağaza içi dijital ürün satışı
 * App Store / Play kurallarına takılır). iOS'ta satın alma yüzeyi hiç yok:
 * ekran yalnızca sahip olunan ürünleri takıp çıkarmak için (lib/purchases).
 *
 * Ücretsiz mağaza modunda (`data.free`, web STORE_FREE_MODE) para akışı
 * olmadığından tüm platformlarda bütün ürünler listelenir ve "Ücretsiz al"
 * `POST /api/store/claim` çağırır; hediye gizli.
 *
 * Katalog veritabanından (web root → Mağaza Yönetimi): öne çıkan ürünler
 * üstte, kalanı koleksiyon başlıklarıyla (root'un sırası); süreli ürün
 * "Sınırlı süre" + geri sayım, kampanya üstü çizili fiyat + "-%X" + geri
 * sayım, "Mentol'e dahil" ürünü Mentol üyesi ücretsiz alır (`item.free`).
 * Çizimi bu sürümde olmayan ürün listelenmez (lib/store-display).
 */
type Item = StoreCatalogResponse["items"][number] & { kind: StoreItemKind };

const KIND_FIELD: Record<StoreItemKind, keyof UpdateProfileInput> = {
  decoration: "avatarDecorationId",
  nameplate: "nameplateId",
  effect: "profileEffectId",
};

export default function StoreScreen() {
  const catalog = useStoreCatalog();
  const { data: profile } = useCurrentProfile();
  const [kind, setKind] = useState<StoreItemKind>("decoration");
  // Arama + filtre + sıralama (web store-view / store-filters).
  const [filters, setFilters] = useState<StoreFilters>(EMPTY_STORE_FILTERS);
  const [sort, setSort] = useState<StoreSort | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const t = useT();
  const locale = useLocale();

  if (catalog.isLoading) return <ScreenLoader />;
  if (!catalog.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: STORE_TITLE }} />
        <EmptyState icon="sparkles" title={`${STORE_TITLE} açılamadı`} description="Bağlantını kontrol edip tekrar dene." />
      </Screen>
    );
  }

  const data = catalog.data;
  const free = Boolean(data.free);
  // Ciklet puanı (görevlerden; gerçek para değeri yok) — web katalog yanıtındaki `points`.
  const points = (data as { points?: number }).points ?? 0;
  const items = data.items.filter(
    (item): item is Item =>
      item.kind === kind &&
      hasMobileRenderer(item.kind, item.id) &&
      (PURCHASES_ENABLED || free || item.owned || Boolean(item.free) || typeof item.pointsPrice === "number")
  );
  const collectionName = (id: string | null | undefined) => data.collections?.find((c) => c.id === id)?.name ?? "";
  const kindThemes = STORE_THEMES.filter((theme) => items.some((item) => item.themes?.includes(theme)));
  const kindCollections = (data.collections ?? []).filter((c) => items.some((item) => item.collection === c.id));
  const filtering = hasActiveFilters(filters) || sort !== null;
  const filterCount = activeFilterCount(filters);
  const results = filtering ? sortStoreItems(filterStoreItems(items, filters, (i) => collectionName(i.collection)), sort, locale) : [];
  // Öne çıkanlar üstte (sahip olunmayanlar), kalanı koleksiyonlara göre.
  const picks = filtering ? [] : items.filter((item) => item.featured && !item.owned);
  const groups = filtering
    ? [{ id: "__results", title: t("parityScreens.store.browse.results", { count: results.length }), items: results }]
    : groupByCollection(
        items.filter((item) => !picks.includes(item)),
        data.collections
      );
  const toggleTheme = (theme: string) =>
    setFilters((f) => ({ ...f, themes: f.themes.includes(theme) ? f.themes.filter((x) => x !== theme) : [...f.themes, theme] }));

  return (
    <Screen>
      <Stack.Screen options={{ title: free ? "Mağaza" : STORE_TITLE }} />
      <SegmentedTabs
        variant="pill"
        value={kind}
        onChange={(next) => {
          setKind(next);
          // Tema / koleksiyon türe göre değişir; arama ve sıralama kalır.
          setFilters((f) => ({ ...f, themes: [], collection: null }));
        }}
        items={(Object.keys(STORE_KIND_LABEL) as StoreItemKind[]).map((id) => ({ id, label: STORE_KIND_LABEL[id] }))}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View
          style={{
            flex: 1,
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.full,
            backgroundColor: colors.panel,
          }}
        >
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput
            value={filters.query}
            onChangeText={(query) => setFilters((f) => ({ ...f, query }))}
            placeholder={t("parityScreens.store.search")}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t("parityScreens.store.search")}
            autoCorrect={false}
            returnKeyType="search"
            style={{ ...typography.body, flex: 1, color: colors.bright, paddingVertical: 6 }}
          />
          {filters.query ? (
            <Pressable onPress={() => setFilters((f) => ({ ...f, query: "" }))} accessibilityRole="button" hitSlop={8}>
              <Icon name="close" size={15} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setPanelOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: panelOpen }}
          style={{
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: spacing.md,
            borderRadius: radii.full,
            backgroundColor: filterCount > 0 || sort ? colors.brandSoft : colors.panel,
          }}
        >
          <Icon name="list" size={16} color={filterCount > 0 || sort ? colors.brand : colors.text} />
          <Text style={{ ...typography.caption, ...fw(700), color: filterCount > 0 || sort ? colors.brand : colors.text }}>
            {panelOpen ? t("parityScreens.store.filters.hide") : t("parityScreens.store.filters.show")}
            {filterCount > 0 ? ` (${filterCount})` : ""}
          </Text>
        </Pressable>
      </View>
      {panelOpen ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
          <FilterLabel title={t("parityScreens.store.filters.mine")} />
          <FilterChips>
            <FilterChip
              label={t("parityScreens.store.filters.owned")}
              active={filters.ownedOnly}
              onPress={() => setFilters((f) => ({ ...f, ownedOnly: !f.ownedOnly }))}
            />
          </FilterChips>
          {kindThemes.length > 0 ? (
            <>
              <FilterLabel title={t("parityScreens.store.filters.themes")} />
              <FilterChips>
                {kindThemes.map((theme) => (
                  <FilterChip
                    key={theme}
                    label={t(`parityScreens.store.themes.${theme}` as MessageKey)}
                    active={filters.themes.includes(theme)}
                    onPress={() => toggleTheme(theme)}
                  />
                ))}
              </FilterChips>
            </>
          ) : null}
          {kindCollections.length > 0 ? (
            <>
              <FilterLabel title={t("parityScreens.store.filters.collection")} />
              <FilterChips>
                {kindCollections.map((c) => (
                  <FilterChip
                    key={c.id}
                    label={c.name}
                    active={filters.collection === c.id}
                    onPress={() => setFilters((f) => ({ ...f, collection: f.collection === c.id ? null : c.id }))}
                  />
                ))}
              </FilterChips>
            </>
          ) : null}
          <FilterLabel title={t("parityScreens.store.sort.label")} />
          <FilterChips>
            {STORE_SORTS.map((option) => (
              <FilterChip
                key={option}
                label={t(`parityScreens.store.sort.${option}` as MessageKey)}
                active={sort === option}
                onPress={() => setSort((current) => (current === option ? null : option))}
              />
            ))}
          </FilterChips>
          {filterCount > 0 || sort ? (
            <Pressable
              onPress={() => {
                setFilters((f) => ({ ...EMPTY_STORE_FILTERS, query: f.query }));
                setSort(null);
              }}
              accessibilityRole="button"
              style={{ alignSelf: "flex-start", paddingVertical: 4 }}
            >
              <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>{t("parityScreens.store.filters.clearAll")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.push("/quests")}
          accessibilityRole="link"
          accessibilityLabel={t("quests.store.earn")}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radii.full,
            backgroundColor: colors.brand,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="flag" size={14} color={colors.onBrand} />
          <Text style={{ ...typography.caption, ...fw(700), color: colors.onBrand }}>
            {points.toLocaleString(INTL_LOCALES[locale])} {t("quests.unit")}
          </Text>
        </Pressable>
        {free ? (
          <View style={{ gap: 2, padding: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.brandSoft }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>🎉 Mağaza şimdilik ücretsiz!</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Beğendiğin her ürünü hiçbir ücret ödemeden al; aldıkların kalıcı olarak senin.
            </Text>
          </View>
        ) : PURCHASES_ENABLED ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {data.mentol
              ? `Mentol üyesisin: tüm ürünlerde %${data.discountPercent} indirim.`
              : `Mentol üyelerine %${data.discountPercent} indirim.`}{" "}
            Ödeme web ödeme sayfasında, tarayıcıda tamamlanır.
          </Text>
        ) : null}
        {filtering && results.length === 0 ? (
          <EmptyState icon="search" title={t("parityScreens.store.browse.empty")} />
        ) : !filtering && items.length === 0 && !free && !PURCHASES_ENABLED ? (
          <EmptyState
            icon="sparkles"
            title="Bu türde ürünün yok"
            description="Sahip olduğun ürünler burada görünür; takıp çıkarabilirsin."
          />
        ) : null}
        {[...(picks.length ? [{ id: "__picks", title: "Öne çıkan ürünler", items: picks }] : []), ...groups.filter((g) => g.items.length > 0)].map((group) => (
          <View key={group.id ?? "__rest"} style={{ gap: spacing.md }}>
            {group.title && (picks.length > 0 || groups.length > 1 || group.id === "__picks" || group.id === "__results") ? (
              <Text style={{ ...typography.title, color: colors.bright, marginTop: spacing.sm }}>{group.title}</Text>
            ) : null}
            {group.items.map((item) => (
              <StoreCard
                key={item.id}
                item={item}
                equipped={data.equipped[item.kind] === item.id}
                purchasable={data.purchasable}
                points={points}
                profile={profile ? { id: profile.id, imageUrl: profile.imageUrl, username: profile.username, title: displayNameOf(profile) } : null}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function StoreCard({
  item,
  equipped,
  purchasable,
  points,
  profile,
}: {
  item: Item;
  equipped: boolean;
  purchasable: boolean;
  points: number;
  profile: { id: string; imageUrl: string | null; username: string; title: string } | null;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateProfile();
  const checkout = useCheckout();
  const claim = useClaimStoreItem();
  const buyPoints = useBuyWithPoints();
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const pointsPrice = typeof item.pointsPrice === "number" ? item.pointsPrice : null;
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const free = Boolean(item.free);
  // Ücretli akış (fiyat, satın al, hediye) yalnızca ödeme açık platformda,
  // ücretsiz alım yokken ve ürün parayla satılıyorsa.
  const moneyless = item.priceAvailable === false;
  const paid = PURCHASES_ENABLED && !free && !moneyless && item.forSale !== false;
  const discounted = item.finalPrice < item.price;

  const toggleEquip = () => {
    update.mutate(
      { [KIND_FIELD[item.kind]]: equipped ? null : item.id },
      {
        onSuccess: () => {
          showToast(equipped ? "Çıkarıldı." : `${item.name} takıldı.`);
          // "Takılı" bilgisi katalog yanıtında; profil kartı da efekti/plakayı taşıyor.
          void queryClient.invalidateQueries({ queryKey: qk.store });
          void queryClient.invalidateQueries({ queryKey: ["profile-card"] });
        },
        onError: (error) => showToast(userErrorMessage(error, "Değiştirilemedi."), "error"),
      }
    );
  };

  const claimFree = () =>
    claim.mutate(item.id, {
      onSuccess: () => showToast(`${item.name} artık senin!`),
      onError: (error) => showToast(userErrorMessage(error, "Ürün alınamadı."), "error"),
    });

  const buy = (request: CheckoutRequest) =>
    checkout.mutate(request, {
      onSuccess: () => {
        setGiftOpen(false);
        setGiftTo("");
      },
      onError: (error) => showToast(userErrorMessage(error, "Ödeme başlatılamadı."), "error"),
    });

  return (
    <View style={{ borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, overflow: "hidden" }}>
      <Preview item={item} profile={profile} />
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Text style={{ ...typography.title, color: colors.bright, flex: 1 }} numberOfLines={1}>
            {item.name}
          </Text>
          {item.owned ? (
            <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>SENDE</Text>
          ) : free ? (
            <Text style={{ ...typography.bodyStrong, color: colors.brand }}>
              {/* iOS'ta fiyat hiç gösterilmez (lib/purchases). */}
              {PURCHASES_ENABLED ? (
                <Text style={{ ...typography.caption, color: colors.muted, textDecorationLine: "line-through" }}>
                  {formatPriceTry(item.price)}{" "}
                </Text>
              ) : null}
              Ücretsiz
            </Text>
          ) : !PURCHASES_ENABLED ? null : moneyless ? (
            <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>Yalnızca Ciklet ile</Text>
          ) : (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
              {discounted ? (
                <Text style={{ ...typography.caption, color: colors.muted, textDecorationLine: "line-through" }}>
                  {formatPriceTry(item.price)}{" "}
                </Text>
              ) : null}
              {formatPriceTry(item.finalPrice)}
            </Text>
          )}
        </View>
        <Text style={{ ...typography.caption, color: colors.muted }}>{item.description}</Text>
        <StoreBadges item={item} />

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          {item.owned ? (
            <Button
              label={equipped ? "Çıkar" : "Tak"}
              variant={equipped ? "secondary" : "primary"}
              onPress={toggleEquip}
              loading={update.isPending}
              style={{ flex: 1 }}
            />
          ) : free ? (
            <Button label="Ücretsiz al" icon="sparkles" onPress={claimFree} loading={claim.isPending} style={{ flex: 1 }} />
          ) : !paid ? null : (
            <Button
              label="Satın al"
              onPress={() => buy({ kind: "store", itemId: item.id })}
              disabled={!purchasable || checkout.isPending}
              loading={checkout.isPending && !giftOpen}
              style={{ flex: 1 }}
            />
          )}
          {paid ? (
            <Button
              label="Hediye et"
              icon="heart"
              variant="secondary"
              onPress={() => setGiftOpen((open) => !open)}
              disabled={!purchasable}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        {!item.owned && pointsPrice !== null && item.forSale !== false ? (
          <Button
            label={
              points < pointsPrice
                ? t("quests.store.notEnough", { points: pointsPrice.toLocaleString(locale) })
                : t("quests.store.buyWithPoints", { points: pointsPrice.toLocaleString(locale) })
            }
            variant="secondary"
            fullWidth
            disabled={points < pointsPrice || buyPoints.isPending}
            loading={buyPoints.isPending}
            onPress={() =>
              buyPoints.mutate(item.id, {
                onSuccess: () => showToast(t("quests.store.bought", { name: item.name })),
                onError: (error) => showToast(userErrorMessage(error, t("quests.toast.failed")), "error"),
              })
            }
          />
        ) : null}
        {paid && giftOpen ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <TextField
              label="KİME?"
              value={giftTo}
              onChangeText={setGiftTo}
              placeholder="@kullaniciadi"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label={`Hediye et · ${formatPriceTry(item.finalPrice)}`}
              icon="heart"
              onPress={() => buy({ kind: "store", itemId: item.id, giftTo: giftTo.trim() })}
              disabled={!giftTo.trim().replace(/^@/, "")}
              loading={checkout.isPending}
              fullWidth
            />
          </View>
        ) : null}
        {paid && !purchasable ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>Satın alma şu an kapalı.</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Rozetler (web kartıyla aynı metinler): kampanya "-%X" + "İndirim bitimine
 * …", süreli ürün "Sınırlı süre" + "… kaldı", "Mentol'e dahil", "Satıştan
 * kalktı". Geri sayım dakikada bir, son bir saatte saniyede bir tazelenir.
 */
function StoreBadges({ item }: { item: Item }) {
  const ends = item.owned ? null : item.saleEndsAt ?? item.availableUntil ?? null;
  const end = ends ? Date.parse(ends) : NaN;
  const coarse = useNow(Number.isFinite(end) ? 60_000 : 0);
  const fine = useNow(Number.isFinite(end) && end - coarse < 3_600_000 ? 1000 : 0);
  const now = Number.isFinite(end) && end - coarse < 3_600_000 ? fine : coarse;
  const left = Number.isFinite(end) && end > now ? formatCountdown(end - now) : null;
  const chips: { label: string; color: string }[] = [];
  if (!item.owned && item.salePercent) chips.push({ label: `-%${item.salePercent}`, color: "#ff5e8a" });
  if (!item.owned && item.availableUntil) chips.push({ label: "Sınırlı süre", color: "#ff9a3d" });
  if (!item.owned && item.mentolIncluded) chips.push({ label: "Mentol'e dahil", color: colors.brand });
  if (item.forSale === false) chips.push({ label: "Satıştan kalktı", color: colors.muted });
  if (!chips.length && !left) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs }}>
      {chips.map((chip) => (
        <Text key={chip.label} style={{ ...typography.caption, ...fw(700), color: chip.color }}>
          {chip.label}
        </Text>
      ))}
      {left ? (
        <Text style={{ ...typography.caption, ...fw(700), color: item.saleEndsAt ? "#ff5e8a" : "#ff9a3d" }}>
          {item.saleEndsAt ? `İndirim bitimine ${left}` : `${left} kaldı`}
        </Text>
      ) : null}
    </View>
  );
}

/** Ürün önizlemesi kendi profilinle çizilir (web ile aynı). */
function Preview({
  item,
  profile,
}: {
  item: Item;
  profile: { id: string; imageUrl: string | null; username: string; title: string } | null;
}) {
  if (item.kind === "effect") {
    return (
      <View style={{ height: 96, backgroundColor: colors.brandSoft }}>
        <CosmeticBackdrop id={item.id} />
        <ProfileEffectOverlay id={item.id} height={96} />
      </View>
    );
  }
  if (item.kind === "nameplate") {
    return (
      <View style={{ height: 96, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.bg }}>
        <CosmeticBackdrop id={item.id} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.bg }}>
          <NameplateBackground id={item.id} radius={radii.md} />
          <Avatar imageUrl={profile?.imageUrl} fallbackText={profile?.username} size={36} decorationId={null} />
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {profile?.title ?? "Sen"}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ height: 112, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <CosmeticBackdrop id={item.id} />
      <Avatar imageUrl={profile?.imageUrl} fallbackText={profile?.username} size={64} decorationId={item.id} />
    </View>
  );
}

function FilterLabel({ title }: { title: string }) {
  return <Text style={{ ...typography.overline, color: colors.muted }}>{title.toLocaleUpperCase()}</Text>;
}

function FilterChips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{children}</View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={{
        minHeight: 32,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : "transparent",
      }}
    >
      <Text style={{ ...typography.caption, color: active ? colors.brand : colors.text }}>{label}</Text>
    </Pressable>
  );
}
