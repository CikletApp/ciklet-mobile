import { Text, View } from "react-native";

import { colors } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { Avatar } from "./avatar";

/**
 * Grup sohbeti avatarı — web (`components/directs/group-avatar.tsx`) ile aynı
 * düzen: grubun görseli varsa o; yoksa en çok üç üyenin avatarı yuvarlak
 * çerçevenin içinde yan yana (2) ya da üçgen (3) yerleşir, her biri zemin
 * renginde ince bir halkayla ayrılır. Tek üye kalmışsa onun avatarı, hiç
 * üye yoksa "G".
 */

export interface GroupAvatarMember {
  id: string;
  username: string;
  name?: string | null;
  imageUrl?: string | null;
}

interface GroupAvatarProps {
  members: GroupAvatarMember[];
  /** Önce diğerleri görünsün: bu kimlik (oturum sahibi) sona alınır. */
  excludeId?: string | null;
  imageUrl?: string | null;
  name: string;
  size?: number;
  /** Köşe yarıçapı; verilmezse tam yuvarlak. */
  radius?: number;
  /** Avatarın oturduğu zemin — iç halkalar bununla çizilir. */
  backgroundColor?: string;
}

/** Web ile aynı oranlar: 2 üye yan yana, 3 üye üçgen; iç avatar %58. */
const POSITIONS: Record<2 | 3, [number, number][]> = {
  2: [
    [-0.02, 0.22],
    [0.45, 0.22],
  ],
  3: [
    [0.23, -0.04],
    [-0.01, 0.45],
    [0.48, 0.45],
  ],
};

export function GroupAvatar({
  members,
  excludeId,
  imageUrl,
  name,
  size = 56,
  radius,
  backgroundColor = colors.bg,
}: GroupAvatarProps) {
  const borderRadius = radius ?? size / 2;

  if (imageUrl) {
    return (
      <Avatar
        imageUrl={imageUrl}
        fallbackText={name}
        size={size}
        radius={borderRadius}
        backgroundColor={backgroundColor}
      />
    );
  }

  const ordered = excludeId
    ? [...members.filter((m) => m.id !== excludeId), ...members.filter((m) => m.id === excludeId)]
    : members;
  const visible = ordered.slice(0, 3);

  if (visible.length === 0) {
    return (
      <View
        accessibilityLabel={name}
        style={{
          width: size,
          height: size,
          borderRadius,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.raised,
        }}
      >
        <Text style={{ fontSize: Math.round(size * 0.34), ...fw(700), color: colors.text }}>G</Text>
      </View>
    );
  }

  if (visible.length === 1) {
    const only = visible[0];
    return (
      <Avatar
        profileId={only.id}
        imageUrl={only.imageUrl}
        fallbackText={only.name || only.username}
        size={size}
        radius={borderRadius}
        backgroundColor={backgroundColor}
      />
    );
  }

  const positions = POSITIONS[visible.length === 2 ? 2 : 3];
  const inner = Math.round(size * 0.58);
  const ring = Math.max(2, Math.round(size * 0.035));

  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        backgroundColor: colors.raised,
      }}
    >
      {visible.map((member, index) => (
        <View
          key={member.id}
          style={{
            position: "absolute",
            left: Math.round(positions[index][0] * size),
            top: Math.round(positions[index][1] * size),
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            borderWidth: ring,
            borderColor: backgroundColor,
            overflow: "hidden",
          }}
        >
          <Avatar
            profileId={member.id}
            imageUrl={member.imageUrl}
            fallbackText={member.name || member.username}
            size={inner - ring * 2}
            backgroundColor={backgroundColor}
          />
        </View>
      ))}
    </View>
  );
}
