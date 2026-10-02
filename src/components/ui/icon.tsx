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
  | "forward"
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
  // Emoji kategorileri (web seçicisindeki lucide simgelerinin karşılığı)
  | "clock"
  | "dog"
  | "utensils"
  | "gamepad"
  | "plane"
  | "lightbulb"
  | "heart"
  | "pin"
  | "pin-off"
  | "list"
  | "folder"
  | "more"
  // Görünüm
  | "palette"
  | "sparkles"
  | "monitor"
  | "rotate-ccw"
  // Ses
  | "mic"
  | "mic-off"
  | "phone-off"
  // Mesaj eylemleri
  | "copy"
  | "trash"
  | "flag"
  // Form
  | "eye"
  | "eye-off"
  // Ekler
  | "file"
  | "play"
  | "download"
  | "help"
  // Ek kaynağı (galeri / kamera)
  | "image"
  | "camera";

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
  /**
   * Dolu varyantta iç detayların (pusula iğnesi, çan tokmağı) rengi —
   * ikonun üstünde durduğu zemin. Verilmezse iç detaylar dış hatla aynı
   * renge boyanıp dolgunun içinde kayboluyordu.
   */
  knockout?: ColorValue;
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
  // reply'ın yatay aynası — iletme yönü sağa bakar.
  forward: ["m15 17 5-5-5-5", "M4 18v-2a4 4 0 0 1 4-4h12"],
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
  clock: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M12 6v6l4 2"],
  dog: [
    "M11.25 16.25h1.5L12 17z",
    "M16 14v.5",
    "M8 14v.5",
    "M4.42 11.25A13.15 13.15 0 0 0 4 14.56C4 18.73 7.58 21 12 21s8-2.27 8-6.44a11.7 11.7 0 0 0-.49-3.31",
    "M8.5 8.5c-.38 1.05-1.08 2.03-2.34 2.5-1.93.72-3.58-.3-3.66-1-.11-.99 1.18-6.53 4-7 1.92-.32 3.65.85 3.65 2.24A7.5 7.5 0 0 1 14 5.28c0-1.39 1.84-2.6 3.77-2.28 2.82.47 4.11 6.01 4 7-.08.7-1.73 1.72-3.66 1-1.26-.47-1.86-1.45-2.24-2.5",
  ],
  utensils: [
    "M16 2l-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8",
    "M15 15L3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15zm0 0l7 7",
    "M2.1 21.8l6.4-6.3",
    "M19 5l-7 7",
  ],
  gamepad: [
    "M6 11h4",
    "M8 9v4",
    "M15 12h.01",
    "M18 10h.01",
    "M17.32 5H6.68a4 4 0 0 0-3.98 3.59l-.02.15C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26l-.02-.15A4 4 0 0 0 17.32 5z",
  ],
  plane: [
    "M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  ],
  lightbulb: [
    "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
    "M9 18h6",
    "M10 22h4",
  ],
  heart: [
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
  ],
  pin: [
    "M12 17v5",
    "M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
  ],
  "pin-off": [
    "M12 17v5",
    "M15 9.3V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.9",
    "M9 9v1.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h11",
    "M2 2l20 20",
  ],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  folder: ["M3 5.5A1.5 1.5 0 0 1 4.5 4H9l2 2h8.5A1.5 1.5 0 0 1 21 7.5v10A2.5 2.5 0 0 1 18.5 20h-14A2.5 2.5 0 0 1 2 17.5v-12z"],
  more: [],
  palette: [
    "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22z",
    "M7.5 11h.01",
    "M10.5 7h.01",
    "M15.5 7.5h.01",
  ],
  sparkles: [
    "M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z",
    "M19 3v4",
    "M21 5h-4",
    "M18 16v3",
    "M19.5 17.5h-3",
  ],
  monitor: ["M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M8 20h8", "M12 16v4"],
  "rotate-ccw": ["M3 12a9 9 0 1 0 2.6-6.4L3 8", "M3 3v5h5"],
  mic: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  "mic-off": [
    "M15 9.3V5a3 3 0 0 0-5.7-1.3",
    "M9 9v3a3 3 0 0 0 5.1 2.1",
    "M18.9 12.9A7 7 0 0 0 19 12v-2",
    "M5 10v2a7 7 0 0 0 12 5",
    "M12 19v3",
    "M2 2l20 20",
  ],
  copy: [
    "M9 11a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z",
    "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  ],
  trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  "eye-off": [
    "M9.9 4.2A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.7 2.7",
    "M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6",
    "M9.9 9.9a3 3 0 0 0 4.2 4.2",
    "M2 2l20 20",
  ],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  play: ["M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  image: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M9 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
    "m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21",
  ],
  camera: [
    "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z",
    "M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  ],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  "phone-off": [
    "M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-3.3-2.6",
    "M5.1 13.3A19.8 19.8 0 0 1 2 4.7 2 2 0 0 1 4.1 2.7h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1L8.1 10.6",
    "M22 2 2 22",
  ],
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
  knockout,
}: IconProps) {
  const paths = PATHS[name];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={filled && index > 0 && knockout ? knockout : color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Dolu varyantta yalnızca ilk (dış hat) yol boyanır; iç detaylar
          // (ör. pusula iğnesi) zemin renginde çizilir ki dolguda görünsün.
          fill={filled && index === 0 ? color : filled && knockout ? knockout : "none"}
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
