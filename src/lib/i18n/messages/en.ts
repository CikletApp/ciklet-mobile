import type { Messages } from "./tr";

/** İngilizce sözlük — `tr.ts` ile aynı şekli taşımak zorunda. */
export const en = {
  common: {
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    system: "System",
    on: "On",
    off: "Off",
  },
  tabs: {
    chats: "Chats",
    servers: "Servers",
    notifications: "Notifications",
    me: "You",
    unread: "{label}, {count} unread",
  },
  messagePreview: {
    voice: "🎤 Voice message",
    voiceWithDuration: "🎤 Voice message ({duration})",
    image: "📷 Photo",
    video: "🎥 Video",
    gif: "GIF",
    sticker: "Sticker",
    clip: "🎬 Clip",
    file: "📎 {name}",
    attachment: "📎 Attachment",
  },
  settings: {
    title: "Settings",
    editProfile: "Edit your profile",
    sections: {
      account: "ACCOUNT SETTINGS",
      app: "APP SETTINGS",
      support: "SUPPORT",
      session: "SESSION",
    },
    rows: {
      account: "Account",
      mentol: "Mentol",
      privacy: "Privacy, Data & Social",
      friendRequests: "Friend Requests",
      authorizedApps: "Authorized Apps",
      voice: "Voice & Video",
      appearance: "Appearance",
      chat: "Chat",
      notifications: "Notifications",
      help: "Help",
      helpSubtitle: "Support, feedback, terms",
    },
    logout: {
      action: "Log Out",
      title: "Log out",
      message: "You will be signed out on this device.",
    },
    memberSince: "On Ciklet since {date}",
    appearance: {
      title: "Appearance",
      motion: {
        title: "REDUCE MOTION",
        description:
          "Tones down transitions, sliding panels and pulsing animations. System follows your phone's accessibility setting.",
      },
      language: {
        title: "LANGUAGE",
        description: "Interface language. Translation is in progress; untranslated text appears in Turkish.",
        system: "Device language ({name})",
      },
    },
    voice: {
      title: "Voice & Video",
      inputMode: "INPUT MODE",
      vad: "Voice activity",
      ptt: "Push to talk",
      pttHint:
        "With push to talk on, your microphone starts muted in voice channels; hold the on-screen button to speak.",
      inputVolume: "INPUT VOLUME",
      outputVolume: "OUTPUT VOLUME",
      deviceNote:
        "Your phone manages input and output devices automatically. Pick Bluetooth or wired devices from the system audio panel.",
    },
    notifications: {
      title: "Notifications",
      permission: "NOTIFICATION PERMISSION",
      master: "Ciklet notifications",
      masterDescription: "Allow notifications on this device.",
      permissionDenied: "Notifications are turned off in system settings.",
      types: "NOTIFICATION TYPES",
      messages: "Messages and mentions",
      calls: "Incoming calls",
      friends: "Friend requests",
      sounds: "Notification sounds",
      lockScreen: "CALLS ON LOCK SCREEN",
      fullScreenOff: "Full-screen call permission is off",
      fullScreenBody:
        "Android needs a separate permission to ring full screen on the lock screen while the app is closed. Without it, calls only show as a notification.",
      openSettings: "Open settings",
      overrides: "SERVER, CHANNEL AND CHAT OVERRIDES",
      overridesEmpty:
        "No overrides yet. Long-press a server, channel or chat and pick Notifications to add one.",
      reset: "Reset to default",
    },
  },
} satisfies Messages;
