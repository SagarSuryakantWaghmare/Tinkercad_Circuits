export type TokenKind =
  | 'ident'
  | 'number'
  | 'string'
  | 'char'
  | 'punct'
  | 'keyword'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  /** Numeric literals carry their parsed value and whether they are integral. */
  num?: number;
  isInt?: boolean;
  line: number;
  col: number;
}

export const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'return', 'goto',
  'void', 'int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean',
  'byte', 'word', 'signed', 'unsigned', 'const', 'static', 'volatile', 'extern',
  'struct', 'class', 'enum', 'union', 'typedef', 'public', 'private', 'protected',
  'true', 'false', 'sizeof', 'new', 'delete', 'this', 'null', 'NULL',
  'PROGMEM', 'inline', 'auto',
]);

// Longest first so '<<=' wins over '<<' and '<'.
const PUNCT = [
  '>>=', '<<=', '...',
  '++', '--', '->', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
  '{', '}', '(', ')', '[', ']', ';', ',', '.', '?', ':',
  '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '<', '>', '=', '#',
];

export interface LexResult {
  tokens: Token[];
  /** `#include <X.h>` names, in order. */
  includes: string[];
  errors: { line: number; message: string }[];
}

/**
 * Tokenise an Arduino sketch.
 *
 * Object-like `#define`s are expanded here rather than in the parser, which is
 * how the real toolchain behaves and keeps the grammar free of preprocessor
 * concerns. Function-like macros are not expanded — sketches that need them are
 * rare, and a wrong expansion is worse than an honest error.
 */
export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const includes: string[] = [];
  const errors: { line: number; message: string }[] = [];
  const defines = new Map<string, Token[]>();

  let i = 0;
  let line = 1;
  let lineStart = 0;
  const n = source.length;

  const col = () => i - lineStart + 1;

  const push = (t: Omit<Token, 'line' | 'col'>) => {
    tokens.push({ ...t, line, col: col() } as Token);
  };

  while (i < n) {
    const c = source[i];

    // whitespace
    if (c === '\n') {
      line++;
      i++;
      lineStart = i;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }

    // comments
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') {
          line++;
          lineStart = i + 1;
        }
        i++;
      }
      i += 2;
      continue;
    }

    // preprocessor directives occupy a whole line
    if (c === '#') {
      const start = i;
      let end = i;
      while (end < n && source[end] !== '\n') end++;
      const text = source.slice(start, end);
      handleDirective(text);
      i = end;
      continue;
    }

    // string literal
    if (c === '"') {
      const { value, next } = readQuoted(source, i, '"');
      push({ kind: 'string', value });
      i = next;
      continue;
    }

    // char literal
    if (c === "'") {
      const { value, next } = readQuoted(source, i, "'");
      push({ kind: 'char', value, num: value.charCodeAt(0) || 0, isInt: true });
      i = next;
      continue;
    }

    // number
    if (isDigit(c) || (c === '.' && isDigit(source[i + 1]))) {
      const start = i;
      let isInt = true;
      if (c === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        i += 2;
        while (i < n && /[0-9a-fA-F]/.test(source[i])) i++;
      } else if (c === '0' && (source[i + 1] === 'b' || source[i + 1] === 'B')) {
        i += 2;
        while (i < n && /[01]/.test(source[i])) i++;
      } else {
        while (i < n && isDigit(source[i])) i++;
        if (source[i] === '.') {
          isInt = false;
          i++;
          while (i < n && isDigit(source[i])) i++;
        }
        if (source[i] === 'e' || source[i] === 'E') {
          isInt = false;
          i++;
          if (source[i] === '+' || source[i] === '-') i++;
          while (i < n && isDigit(source[i])) i++;
        }
      }
      const raw = source.slice(start, i);
      // integer/float suffixes
      while (i < n && /[uUlLfF]/.test(source[i])) {
        if (source[i] === 'f' || source[i] === 'F') isInt = false;
        i++;
      }
      push({ kind: 'number', value: raw, num: parseNumber(raw), isInt });
      continue;
    }

    // identifier / keyword
    if (isIdentStart(c)) {
      const start = i;
      while (i < n && isIdentPart(source[i])) i++;
      const word = source.slice(start, i);
      const macro = defines.get(word);
      if (macro) {
        for (const t of macro) tokens.push({ ...t, line, col: col() });
        continue;
      }
      push({ kind: KEYWORDS.has(word) ? 'keyword' : 'ident', value: word });
      continue;
    }

    // punctuation
    const p = PUNCT.find((op) => source.startsWith(op, i));
    if (p) {
      push({ kind: 'punct', value: p });
      i += p.length;
      continue;
    }

    errors.push({ line, message: `Unexpected character '${c}'` });
    i++;
  }

  tokens.push({ kind: 'eof', value: '', line, col: col() });
  return { tokens, includes, errors };

  function handleDirective(text: string) {
    const m = /^#\s*(\w+)\s*(.*)$/.exec(text);
    if (!m) return;
    const [, name, rest] = m;
    if (name === 'include') {
      const inc = /[<"]([^>"]+)[>"]/.exec(rest);
      if (inc) includes.push(inc[1]);
      return;
    }
    if (name === 'define') {
      const dm = /^(\w+)\s*(.*)$/.exec(rest.trim());
      if (!dm) return;
      const [, key, body] = dm;
      // Function-like macros are out of scope; recording them would expand wrong.
      if (rest.trim().startsWith(`${key}(`)) return;
      const sub = lex(body.trim());
      defines.set(key, sub.tokens.filter((t) => t.kind !== 'eof'));
      return;
    }
    // #ifdef/#endif/#pragma and friends are accepted and ignored: sketches use
    // them for guards that do not change single-target behaviour.
  }
}

function readQuoted(src: string, start: number, quote: string) {
  let i = start + 1;
  let out = '';
  while (i < src.length && src[i] !== quote) {
    if (src[i] === '\\') {
      const e = src[i + 1];
      out +=
        e === 'n' ? '\n'
        : e === 't' ? '\t'
        : e === 'r' ? '\r'
        : e === '0' ? '\0'
        : e === '\\' ? '\\'
        : e === "'" ? "'"
        : e === '"' ? '"'
        : e ?? '';
      i += 2;
      continue;
    }
    out += src[i];
    i++;
  }
  return { value: out, next: i + 1 };
}

function parseNumber(raw: string): number {
  if (/^0[xX]/.test(raw)) return parseInt(raw.slice(2), 16);
  if (/^0[bB]/.test(raw)) return parseInt(raw.slice(2), 2);
  if (/^0[0-7]+$/.test(raw)) return parseInt(raw.slice(1), 8);
  return parseFloat(raw);
}

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);
