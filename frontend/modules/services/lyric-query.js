export function normalizeLyricDuration(duration) {
  const value = Number(duration) || 0;
  if (!value) return 0;
  return value > 1000 ? value : Math.round(value * 1000);
}

export function stripArtistPrefix(title) {
  const raw = String(title || '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s+-\s+/);
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : raw;
}

export function cleanSongTitle(title) {
  return stripArtistPrefix(title)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*[-–—]\s*(DJ|Live|Remix|伴奏|片段|铃声|现场).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildLyricSearchPlans(meta) {
  const rawTitle = String(meta.title || '').trim();
  const cleanTitle = cleanSongTitle(rawTitle);
  const artist = String(meta.artist || '').trim();
  const duration = normalizeLyricDuration(meta.duration);

  const keywords = [];
  const pushKeyword = (value) => {
    const next = String(value || '').trim();
    if (next && !keywords.includes(next)) keywords.push(next);
  };

  pushKeyword(cleanTitle);
  pushKeyword(rawTitle);
  if (artist && cleanTitle) pushKeyword(`${artist} - ${cleanTitle}`);
  if (artist && cleanTitle) pushKeyword(`${artist} ${cleanTitle}`);

  const strictBase = {
    hash: meta.hash,
    album_audio_id: meta.albumAudioId,
    duration,
    man: 'no'
  };

  const relaxedBase = {
    duration,
    man: 'no'
  };

  const plans = [];
  for (const keyword of keywords) {
    plans.push({ label: `strict:${keyword}`, params: { ...strictBase, keywords: keyword } });
  }
  for (const keyword of keywords) {
    plans.push({ label: `relaxed:${keyword}`, params: { ...relaxedBase, keywords: keyword } });
  }

  return plans;
}
