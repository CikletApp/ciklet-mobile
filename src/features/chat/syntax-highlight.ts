/**
 * Kod bloğu sözdizimi renklendirmesi — bağımlılıksız, hafif belirteçleyici.
 *
 * Web highlight.js kullanıyor (`code-block.tsx`, dil tembel yüklenir); mobil
 * pakete o kadar dil tanımı taşımak yerine yaygın dillerin ortak yapısı
 * (anahtar kelime, dizgi, sayı, yorum, işlev çağrısı, tür adı) tek bir
 * tarayıcıyla çıkarılır. Amaç doğruluk değil okunurluk: tanınmayan her şey
 * düz metin kalır, hiçbir girdi hata üretmez.
 *
 * Dil etiketi web'deki `lib/code-language` kısaltmalarıyla çözülür (js, ts,
 * py, sh, yml…); bilinmeyen etiket düz metindir.
 */

export type CodeTokenKind =
  | "plain"
  | "keyword"
  | "literal"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "type"
  | "tag"
  | "attr"
  | "variable";

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

interface LangSpec {
  keywords: string[];
  literals?: string[];
  /** Yerleşik tür adları; büyük harfle başlayan tanımlayıcılar da tür sayılır. */
  types?: string[];
  lineComment?: string[];
  blockComment?: [string, string][];
  /** Dizgi sınırlayıcıları; ` çok satırlı olabilir. */
  quotes: string[];
  /** Python `"""…"""`. */
  tripleQuotes?: boolean;
  /** SQL, PowerShell: anahtar kelimeler büyük/küçük harf duyarsız. */
  caseInsensitive?: boolean;
  /** `$değişken` / `${…}` (bash, PowerShell, PHP). */
  dollarVariables?: boolean;
  /** Büyük harfli tanımlayıcıyı tür saymasın (bash, SQL…). */
  noCapitalTypes?: boolean;
  /** `@dekoratör` / `#[öznitelik]` ön ekleri öznitelik rengini alır. */
  decorators?: boolean;
}

const C_LIKE_LITERALS = ["true", "false", "null", "undefined", "NaN", "Infinity", "nil", "None", "True", "False"];

const JS_KEYWORDS = [
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "get", "if", "implements",
  "import", "in", "instanceof", "interface", "let", "new", "of", "private", "protected", "public", "readonly",
  "return", "set", "static", "super", "switch", "this", "throw", "try", "type", "typeof", "var", "void", "while",
  "with", "yield", "declare", "namespace", "abstract", "keyof", "satisfies", "infer", "is",
];

const SPECS: Record<string, LangSpec> = {
  javascript: {
    keywords: JS_KEYWORDS,
    literals: ["true", "false", "null", "undefined", "NaN", "Infinity"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'", "`"],
    decorators: true,
  },
  typescript: {
    keywords: JS_KEYWORDS,
    literals: ["true", "false", "null", "undefined", "NaN", "Infinity"],
    types: ["string", "number", "boolean", "any", "unknown", "never", "object", "symbol", "bigint"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'", "`"],
    decorators: true,
  },
  json: {
    keywords: [],
    literals: ["true", "false", "null"],
    quotes: ['"'],
    lineComment: ["//"],
    noCapitalTypes: true,
  },
  python: {
    keywords: [
      "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except",
      "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
      "raise", "return", "try", "while", "with", "yield", "match", "case", "self",
    ],
    literals: ["True", "False", "None"],
    types: ["int", "float", "str", "bool", "list", "dict", "set", "tuple", "bytes", "object"],
    lineComment: ["#"],
    quotes: ['"', "'"],
    tripleQuotes: true,
    decorators: true,
  },
  bash: {
    keywords: [
      "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "function",
      "return", "exit", "export", "local", "readonly", "echo", "cd", "source", "sudo", "set", "unset", "shift",
    ],
    literals: ["true", "false"],
    lineComment: ["#"],
    quotes: ['"', "'"],
    dollarVariables: true,
    noCapitalTypes: true,
  },
  powershell: {
    keywords: [
      "if", "else", "elseif", "foreach", "for", "while", "do", "until", "switch", "function", "param", "return",
      "try", "catch", "finally", "throw", "break", "continue", "begin", "process", "end", "in",
    ],
    literals: ["$true", "$false", "$null"],
    lineComment: ["#"],
    blockComment: [["<#", "#>"]],
    quotes: ['"', "'"],
    dollarVariables: true,
    caseInsensitive: true,
    noCapitalTypes: true,
  },
  c: {
    keywords: [
      "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern",
      "float", "for", "goto", "if", "inline", "int", "long", "register", "return", "short", "signed", "sizeof",
      "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "#include",
      "#define", "#ifdef", "#ifndef", "#endif", "#if", "#else", "#pragma",
    ],
    literals: ["true", "false", "NULL", "nullptr"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
  },
  cpp: {
    keywords: [
      "auto", "break", "case", "catch", "char", "class", "const", "constexpr", "continue", "default", "delete", "do",
      "double", "else", "enum", "explicit", "extern", "float", "for", "friend", "goto", "if", "inline", "int",
      "long", "namespace", "new", "noexcept", "operator", "override", "private", "protected", "public", "return",
      "short", "signed", "sizeof", "static", "struct", "switch", "template", "this", "throw", "try", "typedef",
      "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "while", "#include", "#define",
      "#ifdef", "#ifndef", "#endif", "#if", "#else", "#pragma",
    ],
    literals: ["true", "false", "NULL", "nullptr"],
    types: ["std", "string", "vector", "size_t", "bool"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
  },
  java: {
    keywords: [
      "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
      "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "if", "implements",
      "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected",
      "public", "record", "return", "short", "static", "super", "switch", "synchronized", "this", "throw",
      "throws", "try", "var", "void", "volatile", "while", "yield",
    ],
    literals: ["true", "false", "null"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
    decorators: true,
  },
  csharp: {
    keywords: [
      "abstract", "as", "async", "await", "base", "bool", "break", "byte", "case", "catch", "char", "class",
      "const", "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit",
      "extern", "finally", "float", "for", "foreach", "get", "if", "implicit", "in", "int", "interface", "internal",
      "is", "lock", "long", "namespace", "new", "object", "operator", "out", "override", "params", "private",
      "protected", "public", "readonly", "record", "ref", "return", "sealed", "set", "short", "static", "string",
      "struct", "switch", "this", "throw", "try", "typeof", "using", "var", "virtual", "void", "while", "yield",
    ],
    literals: ["true", "false", "null"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
  },
  go: {
    keywords: [
      "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go",
      "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch",
      "type", "var",
    ],
    literals: ["true", "false", "nil", "iota"],
    types: ["string", "int", "int64", "int32", "uint", "uint64", "byte", "rune", "bool", "float64", "float32", "error", "any"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'", "`"],
  },
  rust: {
    keywords: [
      "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "fn", "for",
      "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
      "static", "struct", "super", "trait", "type", "unsafe", "use", "where", "while",
    ],
    literals: ["true", "false", "None", "Some", "Ok", "Err"],
    types: ["i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64", "u128", "usize", "f32", "f64", "bool", "char", "str", "String", "Vec", "Option", "Result"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"'],
    decorators: true,
  },
  kotlin: {
    keywords: [
      "abstract", "as", "break", "by", "catch", "class", "companion", "const", "continue", "data", "do", "else",
      "enum", "external", "final", "finally", "for", "fun", "get", "if", "import", "in", "init", "inline",
      "interface", "internal", "is", "lateinit", "object", "open", "operator", "out", "override", "package",
      "private", "protected", "public", "return", "sealed", "set", "super", "suspend", "this", "throw", "try",
      "typealias", "val", "var", "vararg", "when", "where", "while",
    ],
    literals: ["true", "false", "null"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
    decorators: true,
  },
  swift: {
    keywords: [
      "as", "associatedtype", "break", "case", "catch", "class", "continue", "default", "defer", "deinit", "do",
      "else", "enum", "extension", "fallthrough", "for", "func", "guard", "if", "import", "in", "init", "inout",
      "internal", "is", "let", "mutating", "open", "operator", "private", "protocol", "public", "repeat",
      "rethrows", "return", "self", "Self", "static", "struct", "subscript", "super", "switch", "throw", "throws",
      "try", "typealias", "var", "where", "while", "async", "await",
    ],
    literals: ["true", "false", "nil"],
    lineComment: ["//"],
    blockComment: [["/*", "*/"]],
    quotes: ['"'],
    decorators: true,
  },
  php: {
    keywords: [
      "abstract", "and", "array", "as", "break", "case", "catch", "class", "clone", "const", "continue", "declare",
      "default", "do", "echo", "else", "elseif", "empty", "enum", "extends", "final", "finally", "fn", "for",
      "foreach", "function", "global", "if", "implements", "include", "instanceof", "interface", "isset", "match",
      "namespace", "new", "or", "print", "private", "protected", "public", "readonly", "require", "return",
      "static", "switch", "throw", "trait", "try", "unset", "use", "var", "while", "yield",
    ],
    literals: ["true", "false", "null", "TRUE", "FALSE", "NULL"],
    lineComment: ["//", "#"],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
    dollarVariables: true,
  },
  ruby: {
    keywords: [
      "alias", "and", "begin", "break", "case", "class", "def", "do", "else", "elsif", "end", "ensure",
      "for", "if", "in", "module", "next", "not", "or", "redo", "rescue", "retry", "return", "self", "super",
      "then", "undef", "unless", "until", "when", "while", "yield", "require", "attr_accessor", "puts",
    ],
    literals: ["true", "false", "nil"],
    lineComment: ["#"],
    quotes: ['"', "'"],
  },
  lua: {
    keywords: [
      "and", "break", "do", "else", "elseif", "end", "for", "function", "goto", "if", "in", "local", "not", "or",
      "repeat", "return", "then", "until", "while",
    ],
    literals: ["true", "false", "nil"],
    lineComment: ["--"],
    quotes: ['"', "'"],
    noCapitalTypes: true,
  },
  sql: {
    keywords: [
      "select", "from", "where", "and", "or", "not", "insert", "into", "values", "update", "set", "delete", "create",
      "table", "drop", "alter", "add", "column", "index", "primary", "key", "foreign", "references", "join", "left",
      "right", "inner", "outer", "full", "on", "as", "group", "by", "order", "having", "limit", "offset", "distinct",
      "union", "all", "case", "when", "then", "else", "end", "in", "is", "like", "between", "exists", "default",
      "unique", "constraint", "view", "with", "returning", "asc", "desc", "count", "sum", "avg", "min", "max",
      "varchar", "int", "integer", "text", "boolean", "timestamp", "serial", "bigint",
    ],
    literals: ["null", "true", "false"],
    lineComment: ["--"],
    blockComment: [["/*", "*/"]],
    quotes: ["'", '"'],
    caseInsensitive: true,
    noCapitalTypes: true,
  },
  yaml: {
    keywords: [],
    literals: ["true", "false", "null", "yes", "no", "on", "off", "~"],
    lineComment: ["#"],
    quotes: ['"', "'"],
    noCapitalTypes: true,
  },
  ini: {
    keywords: [],
    literals: ["true", "false"],
    lineComment: ["#", ";"],
    quotes: ['"', "'"],
    noCapitalTypes: true,
  },
  dockerfile: {
    keywords: [
      "FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR",
      "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL", "AS",
    ],
    lineComment: ["#"],
    quotes: ['"', "'"],
    dollarVariables: true,
    noCapitalTypes: true,
  },
  css: {
    keywords: ["!important"],
    lineComment: [],
    blockComment: [["/*", "*/"]],
    quotes: ['"', "'"],
    noCapitalTypes: true,
  },
};

/** Web `lib/code-language` kısaltmaları — aynı etiket iki istemcide aynı dile çıksın. */
const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  py3: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  cc: "cpp",
  hpp: "cpp",
  h: "c",
  golang: "go",
  ps: "powershell",
  ps1: "powershell",
  pwsh: "powershell",
  html: "xml",
  htm: "xml",
  svg: "xml",
  vue: "xml",
  toml: "ini",
  docker: "dockerfile",
  scss: "css",
  less: "css",
  jsonc: "json",
};

/** Arayüzde gösterilen ad (kod bloğu başlığı). */
const DISPLAY: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  json: "JSON",
  python: "Python",
  bash: "Bash",
  powershell: "PowerShell",
  c: "C",
  cpp: "C++",
  java: "Java",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  kotlin: "Kotlin",
  swift: "Swift",
  php: "PHP",
  ruby: "Ruby",
  lua: "Lua",
  sql: "SQL",
  yaml: "YAML",
  ini: "INI",
  dockerfile: "Dockerfile",
  css: "CSS",
  xml: "HTML",
};

/** ```etiket``` → desteklenen dil kimliği; bilinmeyen ya da boş etiket `null` (düz metin). */
export function resolveCodeLanguage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tag = raw.trim().toLowerCase();
  const id = ALIASES[tag] ?? tag;
  return id in SPECS || id === "xml" ? id : null;
}

export function codeLanguageLabel(id: string | null): string | null {
  return id ? (DISPLAY[id] ?? id) : null;
}

const specCache = new Map<string, { spec: LangSpec; keywords: Set<string>; literals: Set<string>; types: Set<string> }>();

function compiled(id: string) {
  const hit = specCache.get(id);
  if (hit) return hit;
  const spec = SPECS[id];
  const norm = (list: string[] | undefined) =>
    new Set((list ?? []).map((word) => (spec.caseInsensitive ? word.toLowerCase() : word)));
  const entry = { spec, keywords: norm(spec.keywords), literals: norm(spec.literals ?? C_LIKE_LITERALS), types: norm(spec.types) };
  specCache.set(id, entry);
  return entry;
}

/** Çok uzun bloklar düz çizilir — liste kaydırması her mesajda binlerce düğüm üretmesin. */
const MAX_HIGHLIGHT_LENGTH = 12_000;

export function highlightCode(code: string, language: string | null): CodeToken[] {
  if (!language || code.length > MAX_HIGHLIGHT_LENGTH) return [{ kind: "plain", text: code }];
  const tokens = language === "xml" ? scanMarkup(code) : scanCode(code, compiled(language));
  return merge(tokens);
}

function merge(tokens: CodeToken[]): CodeToken[] {
  const out: CodeToken[] = [];
  for (const token of tokens) {
    if (!token.text) continue;
    const last = out[out.length - 1];
    if (last && last.kind === token.kind) last.text += token.text;
    else out.push({ ...token });
  }
  return out;
}

// Latin-1 harfleri ve Türkçe ğ/ı/ş da tanımlayıcı.
const IDENT_START = /[A-Za-z_$#@!\xC0-\xFFğĞıİşŞ]/;
const IDENT_PART = /[\w$\xC0-\xFFğĞıİşŞ-]/;
const NUMBER = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[a-zA-Z%]*/;

function scanCode(
  code: string,
  { spec, keywords, literals, types }: ReturnType<typeof compiled>
): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  const n = code.length;
  const startsWith = (s: string) => code.startsWith(s, i);

  while (i < n) {
    const ch = code[i];

    // Blok yorum
    const block = spec.blockComment?.find(([open]) => startsWith(open));
    if (block) {
      const end = code.indexOf(block[1], i + block[0].length);
      const stop = end < 0 ? n : end + block[1].length;
      out.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // Satır yorumu
    const line = spec.lineComment?.find((marker) => startsWith(marker));
    if (line && !(line === "#" && spec.decorators && code[i + 1] === "[")) {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? n : end;
      out.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // Dizgi
    if (spec.quotes.includes(ch)) {
      const triple = spec.tripleQuotes && code.startsWith(ch.repeat(3), i);
      const close = triple ? ch.repeat(3) : ch;
      let j = i + close.length;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code.startsWith(close, j)) {
          j += close.length;
          break;
        }
        // Tek tırnaklı dizgi satır sonunda biter (kapanmamış tırnak bloğu boyamasın).
        if (code[j] === "\n" && !triple && ch !== "`") break;
        j += 1;
      }
      out.push({ kind: "string", text: code.slice(i, Math.min(j, n)) });
      i = Math.min(j, n);
      continue;
    }
    // $değişken
    if (spec.dollarVariables && ch === "$") {
      const brace = code[i + 1] === "{";
      const match = brace ? /^\$\{[^}\n]*\}?/.exec(code.slice(i)) : /^\$[\w:]+/.exec(code.slice(i));
      if (match) {
        const word = match[0];
        const kind = literals.has(spec.caseInsensitive ? word.toLowerCase() : word) ? "literal" : "variable";
        out.push({ kind, text: word });
        i += word.length;
        continue;
      }
    }
    // Dekoratör / öznitelik
    if (spec.decorators && (ch === "@" || (ch === "#" && code[i + 1] === "["))) {
      const match = ch === "@" ? /^@[\w.]+/.exec(code.slice(i)) : /^#\[[^\]\n]*\]?/.exec(code.slice(i));
      if (match) {
        out.push({ kind: "attr", text: match[0] });
        i += match[0].length;
        continue;
      }
    }
    // Sayı (tanımlayıcının içindeki rakam değil)
    if (/[\d.]/.test(ch) && !(i > 0 && IDENT_PART.test(code[i - 1]))) {
      const match = NUMBER.exec(code.slice(i, i + 64));
      if (match && match[0] !== ".") {
        out.push({ kind: "number", text: match[0] });
        i += match[0].length;
        continue;
      }
    }
    // Tanımlayıcı / anahtar kelime
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < n && IDENT_PART.test(code[j])) j += 1;
      // "-" yalnızca CSS ve kabuk kelimelerinde tanımlayıcının parçası.
      let word = code.slice(i, j);
      if (word.includes("-") && spec !== SPECS.css && spec !== SPECS.bash) {
        word = word.slice(0, word.indexOf("-"));
        j = i + word.length;
      }
      if (word.length === 0) {
        out.push({ kind: "plain", text: ch });
        i += 1;
        continue;
      }
      const key = spec.caseInsensitive ? word.toLowerCase() : word;
      let kind: CodeTokenKind = "plain";
      if (keywords.has(key)) kind = "keyword";
      else if (literals.has(key)) kind = "literal";
      else if (types.has(key)) kind = "type";
      else if (spec === SPECS.css) kind = /^\s*:/.test(code.slice(j, j + 8)) && !/^\s*:\s*[\w-]+\s*[{,]/.test(code.slice(j, j + 40)) ? "attr" : "plain";
      else if (spec === SPECS.json || spec === SPECS.yaml || spec === SPECS.ini) kind = /^\s*[:=]/.test(code.slice(j, j + 4)) ? "attr" : "plain";
      else if (/^\s*\(/.test(code.slice(j, j + 4))) kind = "function";
      else if (!spec.noCapitalTypes && /^[A-Z][a-z0-9]/.test(word)) kind = "type";
      out.push({ kind, text: word });
      i = j;
      continue;
    }
    out.push({ kind: "plain", text: ch });
    i += 1;
  }
  // JSON/YAML anahtarı dizgi olarak geldiyse (`"ad": 1`) öznitelik rengine çevir.
  if (spec === SPECS.json || spec === SPECS.yaml) {
    for (let k = 0; k < out.length; k += 1) {
      if (out[k].kind !== "string") continue;
      let m = k + 1;
      while (m < out.length && out[m].kind === "plain" && /^\s*$/.test(out[m].text)) m += 1;
      if (out[m]?.kind === "plain" && out[m].text.startsWith(":")) out[k] = { kind: "attr", text: out[k].text };
    }
  }
  return out;
}

/** HTML/XML: etiket adları, öznitelikler, değerleri ve yorumlar. */
function scanMarkup(code: string): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    if (code.startsWith("<!--", i)) {
      const end = code.indexOf("-->", i + 4);
      const stop = end < 0 ? n : end + 3;
      out.push({ kind: "comment", text: code.slice(i, stop) });
      i = stop;
      continue;
    }
    if (code[i] === "<" && /[A-Za-z/!?]/.test(code[i + 1] ?? "")) {
      const match = /^<\/?[!?]?[\w:.-]*/.exec(code.slice(i));
      const head = match?.[0] ?? "<";
      out.push({ kind: "tag", text: head });
      i += head.length;
      while (i < n && code[i] !== ">") {
        if (code[i] === '"' || code[i] === "'") {
          const quote = code[i];
          const end = code.indexOf(quote, i + 1);
          const stop = end < 0 ? n : end + 1;
          out.push({ kind: "string", text: code.slice(i, stop) });
          i = stop;
        } else if (/[\w:@-]/.test(code[i])) {
          const attr = /^[\w:@.-]+/.exec(code.slice(i))?.[0] ?? code[i];
          out.push({ kind: "attr", text: attr });
          i += attr.length;
        } else {
          out.push({ kind: code[i] === "/" ? "tag" : "plain", text: code[i] });
          i += 1;
        }
      }
      if (i < n) {
        out.push({ kind: "tag", text: ">" });
        i += 1;
      }
      continue;
    }
    const next = code.indexOf("<", i + 1);
    const stop = next < 0 ? n : next;
    out.push({ kind: "plain", text: code.slice(i, stop) });
    i = stop;
  }
  return out;
}
