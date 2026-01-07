// Utilities to parse match name into namePart and codePart, and to normalize key from namePart
export function parseMatchName(raw: string): { namePart: string; codePart: string | null } {
  const s = (raw || '').trim();
  if (!s) return { namePart: '', codePart: null };

  // Try bracketed code at the end: "Name (CODE)" or "Name [CODE]"
  const paren = s.match(/^(.*?)[\s\-]*\(([^)]+)\)\s*$/);
  if (paren) {
    return { namePart: (paren[1] || '').trim(), codePart: (paren[2] || '').trim() || null };
  }
  const square = s.match(/^(.*?)[\s\-]*\[([^\]]+)\]\s*$/);
  if (square) {
    return { namePart: (square[1] || '').trim(), codePart: (square[2] || '').trim() || null };
  }

  // Fallback: last dash/space-separated token containing digits is considered code
  const dash = s.match(/^(.*?)[\s\-]+([A-Za-z0-9_#\-]+)\s*$/);
  if (dash && /[0-9]/.test(dash[2])) {
    return { namePart: (dash[1] || '').trim(), codePart: (dash[2] || '').trim() };
  }

  return { namePart: s, codePart: null };
}

// Normalize key derived only from namePart
export function normalizeKey(namePart: string): string {
  const base = (namePart || '').trim();
  // Remove diacritics: NFD then strip combining marks
  const noDiacritics = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lower = noDiacritics.toLowerCase();
  // Replace non-alphanumeric with dashes, collapse repeats, trim edges
  return lower
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}