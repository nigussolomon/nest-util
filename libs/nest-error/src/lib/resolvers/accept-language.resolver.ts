/**
 * Parses an `Accept-Language` header into an ordered list of language tags
 * (primary subtag only) sorted by `q` value. No external dependency.
 */
export function parseAcceptLanguage(
  header: string | undefined | null
): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const segments = part.trim().split(';');
      const tag = segments[0]?.trim().split('-')[0]?.toLowerCase() ?? '';
      let q = 1;
      for (let i = 1; i < segments.length; i++) {
        const [k, v] = segments[i].split('=');
        if (k?.trim() === 'q') {
          const parsed = parseFloat(v ?? '');
          q = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
      return { tag, q };
    })
    .filter((x) => x.tag.length > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/**
 * Negotiates the best supported language from an ordered list of requested langs.
 * Returns `null` when nothing matches (caller falls back to default).
 */
export function negotiateLanguage(
  requested: string[],
  supported: string[]
): string | null {
  const supportedSet = new Set(supported.map((s) => s.toLowerCase()));
  for (const lang of requested) {
    if (supportedSet.has(lang.toLowerCase())) return lang;
  }
  return null;
}
