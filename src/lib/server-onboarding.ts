/**
 * Katılım soruları (Discord "Onboarding") — web `lib/server-onboarding.ts`
 * modülünün istemci kopyası (sınırlar, tipler, perde sırası). Doğrulama
 * ve rol verme uçta (`PUT /onboarding`, `POST /onboarding/complete`);
 * burası yalnızca formun aynı sınırları uygulaması ve perdenin sırası için.
 * Web modülü değişirse burası da güncellenir.
 */

export const ONBOARDING_MAX_QUESTIONS = 5;
export const ONBOARDING_MAX_OPTIONS = 10;
export const ONBOARDING_MIN_OPTIONS = 2;
export const ONBOARDING_TITLE_MAX = 100;
export const ONBOARDING_LABEL_MAX = 50;
export const ONBOARDING_DESCRIPTION_MAX = 100;
export const ONBOARDING_EMOJI_MAX = 16;
export const ONBOARDING_MAX_GRANTS = 5;

/** Web `BotPermissions` bitleri (lib/bot/permissions) — yalnızca yasak küme için. */
const bit = (n: number) => BigInt(1) << BigInt(n);

/** Bu bitlerden birini taşıyan rol katılım sorusuyla verilemez (web ONBOARDING_FORBIDDEN_BITS). */
export const ONBOARDING_FORBIDDEN_BITS: bigint =
  bit(17) | // ADMINISTRATOR
  bit(18) | // MANAGE_SERVER
  bit(19) | // MANAGE_ROLES
  bit(5) | // MANAGE_CHANNELS
  bit(10) | // MANAGE_PERMISSIONS
  bit(3) | // KICK_MEMBERS
  bit(4) | // BAN_MEMBERS
  bit(20) | // MODERATE_MEMBERS
  bit(2) | // MANAGE_MESSAGES
  bit(16) | // MENTION_EVERYONE
  bit(21) | // MUTE_MEMBERS
  bit(24) | // DEAFEN_MEMBERS
  bit(22) | // MOVE_MEMBERS
  bit(9) | // CREATE_INVITES
  bit(23); // VIEW_AUDIT_LOG

/** Rol izinleri (ondalık BigInt dizgesi) katılım sorusuyla verilebilir mi. */
export function isOnboardingGrantable(permissions: string | null | undefined): boolean {
  try {
    return (BigInt(permissions || "0") & ONBOARDING_FORBIDDEN_BITS) === BigInt(0);
  } catch {
    return false;
  }
}

export interface OnboardingOption {
  id: string;
  label: string;
  description: string | null;
  emoji: string | null;
  roleIds: string[];
  channelIds: string[];
}

export interface OnboardingQuestion {
  id: string;
  title: string;
  /** Birden çok seçenek seçilebilir mi. */
  multiple: boolean;
  /** Atlanamaz. */
  required: boolean;
  options: OnboardingOption[];
}

export interface OnboardingConfig {
  enabled: boolean;
  /** true: sorular kural ekranından önce; false: kurallar kabul edildikten sonra. */
  beforeRules: boolean;
  questions: OnboardingQuestion[];
}

export const EMPTY_ONBOARDING: OnboardingConfig = { enabled: false, beforeRules: true, questions: [] };

export type OnboardingAnswers = Record<string, string[]>;

/** Kurallar ile sorular arasında şu an hangi perde gösterilmeli. */
export function nextJoinStep(input: {
  onboardingPending: boolean;
  rulesPending: boolean;
  beforeRules: boolean;
}): "onboarding" | "rules" | null {
  if (input.onboardingPending && (input.beforeRules || !input.rulesPending)) return "onboarding";
  if (input.rulesPending) return "rules";
  return null;
}
