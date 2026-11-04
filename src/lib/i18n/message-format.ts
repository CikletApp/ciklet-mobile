/**
 * Web `lib/i18n/message-format.ts` ile AYNI (kopya) — web değişirse burası da.
 */
/**
 * Mesaj biçimi — `{ad}` değişkenleri ve ICU çoğul sözdizimi:
 *
 *   "{count, plural, one {# mesaj} other {# mesaj}}"
 *   "{count, plural, =0 {Hiç yok} one {# member} other {# members}}"
 *
 * Kategoriler dilin `Intl.PluralRules` kurallarından gelir (zero, one, two,
 * few, many, other); `=N` tam eşleşme önce denenir, bulunamazsa `other`.
 * Dal içinde `#` sayının dile göre biçimlenmiş hâlidir; dal içinde başka
 * `{ad}` değişkenleri de kullanılabilir. Bağımlılıksız (istemci paketine
 * ICU kütüphanesi girmesin diye).
 */
export type MessageVars = Record<string, string | number>;

const PLURAL_RULES = new Map<string, Intl.PluralRules>();
const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>();

function pluralRules(tag: string): Intl.PluralRules {
  let rules = PLURAL_RULES.get(tag);
  if (!rules) {
    rules = new Intl.PluralRules(tag);
    PLURAL_RULES.set(tag, rules);
  }
  return rules;
}

function numberFormat(tag: string): Intl.NumberFormat {
  let format = NUMBER_FORMATS.get(tag);
  if (!format) {
    format = new Intl.NumberFormat(tag);
    NUMBER_FORMATS.set(tag, format);
  }
  return format;
}

/** `text[open]` === "{" için eşleşen "}" konumu; dengesizse -1. */
function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const PLURAL_HEAD = /^\s*(\w+)\s*,\s*plural\s*,/;
const BRANCH_KEY = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/;

export interface PluralBlock {
  variable: string;
  branches: Record<string, string>;
}

/** Çoğul gövdesini (`one {…} other {…}`) dallarına ayırır; bozuksa null. */
function parseBranches(body: string): Record<string, string> | null {
  const branches: Record<string, string> = {};
  let rest = body;
  while (rest.trim()) {
    const key = BRANCH_KEY.exec(rest);
    if (!key) return null;
    const open = key[0].length - 1;
    const close = matchingBrace(rest, open);
    if (close < 0) return null;
    branches[key[1]] = rest.slice(open + 1, close);
    rest = rest.slice(close + 1);
  }
  return Object.keys(branches).length ? branches : null;
}

function parsePlural(inner: string): PluralBlock | null {
  const head = PLURAL_HEAD.exec(inner);
  if (!head) return null;
  const branches = parseBranches(inner.slice(head[0].length));
  return branches ? { variable: head[1], branches } : null;
}

function selectBranch(block: PluralBlock, value: string | number, tag: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(n)) {
    const exact = block.branches[`=${n}`];
    if (exact !== undefined) return exact;
    const category = pluralRules(tag).select(n);
    const branch = block.branches[category];
    if (branch !== undefined) return branch;
  }
  return block.branches.other ?? Object.values(block.branches)[0] ?? "";
}

/**
 * Metni değişkenlerle doldurur. Verilmeyen değişken `{ad}` olarak kalır
 * (eski davranış); çoğul bloğunun değişkeni yoksa blok olduğu gibi kalır.
 */
export function formatMessage(text: string, vars: MessageVars | undefined, tag: string): string {
  if (!vars || !text.includes("{")) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, open);
    const close = matchingBrace(text, open);
    if (close < 0) {
      out += text.slice(open);
      break;
    }
    const inner = text.slice(open + 1, close);
    const raw = text.slice(open, close + 1);
    if (/^\w+$/.test(inner)) {
      out += inner in vars ? String(vars[inner]) : raw;
    } else {
      const block = parsePlural(inner);
      if (block && block.variable in vars) {
        const value = vars[block.variable];
        const shown = typeof value === "number" ? numberFormat(tag).format(value) : String(value);
        const branch = selectBranch(block, value, tag).replace(/#/g, shown);
        out += formatMessage(branch, vars, tag);
      } else {
        out += raw;
      }
    }
    i = close + 1;
  }
  return out;
}

/**
 * Metnin kullandığı değişken adları (çoğul değişkenleri ve dal içindekiler
 * dahil). Diller arası yer tutucu eşitliği testinde kullanılır.
 */
export function messageVariables(text: string): Set<string> {
  const found = new Set<string>();
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i);
      if (open < 0) return;
      const close = matchingBrace(s, open);
      if (close < 0) return;
      const inner = s.slice(open + 1, close);
      if (/^\w+$/.test(inner)) found.add(inner);
      else {
        const block = parsePlural(inner);
        if (block) {
          found.add(block.variable);
          for (const branch of Object.values(block.branches)) walk(branch);
        }
      }
      i = close + 1;
    }
  };
  walk(text);
  return found;
}

/** Metindeki çoğul blokları (test: her dilde gereken kategoriler var mı). */
export function pluralBlocks(text: string): PluralBlock[] {
  const blocks: PluralBlock[] = [];
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i);
      if (open < 0) return;
      const close = matchingBrace(s, open);
      if (close < 0) return;
      const block = parsePlural(s.slice(open + 1, close));
      if (block) {
        blocks.push(block);
        for (const branch of Object.values(block.branches)) walk(branch);
      }
      i = close + 1;
    }
  };
  walk(text);
  return blocks;
}
