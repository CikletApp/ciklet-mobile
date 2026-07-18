import { DEFAULT_API_BASE_URL } from "@ciklet/embedded-activities-sdk/types";

/**
 * API kökü. Geliştirmede .env dosyasındaki EXPO_PUBLIC_API_URL ile ezilir
 * (örn. bilgisayarınızın LAN IP'si: http://192.168.1.20:3000 — Expo dev
 * client'ı localhost'u telefondan göremez).
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
