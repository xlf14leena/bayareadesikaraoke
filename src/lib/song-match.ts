// How the app decides two song titles are the same song, or might be.
//
// songKey() is strict: titles with the same key are treated as the same song
// and the second one is blocked. It ignores case, accents, punctuation,
// spacing, bracketed notes like "(From Aashiqui 2)", words like "karaoke" or
// "lyrics", and common Hinglish spelling variants (aa/a, ee/i, oo/u, toh/to,
// woh/voh, doubled letters).
//
// looksAlike() is loose: it catches typos and an extra or missing word. It only
// warns, because two different songs can have close titles.

/** Words that describe the upload, not the song. Matched on whole words after punctuation is gone. */
const NOISE = new RegExp(
  "\\b(?:" +
    [
      "karaoke(?: (?:version|track|video))?",
      "(?:with )?lyrics?(?: video)?",
      "lyrical(?: video)?",
      "official(?: music)?(?: video| audio)?",
      "(?:full )?(?:hd|hq|4k)(?: video| audio)?",
      "full (?:song|video|audio)",
      "(?:music |audio )?video",
      "instrumental",
      "unplugged",
      "cover",
      "lo ?fi",
      "slowed(?: and)? reverb",
      "(?:male|female|duet) version",
      "title (?:song|track)",
    ].join("|") +
    ")\\b",
  "g",
);

/** Folds common Hinglish spelling variants of one lowercase word. */
function foldSpelling(word: string): string {
  return word
    .replace(/w/g, "v") // woh / voh
    .replace(/ee/g, "i") // jeena / jina
    .replace(/oo/g, "u") // soona / suna
    .replace(/(\p{L})\1+/gu, "$1") // pyaar / pyar, channa / chana
    .replace(/([aeiou])h$/, "$1"); // toh / to, yeh / ye
}

function clean(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function words(s: string): string[] {
  return s.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
}

/** The title's words after cleanup. Falls back to the plain words if cleanup would leave nothing. */
export function songWords(title: string): string[] {
  const plain = clean(title);
  const unbracketed = plain.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ");
  const base = words(unbracketed).length ? unbracketed : plain;
  const stripped = words(base).join(" ").replace(NOISE, " ");
  const kept = words(stripped).length ? words(stripped) : words(base);
  return kept.map(foldSpelling).filter(Boolean);
}

/** Titles with the same key are the same song. Empty when the title has no letters or numbers. */
export function songKey(title: string): string {
  return songWords(title).join("");
}

/** Edit distance allowing swapped neighbours, stopping early once it passes max. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

/** True when one word list appears, in order and unbroken, inside the other. */
function contains(long: string[], short: string[]): boolean {
  for (let i = 0; i + short.length <= long.length; i++) {
    if (short.every((w, j) => long[i + j] === w)) return true;
  }
  return false;
}

/**
 * True when two titles are probably the same song: the same key, a small
 * typo (about one letter in seven), or one title being the other plus extra
 * words (like "Tum Hi Ho" and "Tum Hi Ho Aashiqui 2").
 */
export function looksAlike(a: string, b: string): boolean {
  const wa = songWords(a);
  const wb = songWords(b);
  const ka = wa.join("");
  const kb = wb.join("");
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const len = Math.max(ka.length, kb.length);
  const allowed = len < 5 ? 0 : Math.max(1, Math.floor(len / 7));
  if (allowed && distance(ka, kb, allowed) <= allowed) return true;
  const [long, short] = wa.length >= wb.length ? [wa, wb] : [wb, wa];
  return short.length >= 2 && short.length < long.length && contains(long, short);
}
