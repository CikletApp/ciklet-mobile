import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { Icon } from "@/components/ui";
import {
  EULA_EFFECTIVE_DATE,
  EULA_INTRO,
  EULA_KICKER,
  EULA_SECTIONS,
  EULA_TITLE,
  EULA_VERSION,
  PRIVACY_SECTION_INDEX,
  type LegalSection,
  type LegalSpan,
} from "@/features/auth/legal";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sözleşme metninin görünümü.
 *
 * Hem onay kapısı (`app/(eula)/accept.tsx`) hem salt-okunur görüntüleyici
 * (`app/legal/document.tsx`) bu bileşeni kullanır. İki ekranın metni ayrı
 * ayrı render etmesi, birinde güncellenip diğerinde unutulan bir madde
 * demek olurdu.
 *
 * `onReachedEnd` yalnızca onay kapısında anlamlı: web'deki gibi "Kabul Et"
 * düğmesi belge sonuna kadar kaydırılmadan etkinleşmiyor.
 */

export interface LegalDocumentHandle {
  scrollToSection: (index: number) => void;
  scrollToPrivacy: () => void;
}

interface LegalDocumentProps {
  /** Belge sonuna ulaşıldığında bir kez tetiklenir. */
  onReachedEnd?: () => void;
  /** Onay kapısında intro paragrafı gösterilir, salt okuma modunda gizlenir. */
  showIntro?: boolean;
  contentPaddingBottom?: number;
}

/** Sonuna kaç piksel kala "okundu" sayılır. Web'de de 40. */
const END_THRESHOLD = 40;

export const LegalDocument = forwardRef<LegalDocumentHandle, LegalDocumentProps>(
  function LegalDocument({ onReachedEnd, showIntro = true, contentPaddingBottom }, ref) {
    const scrollRef = useRef<ScrollView>(null);
    const sectionOffsets = useRef<number[]>([]);
    const reachedEnd = useRef(false);

    useImperativeHandle(ref, () => ({
      scrollToSection: (index: number) => {
        const y = sectionOffsets.current[index];
        if (y === undefined) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
      },
      scrollToPrivacy: () => {
        const y = sectionOffsets.current[PRIVACY_SECTION_INDEX];
        if (y === undefined) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
      },
    }));

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!onReachedEnd || reachedEnd.current) return;
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceToEnd =
          contentSize.height - contentOffset.y - layoutMeasurement.height;
        if (distanceToEnd < END_THRESHOLD) {
          reachedEnd.current = true;
          onReachedEnd();
        }
      },
      [onReachedEnd]
    );

    /**
     * Metin ekrandan KISAYSA kaydırma olayı hiç tetiklenmez ve "sonuna kadar
     * oku" koşulu asla sağlanmaz — kabul düğmesi sonsuza kadar kapalı kalır.
     * Büyük ekranlarda (tablet, yatay mod) gerçek bir kilitlenme. İçerik ve
     * görünüm yüksekliği bilinir bilinmez karşılaştırılır.
     */
    const contentHeight = useRef(0);
    const viewportHeight = useRef(0);

    const settleIfNotScrollable = useCallback(() => {
      if (!onReachedEnd || reachedEnd.current) return;
      if (contentHeight.current <= 0 || viewportHeight.current <= 0) return;
      if (contentHeight.current <= viewportHeight.current + END_THRESHOLD) {
        reachedEnd.current = true;
        onReachedEnd();
      }
    }, [onReachedEnd]);

    const handleContentSizeChange = useCallback(
      (_width: number, height: number) => {
        contentHeight.current = height;
        settleIfNotScrollable();
      },
      [settleIfNotScrollable]
    );

    return (
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={64}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          settleIfNotScrollable();
        }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: contentPaddingBottom ?? spacing["2xl"],
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.md,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.bentoBorder,
                backgroundColor: colors.bento,
              }}
            >
              <Icon name="shield" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.overline, color: colors.accent }}>{EULA_KICKER}</Text>
              <Text style={{ ...typography.title, color: colors.bright }}>{EULA_TITLE}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>v{EULA_VERSION}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {EULA_EFFECTIVE_DATE}
              </Text>
            </View>
          </View>

          {showIntro ? (
            <Text style={{ ...typography.body, color: colors.muted }}>
              <Spans spans={EULA_INTRO} />
            </Text>
          ) : null}
        </View>

        {EULA_SECTIONS.map((section, index) => (
          <View
            key={section.heading}
            onLayout={(event) => {
              sectionOffsets.current[index] = event.nativeEvent.layout.y;
            }}
          >
            <Section section={section} />
          </View>
        ))}
      </ScrollView>
    );
  }
);

function Section({ section }: { section: LegalSection }) {
  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.bento,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.bento,
      }}
    >
      <Text style={{ ...typography.overline, color: colors.accent }}>{section.heading}</Text>

      {section.paragraphs?.map((spans, index) => (
        <Text key={index} style={{ ...typography.body, color: colors.text }}>
          <Spans spans={spans} />
        </Text>
      ))}

      {section.bullets?.map((bullet) => (
        <View
          key={bullet.title}
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.deep,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              marginTop: 6,
              borderRadius: radii.full,
              backgroundColor: colors.accent,
            }}
          />
          <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
              {bullet.title}:
            </Text>{" "}
            {bullet.body}
          </Text>
        </View>
      ))}

      {section.callout ? (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radii.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.accent,
            backgroundColor: colors.bubbleOther,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.bright }}>{section.callout}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Kalın vurgulu parçaları olan paragraf. */
function Spans({ spans }: { spans: LegalSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        typeof span === "string" ? (
          <Text key={index}>{span}</Text>
        ) : (
          <Text key={index} style={{ ...typography.bodyStrong, color: colors.bright }}>
            {span.bold}
          </Text>
        )
      )}
    </>
  );
}
