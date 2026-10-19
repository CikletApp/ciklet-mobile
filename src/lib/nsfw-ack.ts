import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Yaş sınırlı kanal onayının cihazdaki kaydı. Anahtar profil kimliğiyle
 * öneklenir: aynı cihazda başka hesapla girilince önceki hesabın onayı
 * perdeyi atlatmasın. Çıkışta tüm kayıtlar silinir.
 */
const NSFW_KEY_PREFIX = "ciklet.nsfw-ack:";

export function nsfwAckKey(profileId: string, channelId: string): string {
  return `${NSFW_KEY_PREFIX}${profileId}:${channelId}`;
}

export async function clearNsfwAcknowledgements(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((key) => key.startsWith(NSFW_KEY_PREFIX));
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
