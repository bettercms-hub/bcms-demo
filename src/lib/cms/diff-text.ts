/**
 * diff-text — word-level diff between two strings, for compare views.
 *
 * LCS over word tokens (whitespace preserved) so mid-sentence edits
 * highlight only the words that changed, not everything after them.
 * Falls back to a cheap common-prefix/suffix diff for very long values.
 */

export interface TextPart {
  text: string;
  /** True when this part was removed (before) or added (after). */
  changed: boolean;
}

export interface TextDiff {
  before: TextPart[];
  after: TextPart[];
  /** True when the values differ at all. */
  different: boolean;
}

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t.length > 0);
}

function merge(parts: TextPart[]): TextPart[] {
  const out: TextPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.changed === p.changed) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Prefix/suffix fallback for very long values: highlight the middle. */
function affixDiff(before: string, after: string): TextDiff {
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before[p] === after[p]) p++;
  let s = 0;
  while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
  const mk = (str: string): TextPart[] =>
    merge(
      [
        { text: str.slice(0, p), changed: false },
        { text: str.slice(p, str.length - s), changed: true },
        { text: str.slice(str.length - s), changed: false },
      ].filter((x) => x.text.length > 0),
    );
  return { before: mk(before), after: mk(after), different: true };
}

export function diffText(before: string, after: string): TextDiff {
  if (before === after) {
    return { before: [{ text: before, changed: false }], after: [{ text: after, changed: false }], different: false };
  }
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > 250_000) return affixDiff(before, after);

  // LCS table over tokens.
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const beforeParts: TextPart[] = [];
  const afterParts: TextPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      beforeParts.push({ text: a[i], changed: false });
      afterParts.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      beforeParts.push({ text: a[i], changed: true });
      i++;
    } else {
      afterParts.push({ text: b[j], changed: true });
      j++;
    }
  }
  while (i < n) beforeParts.push({ text: a[i++], changed: true });
  while (j < m) afterParts.push({ text: b[j++], changed: true });

  return { before: merge(beforeParts), after: merge(afterParts), different: true };
}
