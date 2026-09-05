import type {
  AcceptEulaResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyEmailResponse,
} from "@ciklet/embedded-activities-sdk/types";
import { canonicalizeCode } from "@ciklet/embedded-activities-sdk/types";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";

/**
 * Oturum AÇMADAN çağrılan kimlik uçları: kayıt, e-posta doğrulama ve şifre
 * kurtarma. Hepsi `skipAuth` ile gider — bu noktada token yoktur ve
 * gönderilecek bir çerez de yoktur.
 *
 * Ekranlar bu modülü çağırır, `api()`'yi doğrudan değil: uçların gövde şekli,
 * kodun kanonik biçime indirgenmesi ve hata metinlerinin Türkçeleştirilmesi
 * tek yerde kalsın diye. Aynı işi dört ekranın ayrı ayrı yapması, şifre
 * sıfırlama kodunun bir ekranda büyük harfe katlanıp diğerinde
 * katlanmaması gibi hatalara zemin hazırlıyordu.
 */

// ── Kayıt ───────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  name?: string;
  /** Yerel saatte gün/ay/yıl; ISO'ya burada çevrilir. */
  dateOfBirth: { day: number; month: number; year: number };
  marketingConsent: boolean;
}

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  const body: RegisterRequest = {
    email: input.email.trim(),
    username: input.username.trim(),
    password: input.password,
    name: input.name?.trim() || null,
    // Doğum tarihi UTC gün başı olarak gönderilir. `new Date(y, m, d)` yerel
    // saat dilimini kullanır ve UTC+3'te ISO'ya çevrildiğinde bir gün geri
    // kayar — kullanıcının seçtiği tarih sunucuya yanlış yazılırdı.
    dateOfBirth: new Date(
      Date.UTC(input.dateOfBirth.year, input.dateOfBirth.month - 1, input.dateOfBirth.day)
    ).toISOString(),
    marketingConsent: input.marketingConsent,
  };

  return api<RegisterResponse>(endpoints.auth.register, {
    method: "POST",
    skipAuth: true,
    body,
  });
}

/**
 * `/api/register` hataları düz metin gövdeyle döner. Kullanıcıya
 * gösterilebilir, eyleme dönük Türkçe karşılıklarını üretir.
 */
export function describeRegisterError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Hesap oluşturulamadı.";
  if (err.isNetwork) return err.message;

  switch (err.message) {
    case "Username already exists":
      return "Bu kullanıcı adı zaten alınmış.";
    case "Email already in use":
      return "Bu e-posta adresiyle zaten bir hesap var.";
    case "Invalid email":
      return "Geçerli bir e-posta adresi gir.";
    case "Invalid username":
      return "Kullanıcı adı 2-32 karakter olmalı; yalnızca harf, rakam, nokta ve alt çizgi kullanabilirsin.";
    case "Invalid date of birth":
      return "Geçerli bir doğum tarihi gir.";
    case "Password must be 6-200 characters":
      return "Şifre 6-200 karakter arasında olmalı.";
    case "Too many registrations":
      return "Çok fazla kayıt denemesi yapıldı. Bir süre sonra tekrar dene.";
    default:
      return err.message || "Hesap oluşturulamadı.";
  }
}

// ── E-posta doğrulama ───────────────────────────────────────────────

export async function verifyEmail(username: string, code: string) {
  return api<VerifyEmailResponse>(endpoints.auth.verifyEmail, {
    method: "POST",
    skipAuth: true,
    body: { username: username.trim(), code: canonicalizeCode(code) },
  });
}

export async function resendVerification(username: string) {
  return api<ResendVerificationResponse>(endpoints.auth.verifyEmail, {
    method: "PUT",
    skipAuth: true,
    body: { username: username.trim() },
  });
}

/**
 * Doğrulama hatasının gerekçesi.
 *
 * `already_verified` bir hata değildir: hesap kullanılabilir durumda ve
 * kullanıcı doğrudan girişe alınmalıdır. Sunucu bunu 409 ile ve gövdesinde
 * `reason` alanıyla söyler; metne bakarak ayırt etmeye çalışmak
 * yerelleştirme değişince kırılırdı.
 */
export function isAlreadyVerified(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

// ── Şifre kurtarma ──────────────────────────────────────────────────

/**
 * Kodu gönderir.
 *
 * ⚠️ Hesap olmasa bile 200 döner — uç, kayıtlı kullanıcı adlarını taramak
 * için kullanılamasın diye bilerek böyle. Bu yüzden arayüz "kod gönderildi"
 * adımına HER durumda geçmelidir; "böyle bir hesap yok" demek hem mümkün
 * değil hem de sunucunun kasten gizlediği bilgiyi sızdırırdı.
 */
export async function requestPasswordReset(input: ForgotPasswordRequest) {
  return api<ForgotPasswordResponse>(endpoints.auth.forgotPassword, {
    method: "POST",
    skipAuth: true,
    body: { username: input.username.trim(), email: input.email.trim() },
  });
}

export async function resetPassword(input: ResetPasswordRequest) {
  return api<ResetPasswordResponse>(endpoints.auth.resetPassword, {
    method: "POST",
    skipAuth: true,
    body: {
      username: input.username.trim(),
      email: input.email.trim(),
      code: canonicalizeCode(input.code),
      newPassword: input.newPassword,
    },
  });
}

// ── Yasal onay ──────────────────────────────────────────────────────

/** Sözleşmeyi kabul eder. Oturum GEREKİR — token'la çağrılır. */
export async function acceptEula() {
  return api<AcceptEulaResponse>(endpoints.eula, { method: "POST" });
}

// ── Ortak ───────────────────────────────────────────────────────────

/**
 * Hız sınırı yanıtı (429) her uçta aynı anlama gelir ve kullanıcıya aynı
 * biçimde anlatılmalıdır.
 */
export function describeAuthError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.isNetwork) return err.message;
  if (err.status === 429) {
    return err.message || "Çok fazla deneme yaptın. Lütfen bir süre sonra tekrar dene.";
  }
  return err.message || fallback;
}
