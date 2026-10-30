import type { voiceE2eeTr } from "./voice-e2ee.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2eeEn = {
  status: {
    encrypted: "End-to-end encrypted",
    connecting: "Setting up encryption…",
    mixed: "Unencrypted participant present",
    unsupported: "Unencrypted connection",
  },
  title: "End-to-end encryption",
  body: {
    encrypted:
      "Your voice, video and screen share are only decrypted on the devices of the people in this call. Nobody else, not even Ciklet's servers, can see the content.",
    connecting: "Exchanging encryption keys with the participants.",
    mixed:
      "Some participants are using a version without end-to-end encryption. Their audio is sent unencrypted and they can't hear encrypted participants.",
    unsupported:
      "This device or browser doesn't support end-to-end encryption: your audio is sent unencrypted and you can't hear encrypted participants. Update Ciklet or use an up-to-date Chrome, Edge, Firefox or Safari.",
  },
  code: {
    title: "Voice privacy code",
    help: "Compare this code with the other participants (for example, read it out loud). If everyone sees the same code, the call is end-to-end encrypted and nobody is listening in between. The code changes when someone joins or leaves.",
    copy: "Copy code",
    copied: "Code copied",
    waiting: "The code appears once the keys are ready.",
  },
  unencrypted: {
    title: "Unencrypted participants",
    badge: "Unencrypted participant",
  },
  pending: "Waiting for encryption",
} as const satisfies Widen<typeof voiceE2eeTr>;
