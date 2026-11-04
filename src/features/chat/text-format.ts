/**
 * Yazı kutusu biçimlendirmesi — web `components/chat/v2/input/formatting-toolbar.tsx`
 * düğmelerinin Markdown karşılığı. Web editörü (TipTap) seçimi işaretler ve
 * gönderirken Markdown'a çevirir; telefonda yazı kutusu düz metin, işaretler
 * doğrudan seçimin çevresine yazılır. Aynı düğmeye yeniden basmak işareti kaldırır.
 */

export type TextFormat = "bold" | "italic" | "underline" | "strike" | "spoiler" | "heading" | "quote" | "code" | "codeBlock";

export interface FormatResult {
  value: string;
  start: number;
  end: number;
}

/** Düğme sırası ve etiketleri web ile aynı. */
export const TEXT_FORMATS: { id: TextFormat; label: string; glyph: string }[] = [
  { id: "bold", label: "Kalın", glyph: "B" },
  { id: "italic", label: "İtalik", glyph: "I" },
  { id: "underline", label: "Altı Çizili", glyph: "U" },
  { id: "strike", label: "Üstü Çizili", glyph: "S" },
  { id: "spoiler", label: "Spoiler", glyph: "||" },
  { id: "heading", label: "Başlık", glyph: "H" },
  { id: "quote", label: "Alıntı", glyph: "❝" },
  { id: "code", label: "Kod", glyph: "{}" },
  { id: "codeBlock", label: "Kod Bloğu", glyph: "</>" },
];

const WRAP: Partial<Record<TextFormat, string>> = {
  bold: "**",
  italic: "*",
  underline: "__",
  strike: "~~",
  spoiler: "||",
  code: "`",
};

/** `*` italik ile `**` kalını ayırır: işaretin hemen dışında aynı karakter varsa (ve üçlü değilse) başka bir biçimdir. */
function hasMarker(value: string, start: number, end: number, marker: string): boolean {
  if (value.slice(start - marker.length, start) !== marker || value.slice(end, end + marker.length) !== marker) return false;
  if (marker.length === 1) {
    const ch = marker;
    const beforeRun = runLength(value, start - 1, -1, ch);
    const afterRun = runLength(value, end, 1, ch);
    // `*x*` ve `***x***` italiktir; `**x**` değildir.
    return beforeRun % 2 === 1 && afterRun % 2 === 1;
  }
  return true;
}

function runLength(value: string, from: number, step: 1 | -1, ch: string): number {
  let n = 0;
  for (let i = from; i >= 0 && i < value.length && value[i] === ch; i += step) n += 1;
  return n;
}

function lineBounds(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
  return { from, to: nl === -1 ? value.length : nl };
}

function togglePrefix(value: string, start: number, end: number, prefix: string, matcher: RegExp): FormatResult {
  const { from, to } = lineBounds(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const all = lines.every((line) => matcher.test(line));
  const next = lines.map((line) => (all ? line.replace(matcher, "") : `${prefix}${line.replace(matcher, "")}`)).join("\n");
  const out = value.slice(0, from) + next + value.slice(to);
  return { value: out, start: from, end: from + next.length };
}

/**
 * Seçime biçimi uygular ya da (zaten varsa) kaldırır. Seçim boşsa işaretler
 * imlece eklenir ve imleç aralarına konur — yazmaya devam edilir.
 */
export function applyTextFormat(value: string, rawStart: number, rawEnd: number, format: TextFormat): FormatResult {
  const start = Math.max(0, Math.min(rawStart, rawEnd, value.length));
  const end = Math.min(value.length, Math.max(rawStart, rawEnd));

  if (format === "heading") return togglePrefix(value, start, end, "# ", /^#{1,3} /);
  if (format === "quote") return togglePrefix(value, start, end, "> ", /^> ?/);

  if (format === "codeBlock") {
    const open = "```\n";
    const close = "\n```";
    if (value.slice(start - open.length, start) === open && value.slice(end, end + close.length) === close) {
      return {
        value: value.slice(0, start - open.length) + value.slice(start, end) + value.slice(end + close.length),
        start: start - open.length,
        end: end - open.length,
      };
    }
    const selected = value.slice(start, end);
    return { value: value.slice(0, start) + open + selected + close + value.slice(end), start: start + open.length, end: end + open.length };
  }

  const marker = WRAP[format]!;
  if (hasMarker(value, start, end, marker)) {
    return {
      value: value.slice(0, start - marker.length) + value.slice(start, end) + value.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }
  const selected = value.slice(start, end);
  // Seçimin içi zaten işaretliyse (`**x**` seçilmiş) dış işaretler kaldırılır.
  if (selected.length >= marker.length * 2 + 1 && selected.startsWith(marker) && selected.endsWith(marker) && hasMarker(value, start + marker.length, end - marker.length, marker)) {
    const inner = selected.slice(marker.length, -marker.length);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  return {
    value: value.slice(0, start) + marker + selected + marker + value.slice(end),
    start: start + marker.length,
    end: end + marker.length,
  };
}
