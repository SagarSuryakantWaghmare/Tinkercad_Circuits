export type PyTokenKind =
  | 'name'
  | 'keyword'
  | 'number'
  | 'string'
  | 'op'
  | 'newline'
  | 'indent'
  | 'dedent'
  | 'eof';

export interface PyToken {
  kind: PyTokenKind;
  value: string;
  /** Numeric literals carry their parsed value. */
  num?: number;
  /** String literals carry their prefix so f-strings can be handled later. */
  prefix?: string;
  line: number;
  col: number;
}

export const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

// Longest first so '**=' beats '**' beats '*'.
const OPS = [
  '**=', '//=', '>>=', '<<=', '...',
  '==', '!=', '<=', '>=', '//', '**', '<<', '>>',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '->', ':=',
  '(', ')', '[', ']', '{', '}', ',', ':', '.', ';', '@', '=',
  '+', '-', '*', '/', '%', '&', '|', '^', '~', '<', '>',
];

export interface PyLexResult {
  tokens: PyToken[];
  errors: { line: number; message: string }[];
}

/**
 * Tokenise MicroPython.
 *
 * The only genuinely awkward part of a Python lexer is that layout is
 * syntax: this emits INDENT/DEDENT from a column stack, suppresses NEWLINE
 * inside brackets and after a line continuation, and skips blank and
 * comment-only lines entirely — all of which the parser then gets for free.
 */
export function pyLex(source: string): PyLexResult {
  const tokens: PyToken[] = [];
  const errors: { line: number; message: string }[] = [];
  const indents: number[] = [0];

  const src = source.replace(/\r\n?/g, '\n');
  let i = 0;
  let line = 1;
  let depth = 0; // bracket nesting
  let atLineStart = true;

  const push = (t: Omit<PyToken, 'line' | 'col'>, col = 0) => {
    tokens.push({ ...t, line, col } as PyToken);
  };

  while (i < src.length) {
    // ── indentation, only at the true start of a logical line ──
    if (atLineStart && depth === 0) {
      let col = 0;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) {
        col += src[i] === '\t' ? 8 - (col % 8) : 1;
        i++;
      }
      // Blank or comment-only lines carry no layout information.
      if (src[i] === '\n' || src[i] === '#' || i >= src.length) {
        if (src[i] === '#') while (i < src.length && src[i] !== '\n') i++;
        if (src[i] === '\n') {
          i++;
          line++;
        }
        continue;
      }
      const top = indents[indents.length - 1];
      if (col > top) {
        indents.push(col);
        push({ kind: 'indent', value: '' }, col);
      } else if (col < top) {
        while (indents.length > 1 && col < indents[indents.length - 1]) {
          indents.pop();
          push({ kind: 'dedent', value: '' }, col);
        }
        if (indents[indents.length - 1] !== col) {
          errors.push({ line, message: 'Inconsistent indentation' });
          indents.push(col);
        }
      }
      atLineStart = false;
      continue;
    }

    const c = src[i];

    if (c === '\n') {
      i++;
      if (depth === 0) {
        push({ kind: 'newline', value: '\n' });
        atLineStart = true;
      }
      line++;
      continue;
    }

    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }

    // explicit line continuation
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
      line++;
      continue;
    }

    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // ── strings, with optional prefix ──
    const strMatch = /^([rRbBuUfF]{0,2})("""|'''|"|')/.exec(src.slice(i, i + 8));
    if (strMatch && /["']/.test(strMatch[2][0])) {
      const prefix = strMatch[1].toLowerCase();
      const quote = strMatch[2];
      const start = i + strMatch[1].length + quote.length;
      const raw = prefix.includes('r');
      let j = start;
      let out = '';
      for (;;) {
        if (j >= src.length) {
          errors.push({ line, message: 'Unterminated string' });
          break;
        }
        if (src.startsWith(quote, j)) break;
        if (!raw && src[j] === '\\') {
          const e = src[j + 1];
          out +=
            e === 'n' ? '\n'
            : e === 't' ? '\t'
            : e === 'r' ? '\r'
            : e === '0' ? '\0'
            : e === '\\' ? '\\'
            : e === "'" ? "'"
            : e === '"' ? '"'
            : e === '\n' ? ''
            : (e ?? '');
          if (e === '\n') line++;
          j += 2;
          continue;
        }
        if (src[j] === '\n') line++;
        out += src[j];
        j++;
      }
      push({ kind: 'string', value: out, prefix });
      i = j + quote.length;
      continue;
    }

    // ── numbers ──
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const start = i;
      if (c === '0' && /[xXbBoO]/.test(src[i + 1] ?? '')) {
        i += 2;
        while (i < src.length && /[0-9a-fA-F_]/.test(src[i])) i++;
      } else {
        while (i < src.length && /[0-9_]/.test(src[i])) i++;
        if (src[i] === '.') {
          i++;
          while (i < src.length && /[0-9_]/.test(src[i])) i++;
        }
        if (src[i] === 'e' || src[i] === 'E') {
          i++;
          if (src[i] === '+' || src[i] === '-') i++;
          while (i < src.length && /[0-9]/.test(src[i])) i++;
        }
      }
      const raw = src.slice(start, i).replace(/_/g, '');
      push({ kind: 'number', value: raw, num: parseNumber(raw) });
      continue;
    }

    // ── names and keywords ──
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      const word = src.slice(start, i);
      push({ kind: PY_KEYWORDS.has(word) ? 'keyword' : 'name', value: word });
      continue;
    }

    // ── operators ──
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      if ('([{'.includes(op)) depth++;
      if (')]}'.includes(op)) depth = Math.max(0, depth - 1);
      push({ kind: 'op', value: op });
      i += op.length;
      continue;
    }

    errors.push({ line, message: `Unexpected character '${c}'` });
    i++;
  }

  if (!atLineStart) push({ kind: 'newline', value: '\n' });
  while (indents.length > 1) {
    indents.pop();
    push({ kind: 'dedent', value: '' });
  }
  push({ kind: 'eof', value: '' });

  return { tokens, errors };
}

function parseNumber(raw: string): number {
  if (/^0[xX]/.test(raw)) return parseInt(raw.slice(2), 16);
  if (/^0[bB]/.test(raw)) return parseInt(raw.slice(2), 2);
  if (/^0[oO]/.test(raw)) return parseInt(raw.slice(2), 8);
  return parseFloat(raw);
}
