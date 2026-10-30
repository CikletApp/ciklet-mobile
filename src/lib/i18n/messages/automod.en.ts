/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { automodTr, streamingTr } from "./automod.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export const automodEn = {
  timeout: {
    none: "No timeout",
    s60: "60 seconds",
    m5: "5 minutes",
    m10: "10 minutes",
    h1: "1 hour",
    d1: "1 day",
    w1: "1 week",
  },
  settings: {
    words: {
      title: "AutoMod — Blocked Words",
      description: "Separate with commas or new lines; whole words match, end with * to match a prefix. Spelling tricks are caught too (repeated letters, digits/symbols, separators). Matching messages can't be sent (removed if they come through the gateway). Up to {max} words.",
      placeholder: "word1, word2, prefix*",
      count: "{count} words",
    },
    mentions: {
      title: "AutoMod — Mention Spam",
      description: "Blocks a message that tags more than this many different people or roles. Leave empty to turn off (max {max}).",
      off: "Off",
    },
    linkFilter: {
      title: "AutoMod — Link Filter",
      description: "When on, links are only allowed to the domains below (and their subdomains); attachments are always allowed. Up to {max} domains.",
      emptyWarning: "No allowed domains: every link is blocked.",
    },
    actionsSection: {
      title: "AutoMod — Actions",
      description: "A message that breaks a rule is always blocked. Optionally the author is timed out and the event is posted to your moderation channel and the message's channel.",
      timeout: "Timeout",
      alertChannel: "Moderation channel",
      noAlert: "No alerts",
    },
    preset: {
      title: "AutoMod — Turkish Profanity Filter",
      description: "A ready-made, comprehensive Turkish profanity and insult list. It also catches spelling tricks (repeated letters, 4→a, 1→ı, 0→o, $→s, splitting with dots or spaces) and leaves innocent words like \"sıkıntı\", \"amaç\" or \"piknik\" alone.",
      enable: "Enable in one click",
      enabled: "On",
      allowTitle: "Allowed words",
      allowDescription: "Words that should never be caught (separate with commas or new lines; end with * for a prefix). Applies to both the preset and the blocked word list.",
      allowPlaceholder: "amina, word*",
    },
    spam: {
      title: "AutoMod — Spam Detection",
      description: "Blocks messages from members who send many messages in a short time or repeat the same content.",
      maxMessages: "Max messages",
      window: "Window (seconds)",
      duplicates: "Same message repeats (60 s)",
    },
    caps: {
      title: "AutoMod — Excessive Caps",
      description: "Blocks messages where more than the given share of letters is uppercase (short messages excluded).",
      percent: "Uppercase share (%)",
      minLetters: "Minimum letters",
    },
    links: {
      inviteTitle: "Block invite links",
      inviteDescription: "Ciklet and Discord server invites can't be shared.",
      blockedTitle: "Blocked domains",
      blockedDescription: "Links to these domains (and subdomains) are blocked even when the link filter is off.",
    },
    profile: {
      title: "AutoMod — Username and Profile Filter",
      description: "Display name, username, server nickname and bio must pass the blocked word list and (if enabled) the profanity filter. A member who fails can't send messages until they fix it; such nicknames and server bios aren't saved.",
    },
    actions: {
      warnTitle: "Warning line in channel",
      warnDescription: "A short AutoMod notice is posted in the channel of the blocked message (the content isn't shown).",
      blockMessageTitle: "Message shown to the sender",
      blockMessageDescription: "Leave empty to show the rule's own explanation.",
      blockMessagePlaceholder: "This message breaks the server rules.",
    },
    exempt: {
      title: "AutoMod — Exemptions",
      description: "Members with Manage Messages are always exempt. These roles and channels (including their threads) aren't checked either.",
      roles: "Exempt roles",
      channels: "Exempt channels",
      none: "None selected",
    },
  },

} satisfies Widen<typeof automodTr>;

export const streamingEn = {
  live: "LIVE",
  settings: {
    hint: "Connect your account to show \"Live\" on your profile while you stream",
    broadcaster: "Broadcaster permissions",
    broadcasterHint: "Lets linked roles read your subscribers",
    grantBroadcaster: "Connect as broadcaster",
    connect: "Connect",
    reconnect: "Reconnect",
    disconnect: "Remove",
    disconnected: "{platform} connection removed.",
    disconnectFailed: "Couldn't remove the {platform} connection.",
    liveNow: "Live now",
  },
  linkedRoles: {
    title: "Linked Roles",
    description: "Tie a role to a subscription to your Twitch or Kick channel. When members connect their account the role is granted automatically if they qualify, and removed when the subscription ends (re-verified every half hour). Only the server owner can set this up, for their own channel.",
    ownerOnly: "Only the server owner can manage linked roles.",
    role: "Role",
    platform: "Platform",
    requirement: "Requirement",
    subscriber: "Subscribed to my channel",
    follower: "Follows my channel",
    followerTwitchOnly: "The follower requirement is Twitch-only (Kick doesn't report unfollows).",
    add: "Link",
    remove: "Remove",
    empty: "No linked roles yet.",
    loading: "Loading…",
    needsBroadcaster: "First connect your {platform} account with \"Connect as broadcaster\" under Settings → Profile → Connections.",
    created: "Linked role created.",
    createFailed: "Couldn't create the linked role.",
    removeFailed: "Couldn't remove the linked role.",
    granted: "{count} members",
    lastSynced: "Last verified: {time}",
    selectRole: "Select a role",
  },

} satisfies Widen<typeof streamingTr>;
