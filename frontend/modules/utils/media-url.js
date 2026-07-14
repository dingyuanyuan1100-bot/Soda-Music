const SIZE_PLACEHOLDER_PATTERN = /\{size\}/gi;

export function normalizeMediaUrl(url, size = 400) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(SIZE_PLACEHOLDER_PATTERN, String(size));
}

export function pickFirstMediaUrl(values, size = 400) {
  for (const value of values) {
    const normalized = normalizeMediaUrl(value, size);
    if (/^https?:\/\//i.test(normalized)) return normalized;
  }
  return '';
}
