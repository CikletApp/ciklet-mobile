import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { Stack, router } from "expo-router";

import { Avatar, Button, Icon, Screen, ScreenLoader, TextField, showDialog, showToast } from "@/components/ui";
import {
  createCode,
  familyErrorKey,
  fetchOverview,
  fetchSummary,
  removeLink,
  requestLink,
  respondLink,
  setWeeklyEmail,
  useScannedFamilyCode,
  type FamilyCode,
  type FamilyLinkView,
  type FamilyOverview,
  type FamilyPerson,
  type FamilyServer,
  type FamilySummary,
} from "@/features/family-center/api";
import { formatDate } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ayarlar → Aile Merkezi — web `settings/settings-family-center-tab`
 * karşılığı (Discord Family Center; aynı akış, aynı metinler).
 *  - Genç: bağlantı kodu + QR, gelen isteği onayla/reddet, bağlı veli,
 *    velinin gördüğü özet, bağlantıyı kaldır.
 *  - Veli: kodu gir ya da QR'ı tara, istek gönder, bağlı gençlerin son 7
 *    günü, haftalık e-posta tercihi, bağlantıyı kaldır.
 */
export default function FamilyCenterScreen() {
  const t = useT();
  // Sorgu önbelleğinde: hesap geçişinde/çıkışta clearPersistedCache siler.
  const query = useQuery({ queryKey: ["family-center"], queryFn: fetchOverview });
  const overview = query.data ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => { await query.refetch(); }, [query]);

  if (query.isLoading) return <ScreenLoader />;

  const isTeen = overview?.role === "teen" || overview?.links.some((l) => l.side === "teen");

  return (
    <Screen>
      <Stack.Screen options={{ title: t("familyCenter.title") }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
      >
        <Text style={{ ...typography.body, color: colors.muted }}>{t("familyCenter.intro")}</Text>
        {!overview ? (
          <Button label={t("familyCenter.errors.generic")} variant="secondary" onPress={() => void reload()} />
        ) : overview.role === "ineligible" && overview.links.length === 0 ? (
          <Card>
            <Text style={{ ...typography.body, ...fw(700), color: colors.text }}>{t("familyCenter.ineligible.title")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.ineligible.body")}</Text>
          </Card>
        ) : isTeen ? (
          <TeenView overview={overview} reload={reload} />
        ) : (
          <ParentView overview={overview} reload={reload} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.panel, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }}>
      {children}
    </View>
  );
}

const personName = (p: FamilyPerson) => p.name?.trim() || p.username;

function PersonRow({ person, trailing }: { person: FamilyPerson; trailing?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Avatar profileId={person.id} imageUrl={person.imageUrl} fallbackText={person.username} size={36} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ ...typography.body, ...fw(600), color: colors.text }}>{personName(person)}</Text>
        <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>{person.username}</Text>
      </View>
      {trailing}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ ...typography.caption, ...fw(700), color: colors.muted, letterSpacing: 0.6 }}>{children.toLocaleUpperCase("tr")}</Text>;
}

function useRemove(reload: () => Promise<void>) {
  const t = useT();
  return (link: FamilyLinkView, labelKey: MessageKey) =>
    showDialog(t(labelKey), t("familyCenter.removeConfirm", { name: personName(link.other) }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t(labelKey),
        style: "destructive",
        onPress: () => {
          void removeLink(link.id)
            .then(() => { showToast(t("familyCenter.removed")); return reload(); })
            .catch((error) => showToast(t(familyErrorKey(error)), "error"));
        },
      },
    ]);
}

function TeenView({ overview, reload }: { overview: FamilyOverview; reload: () => Promise<void> }) {
  const t = useT();
  const confirmRemove = useRemove(reload);
  const active = overview.links.find((l) => l.side === "teen" && l.status === "ACTIVE");
  const pending = overview.links.filter((l) => l.side === "teen" && l.status === "PENDING");
  const [code, setCode] = useState<FamilyCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Kod gösterilirken gelen istek hemen görünsün (web ile aynı yoklama).
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => { setNow(Date.now()); void reload(); }, 4_000);
    return () => clearInterval(timer);
  }, [code, reload]);

  const generate = async () => {
    setBusy(true);
    try {
      setCode(await createCode());
      setNow(Date.now());
    } catch (error) {
      showToast(t(familyErrorKey(error)), "error");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (link: FamilyLinkView, action: "accept" | "decline") => {
    try {
      await respondLink(link.id, action);
      setCode(null);
      await reload();
    } catch (error) {
      showToast(t(familyErrorKey(error)), "error");
    }
  };

  const expired = code ? Date.parse(code.expiresAt) <= now : false;
  const minutes = code ? Math.max(1, Math.ceil((Date.parse(code.expiresAt) - now) / 60_000)) : 0;

  return (
    <>
      {pending.map((link) => (
        <Card key={link.id}>
          <SectionTitle>{t("familyCenter.teen.requestTitle")}</SectionTitle>
          <PersonRow person={link.other} />
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.teen.requestBody", { name: personName(link.other) })}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button label={t("familyCenter.teen.accept")} onPress={() => void respond(link, "accept")} fullWidth /></View>
            <View style={{ flex: 1 }}><Button label={t("familyCenter.teen.decline")} variant="secondary" onPress={() => void respond(link, "decline")} fullWidth /></View>
          </View>
        </Card>
      ))}

      {active ? (
        <>
          <Card>
            <SectionTitle>{t("familyCenter.teen.connectedTitle")}</SectionTitle>
            <PersonRow person={active.other} />
            {active.acceptedAt ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.connectedSince", { date: formatDate(active.acceptedAt) })}</Text>
            ) : null}
            <Button label={t("familyCenter.remove")} variant="danger" onPress={() => confirmRemove(active, "familyCenter.remove")} />
          </Card>
          <Card>
            <Text style={{ ...typography.body, ...fw(700), color: colors.text }}>{t("familyCenter.teen.sharedTitle")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.teen.sharedBody")}</Text>
          </Card>
          <SummaryPanel teenId={undefined} titleKey="familyCenter.summary.own" />
        </>
      ) : (
        <Card>
          <Text style={{ ...typography.body, ...fw(700), color: colors.text }}>{t("familyCenter.teen.codeTitle")}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.teen.codeDescription")}</Text>
          {code && !expired ? (
            <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm }}>
              <Image source={{ uri: code.qr }} style={{ width: 180, height: 180, borderRadius: radii.md, backgroundColor: "#fff" }} />
              <Text selectable style={{ ...typography.title, ...fw(800), color: colors.text, letterSpacing: 4 }}>{code.display}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.teen.expiresIn", { minutes })}</Text>
              <Button label={t("familyCenter.teen.regenerate")} variant="ghost" onPress={() => void generate()} disabled={busy} />
            </View>
          ) : (
            <>
              {code && expired ? <Text style={{ ...typography.caption, color: colors.danger }}>{t("familyCenter.teen.expired")}</Text> : null}
              <Button label={t("familyCenter.teen.generate")} onPress={() => void generate()} loading={busy} />
            </>
          )}
        </Card>
      )}
    </>
  );
}

function ParentView({ overview, reload }: { overview: FamilyOverview; reload: () => Promise<void> }) {
  const t = useT();
  const confirmRemove = useRemove(reload);
  // Kod alanı paylaşılan depoda: QR tarama ekranı doğrudan buraya yazar.
  const code = useScannedFamilyCode((s) => s.code) ?? "";
  const setCode = useScannedFamilyCode((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const links = overview.links.filter((l) => l.side === "parent");

  // Ekrandan çıkınca alan boşalır (başka hesaba taşınmasın).
  useEffect(() => () => useScannedFamilyCode.getState().set(null), []);

  const send = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const res = await requestLink(code);
      showToast(t("familyCenter.parent.sent", { name: personName(res.teen) }));
      setCode("");
      await reload();
    } catch (error) {
      showToast(t(familyErrorKey(error)), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleEmail = async (link: FamilyLinkView, value: boolean) => {
    try {
      await setWeeklyEmail(link.id, value);
      await reload();
    } catch (error) {
      showToast(t(familyErrorKey(error)), "error");
    }
  };

  return (
    <>
      {links.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t("familyCenter.parent.teensTitle")}</SectionTitle>
          {links.map((link) => (
            <Card key={link.id}>
              <PersonRow
                person={link.other}
                trailing={link.status === "PENDING" ? (
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>{t("familyCenter.parent.pending")}</Text>
                ) : null}
              />
              {link.status === "ACTIVE" ? (
                <>
                  {link.acceptedAt ? (
                    <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.connectedSince", { date: formatDate(link.acceptedAt) })}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.text }}>{t("familyCenter.parent.weeklyEmail")}</Text>
                      <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.parent.weeklyEmailHint")}</Text>
                    </View>
                    <Switch
                      value={link.weeklyEmail}
                      onValueChange={(v) => void toggleEmail(link, v)}
                      trackColor={{ false: colors.border, true: colors.brand }}
                      thumbColor="#ffffff"
                    />
                  </View>
                  <Button
                    label={open === link.id ? t("familyCenter.parent.hideActivity") : t("familyCenter.parent.viewActivity")}
                    variant="secondary"
                    onPress={() => setOpen(open === link.id ? null : link.id)}
                  />
                  {open === link.id ? <SummaryPanel teenId={link.other.id} titleKey="familyCenter.summary.title" /> : null}
                </>
              ) : null}
              <Button
                label={t(link.status === "PENDING" ? "familyCenter.cancelRequest" : "familyCenter.remove")}
                variant="ghost"
                onPress={() => confirmRemove(link, link.status === "PENDING" ? "familyCenter.cancelRequest" : "familyCenter.remove")}
              />
            </Card>
          ))}
        </View>
      ) : null}

      <Card>
        <Text style={{ ...typography.body, ...fw(700), color: colors.text }}>{t("familyCenter.parent.addTitle")}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.parent.addDescription")}</Text>
        <TextField
          label={t("familyCenter.parent.codeLabel")}
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase().slice(0, 16))}
          placeholder={t("familyCenter.parent.codePlaceholder")}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
        />
        <Button label={t("familyCenter.parent.send")} onPress={() => void send()} loading={busy} disabled={!code.trim()} />
        <Button label={t("familyCenter.parent.scan")} variant="secondary" onPress={() => router.push("/settings/family-center-scan")} />
      </Card>
    </>
  );
}

const PREVIEW = 8;

function SummaryPanel({ teenId, titleKey }: { teenId: string | undefined; titleKey: MessageKey }) {
  const t = useT();
  const [data, setData] = useState<FamilySummary | null>(null);
  useEffect(() => {
    void fetchSummary(teenId).then(setData).catch(() => undefined);
  }, [teenId]);
  if (!data) return <ActivityIndicator color={colors.muted} />;
  return (
    <View style={{ gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md }}>
      <View>
        <Text style={{ ...typography.body, ...fw(700), color: colors.text }}>{t(titleKey)}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{formatDate(data.since)} – {formatDate(data.until)}</Text>
      </View>
      <People titleKey="familyCenter.summary.newFriends" list={data.newFriends} />
      <Servers list={data.serversJoined} />
      <People titleKey="familyCenter.summary.usersMessaged" list={data.usersMessaged} />
      <People titleKey="familyCenter.summary.usersCalled" list={data.usersCalled} />
      <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
        <Icon name="lock" size={14} color={colors.muted} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>{t("familyCenter.summary.privacy")}</Text>
      </View>
    </View>
  );
}

function People({ titleKey, list }: { titleKey: MessageKey; list: { total: number; items: FamilyPerson[] } }) {
  const t = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle>{`${t(titleKey)} · ${list.total}`}</SectionTitle>
      {list.total === 0 ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.summary.none")}</Text>
      ) : (
        <>
          {list.items.slice(0, PREVIEW).map((p) => <PersonRow key={p.id} person={p} />)}
          {list.total > PREVIEW ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.summary.more", { count: list.total - PREVIEW })}</Text> : null}
        </>
      )}
    </View>
  );
}

function Servers({ list }: { list: { total: number; items: FamilyServer[] } }) {
  const t = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle>{`${t("familyCenter.summary.serversJoined")} · ${list.total}`}</SectionTitle>
      {list.total === 0 ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.summary.none")}</Text>
      ) : (
        <>
          {list.items.slice(0, PREVIEW).map((s) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar imageUrl={s.imageUrl} fallbackText={s.name} size={36} shape="squircle" />
              <Text numberOfLines={1} style={{ ...typography.body, ...fw(600), color: colors.text, flex: 1 }}>{s.name}</Text>
            </View>
          ))}
          {list.total > PREVIEW ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("familyCenter.summary.more", { count: list.total - PREVIEW })}</Text> : null}
        </>
      )}
    </View>
  );
}
