/**
 * ciklet-web `src/lib/automod-regex.ts` ile AYNI — iki tarafta birlikte değişmeli.
 *
 * AutoMod düzenli ifadeleri — GÜVENLİ, doğrusal zamanlı eşleştirici.
 *
 * Discord AutoMod kuralları Rust `regex` sözdizimini kabul eder; Rust motoru
 * geri izleme (backtracking) yapmaz, dolayısıyla `(a+)+$` gibi "felaket"
 * desenler ona zarar veremez. JavaScript'in `RegExp`'i geri izler: kullanıcı
 * girdisi bir desen sunucuyu dakikalarca kilitleyebilirdi (ReDoS). Bu yüzden
 * desenler `RegExp`'e HİÇ verilmez; burada küçük bir Thompson NFA'sına
 * derlenip Pike VM ile çalıştırılır — süre metin uzunluğu × program boyuyla
 * sınırlı (O(n·m)), desen ne olursa olsun.
 *
 * Desteklenen (Rust alt kümesi): düz karakterler, `.`, `[...]` / `[^...]`
 * (aralık ve kaçışlarla), `\d \D \w \W \s \S`, `\p{L} \p{N}` (ve `\P`),
 * `\b \B`, `^ $`, gruplar `( )`, `(?: )`, adlı gruplar `(?P<ad> )`,
 * `(?<ad> )`, `(?i)`, `|`, nicelik `* + ? {n} {n,} {n,m}` (tembel `?` ekiyle
 * de — sonuç aynı). Rust'ta da olmayanlar REDDEDİLİR: geri başvuru (`\1`),
 * ileri/geri bakış (`(?=`, `(?!`, `(?<=`, `(?<!`).
 *
 * Eşleşme her zaman büyük/küçük harf duyarsızdır (Discord gibi).
 *
 * Sınırlar: desen en çok 260 karakter (Discord), derlenmiş program en çok
 * 1000 komut; metin en çok 4000 kod noktası taranır.
 */

export const AUTOMOD_REGEX_MAX_LENGTH = 260;
export const AUTOMOD_REGEX_MAX_PROGRAM = 1000;
export const AUTOMOD_REGEX_MAX_REPEAT = 1000;
export const AUTOMOD_REGEX_MAX_TEXT = 4000;

type Pred = (ch: string) => boolean;

type Node =
  | { t: "char"; pred: Pred }
  | { t: "cat"; items: Node[] }
  | { t: "alt"; items: Node[] }
  | { t: "rep"; node: Node; min: number; max: number | null }
  | { t: "assert"; kind: "start" | "end" | "word" | "nonword" }
  | { t: "empty" };

export class AutomodRegexError extends Error {}

const WORD_RE = /[\p{L}\p{N}_]/u;
const DIGIT_RE = /\p{Nd}/u;
const SPACE_RE = /\s/u;
const LETTER_RE = /\p{L}/u;
const NUMBER_RE = /\p{N}/u;

const isWord = (ch: string) => WORD_RE.test(ch);

/** Büyük/küçük harf duyarsız tek karakter karşılaştırması (Türkçe İ/ı dahil). */
function caseVariants(ch: string): string[] {
  const out = new Set<string>([ch, ch.toLowerCase(), ch.toUpperCase(), ch.toLocaleLowerCase("tr-TR"), ch.toLocaleUpperCase("tr-TR")]);
  return [...out].filter((c) => Array.from(c).length === 1);
}

function literalPred(ch: string): Pred {
  const variants = new Set(caseVariants(ch));
  return (c) => variants.has(c) || caseVariants(c).some((v) => variants.has(v));
}

class Parser {
  private readonly chars: string[];
  private i = 0;

  constructor(pattern: string) {
    this.chars = Array.from(pattern);
  }

  parse(): Node {
    const node = this.alt();
    if (this.i < this.chars.length) throw new AutomodRegexError("Eşleşmeyen ')'.");
    return node;
  }

  private peek(): string | undefined {
    return this.chars[this.i];
  }

  private eat(ch: string): boolean {
    if (this.chars[this.i] === ch) {
      this.i += 1;
      return true;
    }
    return false;
  }

  private alt(): Node {
    const items: Node[] = [this.cat()];
    while (this.eat("|")) items.push(this.cat());
    return items.length === 1 ? items[0] : { t: "alt", items };
  }

  private cat(): Node {
    const items: Node[] = [];
    while (this.i < this.chars.length && this.peek() !== "|" && this.peek() !== ")") {
      const atom = this.atom();
      if (atom) items.push(this.quantified(atom));
    }
    if (items.length === 0) return { t: "empty" };
    return items.length === 1 ? items[0] : { t: "cat", items };
  }

  private quantified(atom: Node): Node {
    let node = atom;
    for (;;) {
      const ch = this.peek();
      let min: number;
      let max: number | null;
      if (ch === "*") {
        this.i += 1;
        min = 0;
        max = null;
      } else if (ch === "+") {
        this.i += 1;
        min = 1;
        max = null;
      } else if (ch === "?") {
        this.i += 1;
        min = 0;
        max = 1;
      } else if (ch === "{" && this.looksLikeCounted()) {
        [min, max] = this.counted();
      } else {
        return node;
      }
      if (node.t === "assert") throw new AutomodRegexError("Bir sınır işareti yinelenemez.");
      // Tembel nicelik (`*?`) eşleşip eşleşmeme sonucunu değiştirmez.
      this.eat("?");
      node = { t: "rep", node, min, max };
    }
  }

  private looksLikeCounted(): boolean {
    let j = this.i + 1;
    let digits = 0;
    while (j < this.chars.length && /[0-9]/.test(this.chars[j])) {
      j += 1;
      digits += 1;
    }
    return digits > 0;
  }

  private number(): number {
    let s = "";
    while (this.i < this.chars.length && /[0-9]/.test(this.chars[this.i])) {
      s += this.chars[this.i];
      this.i += 1;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n > AUTOMOD_REGEX_MAX_REPEAT) throw new AutomodRegexError(`Yineleme sayısı en çok ${AUTOMOD_REGEX_MAX_REPEAT} olabilir.`);
    return n;
  }

  private counted(): [number, number | null] {
    this.i += 1; // {
    const min = this.number();
    let max: number | null = min;
    if (this.eat(",")) {
      max = /[0-9]/.test(this.peek() ?? "") ? this.number() : null;
    }
    if (!this.eat("}")) throw new AutomodRegexError("Kapanmamış '{'.");
    if (max !== null && max < min) throw new AutomodRegexError("Geçersiz yineleme aralığı.");
    return [min, max];
  }

  private atom(): Node | null {
    const ch = this.chars[this.i];
    this.i += 1;
    switch (ch) {
      case "(":
        return this.group();
      case "[":
        return { t: "char", pred: this.charClass() };
      case ".":
        return { t: "char", pred: (c) => c !== "\n" };
      case "^":
        return { t: "assert", kind: "start" };
      case "$":
        return { t: "assert", kind: "end" };
      case "\\":
        return this.escape(false);
      case "*":
      case "+":
      case "?":
        throw new AutomodRegexError("Niceliğin önünde bir şey yok.");
      case "{":
        // Rust'ta yalnız `{` düz karakter değil; açıkça hata.
        throw new AutomodRegexError("Kaçışsız '{'.");
      default:
        return { t: "char", pred: literalPred(ch) };
    }
  }

  private group(): Node | null {
    if (this.eat("?")) {
      const next = this.peek();
      if (next === ":") {
        this.i += 1;
      } else if (next === "P" || (next === "<" && this.chars[this.i + 1] !== "=" && this.chars[this.i + 1] !== "!")) {
        // Adlı grup: (?P<ad>...) ya da (?<ad>...)
        if (next === "P") this.i += 1;
        if (!this.eat("<")) throw new AutomodRegexError("Geçersiz adlı grup.");
        while (this.i < this.chars.length && this.peek() !== ">") this.i += 1;
        if (!this.eat(">")) throw new AutomodRegexError("Geçersiz adlı grup.");
      } else if (next === "=" || next === "!" || next === "<") {
        throw new AutomodRegexError("İleri/geri bakış desteklenmiyor (Rust regex'te de yok).");
      } else {
        // Satır içi bayraklar: yalnızca i (zaten açık), m, s, x yok sayılmaz → hata.
        let flags = "";
        while (this.i < this.chars.length && /[a-zA-Z-]/.test(this.peek() ?? "")) {
          flags += this.peek();
          this.i += 1;
        }
        if (!/^-?i$/.test(flags)) throw new AutomodRegexError("Yalnızca (?i) bayrağı destekleniyor.");
        if (this.eat(")")) return null;
        if (!this.eat(":")) throw new AutomodRegexError("Geçersiz bayrak grubu.");
      }
    }
    const inner = this.alt();
    if (!this.eat(")")) throw new AutomodRegexError("Kapanmamış '('.");
    return inner;
  }

  private escapePred(ch: string): Pred | null {
    switch (ch) {
      case "d":
        return (c) => DIGIT_RE.test(c);
      case "D":
        return (c) => !DIGIT_RE.test(c);
      case "w":
        return isWord;
      case "W":
        return (c) => !isWord(c);
      case "s":
        return (c) => SPACE_RE.test(c);
      case "S":
        return (c) => !SPACE_RE.test(c);
      default:
        return null;
    }
  }

  private unicodeClass(negated: boolean): Pred {
    let name = "";
    if (this.eat("{")) {
      while (this.i < this.chars.length && this.peek() !== "}") {
        name += this.peek();
        this.i += 1;
      }
      if (!this.eat("}")) throw new AutomodRegexError("Kapanmamış \\p{…}.");
    } else {
      name = this.chars[this.i] ?? "";
      this.i += 1;
    }
    let re: RegExp;
    if (name === "L" || name === "Letter") re = LETTER_RE;
    else if (name === "N" || name === "Number") re = NUMBER_RE;
    else throw new AutomodRegexError("Yalnızca \\p{L} ve \\p{N} destekleniyor.");
    return negated ? (c) => !re.test(c) : (c) => re.test(c);
  }

  private escape(inClass: boolean): Node {
    const ch = this.chars[this.i];
    if (ch === undefined) throw new AutomodRegexError("Desen '\\' ile bitemez.");
    this.i += 1;
    const pred = this.escapePred(ch);
    if (pred) return { t: "char", pred };
    if (ch === "p" || ch === "P") return { t: "char", pred: this.unicodeClass(ch === "P") };
    if (!inClass && ch === "b") return { t: "assert", kind: "word" };
    if (!inClass && ch === "B") return { t: "assert", kind: "nonword" };
    if (/[0-9]/.test(ch)) throw new AutomodRegexError("Geri başvuru desteklenmiyor (Rust regex'te de yok).");
    if (ch === "n") return { t: "char", pred: (c) => c === "\n" };
    if (ch === "t") return { t: "char", pred: (c) => c === "\t" };
    if (ch === "r") return { t: "char", pred: (c) => c === "\r" };
    if (/[a-zA-Z]/.test(ch)) throw new AutomodRegexError(`Desteklenmeyen kaçış: \\${ch}`);
    return { t: "char", pred: literalPred(ch) };
  }

  private classAtom(): { pred: Pred; literal: string | null } {
    const ch = this.chars[this.i];
    if (ch === undefined) throw new AutomodRegexError("Kapanmamış '['.");
    this.i += 1;
    if (ch === "\\") {
      const node = this.escape(true);
      if (node.t !== "char") throw new AutomodRegexError("Geçersiz sınıf kaçışı.");
      const prev = this.chars[this.i - 1];
      const literal = /[a-zA-Z0-9]/.test(prev) ? null : prev;
      return { pred: node.pred, literal };
    }
    return { pred: literalPred(ch), literal: ch };
  }

  private charClass(): Pred {
    const negated = this.eat("^");
    const preds: Pred[] = [];
    let first = true;
    while (this.i < this.chars.length && (this.peek() !== "]" || first)) {
      first = false;
      if (this.peek() === "[") throw new AutomodRegexError("İç içe karakter sınıfı desteklenmiyor.");
      const start = this.classAtom();
      if (this.peek() === "-" && this.chars[this.i + 1] !== undefined && this.chars[this.i + 1] !== "]") {
        this.i += 1; // -
        const end = this.classAtom();
        if (start.literal === null || end.literal === null) throw new AutomodRegexError("Geçersiz karakter aralığı.");
        const lo = start.literal.codePointAt(0) ?? 0;
        const hi = end.literal.codePointAt(0) ?? 0;
        if (hi < lo) throw new AutomodRegexError("Geçersiz karakter aralığı.");
        preds.push((c) => caseVariants(c).some((v) => {
          const cp = v.codePointAt(0) ?? -1;
          return cp >= lo && cp <= hi;
        }));
      } else {
        preds.push(start.pred);
      }
    }
    if (!this.eat("]")) throw new AutomodRegexError("Kapanmamış '['.");
    return negated ? (c) => !preds.some((p) => p(c)) : (c) => preds.some((p) => p(c));
  }
}

// ── Derleme (Thompson) ───────────────────────────────────────────────────

type Inst =
  | { op: "char"; pred: Pred }
  | { op: "split"; x: number; y: number }
  | { op: "jmp"; x: number }
  | { op: "assert"; kind: "start" | "end" | "word" | "nonword" }
  | { op: "match" };

class Compiler {
  readonly prog: Inst[] = [];

  private emit(inst: Inst): number {
    if (this.prog.length >= AUTOMOD_REGEX_MAX_PROGRAM) throw new AutomodRegexError("Desen çok karmaşık.");
    this.prog.push(inst);
    return this.prog.length - 1;
  }

  compile(node: Node): void {
    switch (node.t) {
      case "empty":
        return;
      case "char":
        this.emit({ op: "char", pred: node.pred });
        return;
      case "assert":
        this.emit({ op: "assert", kind: node.kind });
        return;
      case "cat":
        for (const item of node.items) this.compile(item);
        return;
      case "alt": {
        const jumps: number[] = [];
        for (let k = 0; k < node.items.length; k += 1) {
          if (k < node.items.length - 1) {
            const split = this.emit({ op: "split", x: 0, y: 0 });
            (this.prog[split] as { x: number }).x = this.prog.length;
            this.compile(node.items[k]);
            jumps.push(this.emit({ op: "jmp", x: 0 }));
            (this.prog[split] as { y: number }).y = this.prog.length;
          } else {
            this.compile(node.items[k]);
          }
        }
        for (const j of jumps) (this.prog[j] as { x: number }).x = this.prog.length;
        return;
      }
      case "rep": {
        for (let k = 0; k < node.min; k += 1) this.compile(node.node);
        if (node.max === null) {
          // x* : L1: split L2, L3; L2: x; jmp L1; L3:
          const split = this.emit({ op: "split", x: 0, y: 0 });
          (this.prog[split] as { x: number }).x = this.prog.length;
          this.compile(node.node);
          this.emit({ op: "jmp", x: split });
          (this.prog[split] as { y: number }).y = this.prog.length;
        } else {
          const splits: number[] = [];
          for (let k = node.min; k < node.max; k += 1) {
            const split = this.emit({ op: "split", x: 0, y: 0 });
            (this.prog[split] as { x: number }).x = this.prog.length;
            splits.push(split);
            this.compile(node.node);
          }
          for (const s of splits) (this.prog[s] as { y: number }).y = this.prog.length;
        }
        return;
      }
    }
  }
}

export interface CompiledRegex {
  readonly source: string;
  readonly prog: readonly Inst[];
}

/** Deseni derler; geçersiz/güvensizse AutomodRegexError (Türkçe ileti). */
export function compileAutomodRegex(pattern: string): CompiledRegex {
  if (typeof pattern !== "string" || !pattern.trim()) throw new AutomodRegexError("Desen boş olamaz.");
  if (Array.from(pattern).length > AUTOMOD_REGEX_MAX_LENGTH) throw new AutomodRegexError(`Desen en çok ${AUTOMOD_REGEX_MAX_LENGTH} karakter olabilir.`);
  const ast = new Parser(pattern).parse();
  const compiler = new Compiler();
  compiler.compile(ast);
  compiler.prog.push({ op: "match" });
  return { source: pattern, prog: compiler.prog };
}

/** Geçerliyse null, değilse hata metni. */
export function validateAutomodRegex(pattern: string): string | null {
  try {
    compileAutomodRegex(pattern);
    return null;
  } catch (error) {
    return error instanceof AutomodRegexError ? error.message : "Desen geçersiz.";
  }
}

function assertHolds(kind: "start" | "end" | "word" | "nonword", chars: readonly string[], pos: number): boolean {
  if (kind === "start") return pos === 0;
  if (kind === "end") return pos === chars.length;
  const before = pos > 0 && isWord(chars[pos - 1]);
  const after = pos < chars.length && isWord(chars[pos]);
  return kind === "word" ? before !== after : before === after;
}

/**
 * Eşleşmeyi arar (Pike VM): her konumda yeni iş parçacığı başlar; aynı
 * komuta iki kez girilmez, böylece adım sayısı n × program boyunu aşamaz.
 * Dönen aralık kod noktası (Array.from) indeksidir; `from` aramaya başlanan
 * konum.
 */
export function execAutomodRegex(re: CompiledRegex, chars: readonly string[], from = 0): { start: number; end: number } | null {
  const prog = re.prog;
  const n = Math.min(chars.length, AUTOMOD_REGEX_MAX_TEXT);
  let clist: { pc: number; start: number }[] = [];
  let nlist: { pc: number; start: number }[] = [];
  const mark = new Int32Array(prog.length).fill(-1);
  let generation = 0;

  const add = (list: { pc: number; start: number }[], pc: number, start: number, pos: number) => {
    // Yinelemeli değil, açık yığınla (derin programda yığın taşmasın).
    const stack: number[] = [pc];
    while (stack.length > 0) {
      const p = stack.pop() as number;
      if (mark[p] === generation) continue;
      mark[p] = generation;
      const inst = prog[p];
      if (inst.op === "jmp") stack.push(inst.x);
      else if (inst.op === "split") {
        stack.push(inst.y);
        stack.push(inst.x);
      } else if (inst.op === "assert") {
        if (assertHolds(inst.kind, chars, pos)) stack.push(p + 1);
      } else list.push({ pc: p, start });
    }
  };

  let best: { start: number; end: number } | null = null;
  for (let pos = from; pos <= n; pos += 1) {
    generation += 1;
    // Öncelik sırası: önceki adımdan gelenler (daha erken başlangıç), sonra —
    // henüz eşleşme yoksa — bu konumdan yeni başlangıç.
    const seeded: { pc: number; start: number }[] = [];
    for (const th of clist) add(seeded, th.pc, th.start, pos);
    if (best === null) add(seeded, 0, pos, pos);
    clist = seeded;
    nlist = [];
    const ch = pos < n ? chars[pos] : undefined;
    for (const th of clist) {
      const inst = prog[th.pc];
      if (inst.op === "match") {
        // En soldaki başlangıç, açgözlü (Perl/Rust "leftmost-first"): daha
        // düşük öncelikli iş parçacıkları bırakılır, öncekiler sürer.
        best = { start: th.start, end: pos };
        break;
      }
      if (inst.op === "char" && ch !== undefined && inst.pred(ch)) nlist.push({ pc: th.pc + 1, start: th.start });
    }
    clist = nlist;
    if (best && clist.length === 0) return best;
  }
  return best;
}
