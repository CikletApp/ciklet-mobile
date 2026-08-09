import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "@/theme/tokens";

/**
 * Ciklet ikon seti.
 *
 * Neden kendi setimiz:
 *  1. `@expo/vector-icons` SDK 57 dokümanında kullanımdan kaldırılmış
 *     olarak işaretli.
 *  2. Hazır setler binlerce kullanılmayan glif taşır; burada yalnızca
 *     kullandığımız yollar paketlenir.
 *  3. En önemlisi: ikon dili markanın parçasıdır ve tamamen bize ait
 *     olmalıdır — hiçbir üçüncü taraf uygulamanın gliflerini taşımayız.
 *
 * Çizim kuralları: 24×24 kutu, 2px çizgi kalınlığı, yuvarlak uç ve
 * birleşim. Yeni ikon eklerken bu üçüne uy, set tutarlı kalsın.
 */

export type IconName =
  // Gezinme
  | "home"
  | "bell"
  | "user"
  | "search"
  | "settings"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "close"
  | "check"
  | "plus"
  // Sohbet
  | "hash"
  | "volume"
  | "video"
  | "send"
  | "message"
  | "phone"
  | "reply"
  | "emoji"
  | "attachment"
  | "timer"
  // Sosyal
  | "users"
  | "user-plus"
  | "compass"
  | "pencil"
  | "logout"
  | "shield"
  | "bell-off"
  | "link"
  | "bookmark"
  | "folder"
  | "more";

interface IconProps {
  name: IconName;
  size?: number;
  /**
   * `ColorValue` — navigator'ın `tabBarIcon` geri çağrısı düz `string`
   * değil, platforma özel opak renk de verebilir; daraltmak çağrı
   * yerlerinde cast'e zorlar.
   */
  color?: ColorValue;
  /** Dolu varyant — seçili sekme gibi durumlarda. */
  filled?: boolean;
}

/**
 * `stroke` tabanlı yollar. `d` dizisindeki her eleman ayrı bir <Path>'tir;
 * çoklu parçalı ikonlarda alt-yol birleşme artefaktını önler.
 */
const PATHS: Record<IconName, string[]> = {
  home: ["M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  bell: [
    "M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5",
    "M13.7 19a2 2 0 0 1-3.4 0",
  ],
  user: ["M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "m21 21-4.3-4.3"],
  settings: [
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.9 19a1.7 1.7 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.4 7.9a1.7 1.7 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  ],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chevron-down": ["m6 9 6 6 6-6"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  check: ["m20 6-11 11-5-5"],
  plus: ["M12 5v14", "M5 12h14"],
  hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
  volume: [
    "M11 5 6 9H2v6h4l5 4z",
    "M15.5 8.5a5 5 0 0 1 0 7",
    "M18.5 5.5a9 9 0 0 1 0 13",
  ],
  video: ["M23 7l-7 5 7 5z", "M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
  message: ["M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z",
  ],
  reply: ["M9 17l-5-5 5-5", "M20 18v-2a4 4 0 0 0-4-4H4"],
  emoji: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M8.5 14.5a4 4 0 0 0 7 0", "M9 9h.01", "M15 9h.01"],
  attachment: [
    "M21.4 11.1 12.3 20a5.5 5.5 0 1 1-7.8-7.8l9.2-9.1a3.7 3.7 0 1 1 5.2 5.2l-9.2 9.1a1.8 1.8 0 1 1-2.6-2.6l8.5-8.4",
  ],
  timer: ["M10 2h4", "M12 14l3-3", "M12 6a8 8 0 1 1-5.7 2.3", "M7 4 4 2-4 2"],
  users: [
    "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M23 21v-2a4 4 0 0 0-3-3.9",
    "M17 3.1a4 4 0 0 1 0 7.8",
  ],
  "user-plus": [
    "M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M20 8v6",
    "M23 11h-6",
  ],
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "m15.5 8.5-2.1 5-5 2.1 2.1-5z"],
  pencil: ["M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"],
  "bell-off": [
    "M13.7 19a2 2 0 0 1-3.4 0",
    "M18.6 13A17 17 0 0 1 18 8.5a6 6 0 0 0-9.3-5",
    "M6.3 6.3A6 6 0 0 0 6 8.5c0 5-2 6.5-2 6.5h14",
    "M2 2l20 20",
  ],
  link: [
    "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L11.8 5",
    "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  ],
  bookmark: ["M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"],
  folder: ["M3 5.5A1.5 1.5 0 0 1 4.5 4H9l2 2h8.5A1.5 1.5 0 0 1 21 7.5v10A2.5 2.5 0 0 1 18.5 20h-14A2.5 2.5 0 0 1 2 17.5v-12z"],
  more: [],
};

/** Nokta/daire tabanlı ikonlar yol yerine ilkel şekil kullanır. */
function Extras({ name, color }: { name: IconName; color: ColorValue }) {
  if (name === "more") {
    return (
      <>
        <Circle cx={5} cy={12} r={1.6} fill={color} />
        <Circle cx={12} cy={12} r={1.6} fill={color} />
        <Circle cx={19} cy={12} r={1.6} fill={color} />
      </>
    );
  }
  return null;
}

export function Icon({
  name,
  size = 24,
  color = colors.text,
  filled = false,
}: IconProps) {
  const paths = PATHS[name];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Dolu varyantta yalnızca ilk (dış hat) yol boyanır; iç detaylar
          // (ör. çan sarkacı) çizgi olarak kalmalı.
          fill={filled && index === 0 ? color : "none"}
        />
      ))}
      <Extras name={name} color={color} />
    </Svg>
  );
}

/**
 * Presence noktası — avatarın köşesinde ve üye listelerinde kullanılır.
 * Renkler doğrudan tema token'larından gelir.
 */
export function PresenceDot({
  status,
  size = 12,
  ringColor = colors.bg,
}: {
  status: "ONLINE" | "IDLE" | "DND" | "INVISIBLE" | "OFFLINE";
  size?: number;
  /** Avatarın üstünde okunabilirlik için çizilen halka. */
  ringColor?: string;
}) {
  const fill = {
    ONLINE: colors.online,
    IDLE: colors.idle,
    DND: colors.dnd,
    INVISIBLE: colors.offline,
    OFFLINE: colors.offline,
  }[status];

  const half = size / 2;
  const ring = size * 0.16;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={half} cy={half} r={half} fill={ringColor} />
      <Circle cx={half} cy={half} r={half - ring} fill={fill} />
      {/* Rahatsız etmeyin: içi oyulmuş halka. Çevrimdışı: içi boş. */}
      {status === "DND" && (
        <Rect
          x={half - size * 0.22}
          y={half - size * 0.07}
          width={size * 0.44}
          height={size * 0.14}
          rx={size * 0.07}
          fill={ringColor}
        />
      )}
      {(status === "OFFLINE" || status === "INVISIBLE") && (
        <Circle cx={half} cy={half} r={(half - ring) * 0.5} fill={ringColor} />
      )}
      {status === "IDLE" && (
        <Circle
          cx={half - size * 0.16}
          cy={half - size * 0.16}
          r={half - ring}
          fill={ringColor}
        />
      )}
    </Svg>
  );
}
