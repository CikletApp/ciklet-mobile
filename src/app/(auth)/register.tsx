import { useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { describeRegisterError, register } from "@/api/auth";
import { Button, Icon } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { SelectField, type SelectOption } from "@/features/auth/select-field";
import { LEGAL_LINES, openLegalDocument } from "@/features/auth/legal";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kayıt.
 *
 * Web'deki `components/auth/signup-form.tsx` ile aynı alanlar ve aynı
 * doğrulama kuralları. Önceki mobil sürüm doğum tarihini serbest metin
 * (`YYYY-AA-GG`) olarak alıyordu ve YAŞ SINIRINI HİÇ UYGULAMIYORDU: web
 * 13 yaşından küçükleri reddederken mobilden kayıt olmak mümkündü. Aynı
 * kuralın iki istemcide farklı olması, kuralın olmaması demektir.
 *
 * Ayrıca sunucu geçersiz tarihi 400 ile reddediyor; serbest metin alanı bu
 * hatayı ancak istek gidip döndükten sonra gösterebiliyordu. Üç seçici
 * geçersiz bir tarihi (31 Şubat gibi) daha yazılırken yakalar.
 */

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const USERNAME_RE = /^[a-zA-Z0-9_.]{2,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_AGE = 13;

export default function RegisterScreen() {
  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dayOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
    []
  );
  const monthOptions = useMemo<SelectOption[]>(
    () => MONTHS.map((label, i) => ({ label, value: String(i + 1) })),
    []
  );
  const yearOptions = useMemo<SelectOption[]>(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 120 }, (_, i) => ({
      label: String(currentYear - i),
      value: String(currentYear - i),
    }));
  }, []);

  const dob = validateDateOfBirth(day, month, year);

  const emailValid = EMAIL_RE.test(email.trim());
  const usernameValid = USERNAME_RE.test(username.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && usernameValid && passwordValid && dob.ok && !busy;

  const submit = async () => {
    if (!canSubmit || !dob.ok) return;
    setBusy(true);
    setError(null);
    try {
      const result = await register({
        email,
        username,
        password,
        name,
        dateOfBirth: dob.value,
        marketingConsent: marketing,
      });
      // Hesap açıldı ama DOĞRULANMADI: giriş bu adım tamamlanmadan çalışmaz.
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { username: result.username, email: result.email },
      });
    } catch (err) {
      setError(describeRegisterError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Hesabını oluştur"
      subtitle="Ciklet topluluklarına birkaç adım kaldı."
      onBack={() => router.back()}
    >
      <AuthField
        label="GÖRÜNEN AD"
        value={name}
        onChangeText={setName}
        placeholder="Seni nasıl tanısınlar?"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <AuthField
        ref={emailRef}
        label="E-POSTA"
        value={email}
        onChangeText={setEmail}
        placeholder="ornek@eposta.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        error={email.length > 0 && !emailValid ? "Geçerli bir e-posta adresi gir." : undefined}
      />
      <AuthField
        ref={usernameRef}
        label="KULLANICI ADI"
        value={username}
        onChangeText={setUsername}
        placeholder="kullaniciadi"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={
          username.length > 0 && !usernameValid
            ? "2-32 karakter; harf, rakam, nokta ve alt çizgi."
            : undefined
        }
      />
      <AuthField
        ref={passwordRef}
        label="ŞİFRE"
        value={password}
        onChangeText={setPassword}
        placeholder="En az 6 karakter"
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="done"
        error={password.length > 0 && !passwordValid ? "Şifre en az 6 karakter olmalı." : undefined}
      />

      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.overline, color: dob.error ? colors.danger : colors.muted }}>
          DOĞUM TARİHİ
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <SelectField
            title="Gün"
            placeholder="Gün"
            value={day}
            options={dayOptions}
            onChange={setDay}
            error={Boolean(dob.error)}
          />
          <SelectField
            title="Ay"
            placeholder="Ay"
            value={month}
            options={monthOptions}
            onChange={setMonth}
            error={Boolean(dob.error)}
          />
          <SelectField
            title="Yıl"
            placeholder="Yıl"
            value={year}
            options={yearOptions}
            onChange={setYear}
            error={Boolean(dob.error)}
          />
        </View>
        {dob.error ? (
          <Text style={{ ...typography.caption, color: colors.danger }}>{dob.error}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => setMarketing((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marketing }}
        accessibilityLabel="Ciklet'ten haberler ve güncellemeler almak istiyorum"
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.sm,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: marketing ? colors.brand : colors.border,
            backgroundColor: marketing ? colors.brand : "transparent",
          }}
        >
          {marketing ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
        </View>
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
          Ciklet&apos;ten haberler ve güncellemeler almak istiyorum.
        </Text>
      </Pressable>

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <Button
        label="Hesap Oluştur"
        size="lg"
        fullWidth
        onPress={submit}
        loading={busy}
        disabled={!canSubmit}
      />

      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
        {LEGAL_LINES.signupPrefix}{" "}
        <Text style={{ color: colors.accent }} onPress={() => openLegalDocument("terms")}>
          {LEGAL_LINES.terms}
        </Text>
        {LEGAL_LINES.signupMiddle}{" "}
        <Text style={{ color: colors.accent }} onPress={() => openLegalDocument("privacy")}>
          {LEGAL_LINES.privacy}
        </Text>
        {LEGAL_LINES.signupSuffix}
      </Text>
    </AuthShell>
  );
}

/**
 * Doğum tarihi doğrulaması — web'deki `superRefine` ile aynı üç kural:
 * eksik alan, takvimde olmayan tarih (31 Şubat), ve 13 yaş sınırı.
 */
function validateDateOfBirth(
  day: string,
  month: string,
  year: string
): { ok: true; value: { day: number; month: number; year: number }; error?: undefined } | { ok: false; error?: string } {
  if (!day || !month || !year) {
    // Kullanıcı henüz hiçbirine dokunmadıysa hata gösterme; forma girer
    // girmez kırmızı bir uyarı görmek gereksiz bir baskı.
    const started = Boolean(day || month || year);
    return { ok: false, error: started ? "Lütfen tüm tarih alanlarını doldur." : undefined };
  }

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  // Ay/gün eşleşmesi: `new Date` taşan günü bir sonraki aya devreder
  // (31 Şubat → 3 Mart), bu yüzden geri okuyup karşılaştırmak gerekiyor.
  const date = new Date(y, m - 1, d);
  const realDate =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!realDate) return { ok: false, error: "Lütfen geçerli bir doğum tarihi gir." };

  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDelta = today.getMonth() - (m - 1);
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < d)) age--;

  if (age < MIN_AGE) {
    return { ok: false, error: `Ciklet'e kaydolmak için en az ${MIN_AGE} yaşında olmalısın.` };
  }

  return { ok: true, value: { day: d, month: m, year: y } };
}
