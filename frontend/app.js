const API_BASE = (window.__QISHUI_API_BASE__ || '').replace(/\/$/, '');
const apiUrl = path => `${API_BASE}${path}`;

const state = {
  resultType: 'songs',
  songs: [],
  playlists: [],
  currentSong: null,
  currentSource: '未开始',
  autoAdvanceTried: new Set(),
  playbackCheckRunId: 0,
  isStartingPlayback: false,
  lyricsRequestToken: 0,
  detailRequestToken: 0,
  playbackMetrics: null,
  playbackMetricRunId: 0,
  authStatus: null,
  visiblePlaylistCoverRequests: new Set(),
  playlistCoverObserver: null,
};

const els = {
  keyword: document.getElementById('keyword'),
  searchSongs: document.getElementById('search-songs'),
  searchPlaylists: document.getElementById('search-playlists'),
  searchStatus: document.getElementById('search-status'),
  checkAuth: document.getElementById('check-auth'),
  authSummary: document.getElementById('auth-summary'),
  authDetail: document.getElementById('auth-detail'),
  results: document.getElementById('results'),
  resultType: document.getElementById('result-type'),
  cover: document.getElementById('cover'),
  detailMeta: document.getElementById('detail-meta'),
  lyrics: document.getElementById('lyrics'),
  timingSummary: document.getElementById('timing-summary'),
  timingLog: document.getElementById('timing-log'),
  player: document.getElementById('player'),
  playerCover: document.getElementById('player-cover'),
  playerTitle: document.getElementById('player-title'),
  playerArtist: document.getElementById('player-artist'),
  playerSource: document.getElementById('player-source'),
  playerToggle: document.getElementById('player-toggle'),
  audio: document.getElementById('audio'),
};

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || '请求失败');
  }
  return payload;
}

function setText(element, text, isError = false) {
  element.textContent = text || '';
  element.style.color = isError ? '#a23b20' : '';
}

function setPlayerSource(label) {
  state.currentSource = label;
  els.playerSource.textContent = `播放源：${label}`;
}

function fallbackCoverDataUrl(label = 'No Cover') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="28" fill="%23e7dccd"/><text x="50%25" y="52%25" dominant-baseline="middle" text-anchor="middle" fill="%23705a46" font-size="24">${encodeURIComponent(label)}</text></svg>`;
}

function coverOrFallback(url, options = {}) {
  const { forcePlaceholder = false, placeholderLabel = 'No Cover', viaProxy = false } = options;
  if (forcePlaceholder || !url) return fallbackCoverDataUrl(placeholderLabel);
  if (viaProxy) return apiUrl(`/api/cover?url=${encodeURIComponent(url)}`);
  return url;
}

function buildStreamUrl(song, options = {}) {
  const params = new URLSearchParams({
    id: song.id || '',
    name: song.name || '',
    artist: song.artist || '',
    album: song.album || '',
    cover: song.cover || '',
  });
  if (options.preferred) params.set('preferred', options.preferred);
  if (options.shareUrl) params.set('shareUrl', options.shareUrl);
  return apiUrl(`/api/stream?${params.toString()}`);
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value) return value;
  }
  return '';
}

function mergeSong(baseSong, incomingSong = {}) {
  return {
    ...baseSong,
    ...incomingSong,
    id: pickFirstNonEmpty(incomingSong.id, baseSong.id),
    name: pickFirstNonEmpty(incomingSong.name, incomingSong.songName, baseSong.name, baseSong.songName),
    artist: pickFirstNonEmpty(incomingSong.artist, incomingSong.singers, baseSong.artist, baseSong.singers),
    album: pickFirstNonEmpty(incomingSong.album, baseSong.album),
    cover: pickFirstNonEmpty(incomingSong.cover, incomingSong.coverUrl, baseSong.cover, baseSong.coverUrl),
    lyric: pickFirstNonEmpty(incomingSong.lyric, baseSong.lyric),
    auditionUrl: pickFirstNonEmpty(incomingSong.auditionUrl, baseSong.auditionUrl, incomingSong.extra?.auditionUrl, baseSong.extra?.auditionUrl),
    extra: {
      ...(baseSong.extra || {}),
      ...(incomingSong.extra || {}),
      auditionUrl: pickFirstNonEmpty(incomingSong.extra?.auditionUrl, incomingSong.auditionUrl, baseSong.extra?.auditionUrl, baseSong.auditionUrl),
    },
    playbackCheck: incomingSong.playbackCheck || baseSong.playbackCheck,
    detailLoaded: Boolean(baseSong.detailLoaded || incomingSong.detailLoaded),
  };
}

function getPlaybackHints(item) {
  const extra = item?.extra || {};
  const hints = [];
  const status = item?.playbackCheck?.preferredSource || item?.playbackCheck?.playable;

  if (status === 'upstream') {
    hints.push({ text: '已探测：上游可播', level: 'ok' });
  } else if (status === 'share') {
    hints.push({ text: '已探测：分享页可播', level: 'ok' });
  } else if (item?.playbackCheck && !item.playbackCheck.playable) {
    hints.push({ text: '已探测：当前不可播', level: 'warn' });
  } else if (item?.auditionUrl || extra?.auditionUrl) {
    hints.push({ text: '分享页可试听', level: 'ok' });
  } else {
    hints.push({ text: '未探测，点击试听', level: 'muted' });
  }

  if (extra.only_vip_playable === 'true') {
    hints.push({ text: 'VIP 限制概率高', level: 'warn' });
  } else if (extra.is_vip === 'true') {
    hints.push({ text: '可能受限制', level: 'warn' });
  }

  return hints;
}

function applySongDetail(detail) {
  const cover = pickFirstNonEmpty(detail?.cover, detail?.coverUrl);
  const name = pickFirstNonEmpty(detail?.name, detail?.songName) || '未知歌曲';
  const artist = pickFirstNonEmpty(detail?.artist, detail?.singers) || '未知歌手';
  const album = pickFirstNonEmpty(detail?.album) || '未提供专辑名';

  els.cover.src = coverOrFallback(cover, { placeholderLabel: 'Song', viaProxy: true });
  els.cover.onerror = () => { els.cover.src = fallbackCoverDataUrl('Song'); };
  els.detailMeta.innerHTML = `
    <strong>${escapeHtml(name)}</strong>
    <span>${escapeHtml(artist)}</span>
    <span>${escapeHtml(album)}</span>
  `;
}

function renderAuthStatus(payload) {
  state.authStatus = payload;
  const lines = [
    `检测结果：${payload.summary}`,
    `检测到登录态文件：${payload.detected ? '是' : '否'}`,
    `后续接账号能力的可行性：${payload.feasible ? '较高' : '待确认'}`,
    '',
    `域名：${(payload.domains || []).join(', ') || '无'}`,
    `Cookie 名：${(payload.cookieNames || []).join(', ') || '无'}`,
    '',
    '信号：',
    `- qishui 域名：${payload.signals?.hasQishuiDomain ? '有' : '无'}`,
    `- passport Cookie：${payload.signals?.hasPassportCookie ? '有' : '无'}`,
    `- 身份 Cookie：${payload.signals?.hasIdentityCookies ? '有' : '无'}`,
    '',
    '文件：',
    `- Cookies：${payload.files?.cookieDb?.exists ? `存在，${payload.files.cookieDb.size} bytes` : '不存在'}`,
    `- BDTicketData：${payload.files?.bdTicketDb?.exists ? `存在，${payload.files.bdTicketDb.size} bytes` : '不存在'}`,
  ];

  els.authSummary.textContent = payload.summary;
  els.authDetail.textContent = lines.join('\n');
}

async function checkClientAuth() {
  try {
    els.authSummary.textContent = '正在检测本机汽水登录态...';
    els.authDetail.textContent = '读取本机 SodaMusic 数据目录并分析账号态信号中。';
    const payload = await api('/api/auth/status');
    renderAuthStatus(payload);
  } catch (error) {
    els.authSummary.textContent = '登录态检测失败';
    els.authDetail.textContent = error.message;
  }
}

function disconnectPlaylistCoverObserver() {
  if (state.playlistCoverObserver) {
    state.playlistCoverObserver.disconnect();
    state.playlistCoverObserver = null;
  }
}

function replacePlaylistInState(nextPlaylist) {
  state.playlists = state.playlists.map(item => item.id === nextPlaylist.id ? { ...item, ...nextPlaylist } : item);
}

async function enrichVisiblePlaylistCover(playlistId, img) {
  if (!playlistId || state.visiblePlaylistCoverRequests.has(playlistId)) return;
  state.visiblePlaylistCoverRequests.add(playlistId);

  try {
    const payload = await api(`/api/playlist/share-meta?id=${encodeURIComponent(playlistId)}`);
    const cover = payload?.item?.cover || '';
    if (!cover) return;

    replacePlaylistInState({ id: playlistId, cover });
    if (img?.dataset?.playlistId === playlistId) {
      img.src = coverOrFallback(cover, { placeholderLabel: 'List', viaProxy: true });
      img.dataset.coverResolved = '1';
    }
  } catch {
    // ignore
  } finally {
    state.visiblePlaylistCoverRequests.delete(playlistId);
  }
}

function ensurePlaylistCoverObserver() {
  if (state.playlistCoverObserver) return state.playlistCoverObserver;
  state.playlistCoverObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      const playlistId = img.dataset.playlistId || '';
      state.playlistCoverObserver.unobserve(img);
      if (img.dataset.coverResolved === '1') continue;
      void enrichVisiblePlaylistCover(playlistId, img);
    }
  }, {
    root: null,
    rootMargin: '240px 0px',
    threshold: 0.01,
  });
  return state.playlistCoverObserver;
}

function observeVisiblePlaylistCovers() {
  if (state.resultType !== 'playlists') return;
  const observer = ensurePlaylistCoverObserver();
  const playlistImages = els.results.querySelectorAll('img[data-playlist-id]');
  for (const img of playlistImages) {
    if (img.dataset.coverResolved === '1') continue;
    observer.observe(img);
  }
}

function renderResults(items, type) {
  state.resultType = type;
  if (type !== 'playlists') disconnectPlaylistCoverObserver();
  els.resultType.textContent = type === 'songs' ? '歌曲' : '歌单';
  els.results.innerHTML = '';

  if (!items.length) {
    els.results.innerHTML = '<div class="hint">没有找到结果。</div>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card';
    const metaText = type === 'songs'
      ? `${item.artist || '未知歌手'}${item.album ? ` · ${item.album}` : ''}`
      : `${item.creator || '未知创建者'}${item.trackCount ? ` · ${item.trackCount} 首` : ''}`;
    const flags = type === 'songs'
      ? getPlaybackHints(item).map(flag => `<span class="flag flag-${flag.level}">${escapeHtml(flag.text)}</span>`).join('')
      : '';
    const coverSrc = type === 'playlists'
      ? coverOrFallback(item.cover, { placeholderLabel: 'List', viaProxy: true })
      : coverOrFallback(item.cover, { placeholderLabel: 'Song', viaProxy: true });

    card.innerHTML = `
      <img src="${coverSrc}" alt="${escapeHtml(item.name || '')}">
      <div>
        <h3>${escapeHtml(item.name || '')}</h3>
        <p>${escapeHtml(metaText)}</p>
        <p>数据来源：${escapeHtml(item.source || 'soda')}</p>
        ${type === 'songs' ? `<div class="card-flags">${flags}</div>` : ''}
      </div>
      <div class="mini-actions"></div>
    `;

    const coverImg = card.querySelector('img');
    if (coverImg) {
      coverImg.addEventListener('error', () => {
        coverImg.src = fallbackCoverDataUrl(type === 'playlists' ? 'List' : 'Song');
      }, { once: true });

      if (type === 'playlists') {
        coverImg.dataset.playlistId = item.id || '';
        coverImg.dataset.coverResolved = item.cover && !String(item.cover).includes('~c5_300x300.jpg') ? '1' : '0';
      }
    }

    const actionWrap = card.querySelector('.mini-actions');
    if (type === 'songs') {
      const playBtn = document.createElement('button');
      playBtn.textContent = '试听';
      playBtn.addEventListener('click', () => playSong(item));
      actionWrap.appendChild(playBtn);

      const lyricBtn = document.createElement('button');
      lyricBtn.textContent = '歌词';
      lyricBtn.addEventListener('click', () => showLyrics(item));
      actionWrap.appendChild(lyricBtn);
    } else {
      const detailBtn = document.createElement('button');
      detailBtn.textContent = '查看曲目';
      detailBtn.addEventListener('click', () => loadPlaylistDetail(item));
      actionWrap.appendChild(detailBtn);
    }

    els.results.appendChild(card);
  }

  if (type === 'playlists') {
    observeVisiblePlaylistCovers();
  }
}

function createPlaybackMetrics(song, sourceLabel, playbackUrl) {
  state.playbackMetricRunId += 1;
  state.playbackMetrics = {
    runId: state.playbackMetricRunId,
    songId: song?.id || '',
    songName: song?.name || '未知歌曲',
    sourceLabel,
    playbackUrl,
    startAt: performance.now(),
    marks: new Map(),
    lines: [],
  };
  const safeUrl = playbackUrl ? playbackUrl.slice(0, 140) : '';
  state.playbackMetrics.lines.push(`歌曲：${state.playbackMetrics.songName}`);
  state.playbackMetrics.lines.push(`播放源：${sourceLabel}`);
  state.playbackMetrics.lines.push(`请求地址：${safeUrl}${playbackUrl.length > 140 ? '…' : ''}`);
  recordPlaybackMark('click');
}

function recordPlaybackMark(name, extra = '') {
  const metrics = state.playbackMetrics;
  if (!metrics || metrics.marks.has(name)) return;
  const elapsed = performance.now() - metrics.startAt;
  metrics.marks.set(name, elapsed);
  metrics.lines.push(`${name.padEnd(16, ' ')} ${elapsed.toFixed(0)} ms${extra ? `  ${extra}` : ''}`);
  renderPlaybackMetrics();
}

function renderPlaybackMetrics() {
  const metrics = state.playbackMetrics;
  if (!metrics) {
    els.timingSummary.textContent = '未开始';
    els.timingLog.textContent = '点击试听后，这里会显示 click、loadstart、loadedmetadata、canplay、playing 的时间。';
    return;
  }

  const playingMs = metrics.marks.get('playing');
  const canplayMs = metrics.marks.get('canplay');
  const loadstartMs = metrics.marks.get('loadstart');

  if (typeof playingMs === 'number') {
    els.timingSummary.textContent = `已播放 ${playingMs.toFixed(0)} ms`;
  } else if (typeof canplayMs === 'number') {
    els.timingSummary.textContent = `可播 ${canplayMs.toFixed(0)} ms`;
  } else if (typeof loadstartMs === 'number') {
    els.timingSummary.textContent = `已发流 ${loadstartMs.toFixed(0)} ms`;
  } else {
    els.timingSummary.textContent = '启动中';
  }

  const derived = [];
  if (metrics.marks.has('loadstart')) derived.push(`点击 → loadstart: ${metrics.marks.get('loadstart').toFixed(0)} ms`);
  if (metrics.marks.has('loadedmetadata') && metrics.marks.has('loadstart')) derived.push(`loadstart → metadata: ${(metrics.marks.get('loadedmetadata') - metrics.marks.get('loadstart')).toFixed(0)} ms`);
  if (metrics.marks.has('canplay') && metrics.marks.has('loadstart')) derived.push(`loadstart → canplay: ${(metrics.marks.get('canplay') - metrics.marks.get('loadstart')).toFixed(0)} ms`);
  if (metrics.marks.has('playing') && metrics.marks.has('loadstart')) derived.push(`loadstart → playing: ${(metrics.marks.get('playing') - metrics.marks.get('loadstart')).toFixed(0)} ms`);
  if (metrics.marks.has('playing')) derived.push(`点击 → playing: ${metrics.marks.get('playing').toFixed(0)} ms`);

  els.timingLog.textContent = [...metrics.lines, '', ...derived].join('\n');
}

async function searchSongs() {
  const q = els.keyword.value.trim();
  if (!q) return setText(els.searchStatus, '请输入关键词', true);
  state.autoAdvanceTried = new Set();
  state.playbackCheckRunId += 1;
  try {
    setText(els.searchStatus, '正在搜索歌曲...');
    const payload = await api(`/api/search/songs?q=${encodeURIComponent(q)}`);
    state.songs = payload.items || [];
    renderResults(state.songs, 'songs');
    setText(els.searchStatus, payload.error || `找到 ${state.songs.length} 首歌曲`, Boolean(payload.error));
    schedulePlaybackChecks(state.songs, state.playbackCheckRunId);
  } catch (error) {
    setText(els.searchStatus, error.message, true);
  }
}

async function searchPlaylists() {
  const q = els.keyword.value.trim();
  if (!q) return setText(els.searchStatus, '请输入关键词', true);
  state.visiblePlaylistCoverRequests = new Set();
  try {
    setText(els.searchStatus, '正在搜索歌单...');
    const payload = await api(`/api/search/playlists?q=${encodeURIComponent(q)}`);
    state.playlists = payload.items || [];
    renderResults(state.playlists, 'playlists');
    setText(els.searchStatus, payload.error || `找到 ${state.playlists.length} 个歌单`, Boolean(payload.error));
  } catch (error) {
    setText(els.searchStatus, error.message, true);
  }
}

async function loadPlaylistDetail(playlist) {
  state.autoAdvanceTried = new Set();
  state.playbackCheckRunId += 1;
  try {
    setText(els.searchStatus, `正在加载歌单《${playlist.name}》...`);
    const payload = await api(`/api/playlist/detail?id=${encodeURIComponent(playlist.id)}`);
    state.songs = payload.items || [];
    renderResults(state.songs, 'songs');
    setText(els.searchStatus, payload.error || `《${playlist.name}》共 ${state.songs.length} 首`, Boolean(payload.error));
    schedulePlaybackChecks(state.songs, state.playbackCheckRunId);
  } catch (error) {
    setText(els.searchStatus, error.message, true);
  }
}

async function enrichSongDetail(song) {
  if (song?.detailLoaded) return song;
  try {
    const detailPayload = await api(`/api/song/detail?id=${encodeURIComponent(song.id)}`);
    if (!detailPayload.item) return { ...song, detailLoaded: true };
    return mergeSong(song, { ...detailPayload.item, detailLoaded: true });
  } catch {
    return song;
  }
}

async function checkPlayback(song) {
  if (song?.playbackCheck?.preferredSource) return song;
  try {
    const payload = await api(`/api/playback/check?id=${encodeURIComponent(song.id)}&name=${encodeURIComponent(song.name || '')}&artist=${encodeURIComponent(song.artist || '')}&album=${encodeURIComponent(song.album || '')}&cover=${encodeURIComponent(song.cover || '')}`);
    return mergeSong(song, {
      playbackCheck: payload,
      auditionUrl: payload.shareTrack?.auditionUrl || song.auditionUrl || '',
      extra: {
        ...(song.extra || {}),
        auditionUrl: payload.shareTrack?.auditionUrl || song.extra?.auditionUrl || '',
      },
      ...(payload.shareTrack || {}),
      detailLoaded: Boolean(payload.shareTrack),
    });
  } catch {
    return song;
  }
}

function replaceSongInState(nextSong) {
  state.songs = state.songs.map(song => song.id === nextSong.id ? mergeSong(song, nextSong) : song);
  if (state.currentSong?.id === nextSong.id) {
    state.currentSong = mergeSong(state.currentSong, nextSong);
  }
}

function setAudioSource(url) {
  if (!url) return;
  els.audio.pause();
  els.audio.removeAttribute('src');
  els.audio.src = url;
}

async function schedulePlaybackChecks(songs, runId) {
  const targets = songs.slice(0, 6);
  for (const song of targets) {
    if (runId !== state.playbackCheckRunId || state.isStartingPlayback) return;
    const nextSong = await checkPlayback(song);
    if (runId !== state.playbackCheckRunId || state.isStartingPlayback) return;
    replaceSongInState(nextSong);
    if (state.resultType === 'songs') renderResults(state.songs, 'songs');
  }
}

function getPlayableCandidateAfter(currentId) {
  if (!state.songs.length) return null;
  const currentIndex = state.songs.findIndex(song => song.id === currentId);
  const ordered = currentIndex >= 0
    ? [...state.songs.slice(currentIndex + 1), ...state.songs.slice(0, currentIndex)]
    : [...state.songs];

  return ordered.find(song => {
    if (!song?.id || state.autoAdvanceTried.has(song.id)) return false;
    const preferred = song.playbackCheck?.preferredSource;
    return preferred === 'upstream' || preferred === 'share' || Boolean(song.id);
  }) || null;
}

async function tryAutoAdvanceFromFailedSong(failedSongId) {
  const candidate = getPlayableCandidateAfter(failedSongId);
  if (!candidate) return false;
  state.autoAdvanceTried.add(candidate.id);
  setText(els.searchStatus, `当前歌曲不可播，自动切到下一首：${candidate.name}`);
  await playSong(candidate, { autoAdvanced: true });
  return true;
}

async function showLyrics(song, options = {}) {
  const { deferMs = 0 } = options;
  const token = ++state.lyricsRequestToken;
  applySongDetail(song);
  els.lyrics.textContent = deferMs > 0 ? '播放已开始，正在补歌词...' : '正在加载歌词...';

  if (deferMs > 0) {
    await new Promise(resolve => window.setTimeout(resolve, deferMs));
    if (token !== state.lyricsRequestToken) return;
  }

  const enrichedSong = await enrichSongDetail(song);
  if (token !== state.lyricsRequestToken) return;
  replaceSongInState(enrichedSong);
  applySongDetail(enrichedSong);

  if (enrichedSong.lyric) {
    els.lyrics.textContent = enrichedSong.lyric;
    return;
  }

  try {
    const payload = await api(`/api/lyrics?id=${encodeURIComponent(song.id)}&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist || '')}&album=${encodeURIComponent(song.album || '')}`);
    if (token !== state.lyricsRequestToken) return;
    if (payload.detail) {
      const merged = mergeSong(enrichedSong, payload.detail);
      replaceSongInState(merged);
      applySongDetail(merged);
    }
    els.lyrics.textContent = payload.lyric || '未获取到歌词';
  } catch (error) {
    if (token !== state.lyricsRequestToken) return;
    els.lyrics.textContent = error.message;
  }
}

async function playSong(song, options = {}) {
  state.isStartingPlayback = true;
  state.playbackCheckRunId += 1;
  const detailToken = ++state.detailRequestToken;
  state.lyricsRequestToken += 1;

  try {
    const nextSong = song;
    const shareUrl = pickFirstNonEmpty(nextSong.auditionUrl, nextSong.extra?.auditionUrl);
    const shouldUseShareFirst = Boolean(nextSong.id);
    const playbackUrl = shouldUseShareFirst
      ? buildStreamUrl(nextSong, shareUrl ? { preferred: 'share', shareUrl } : { preferred: 'share' })
      : buildStreamUrl(nextSong);
    const playbackLabel = shouldUseShareFirst ? '分享页优先（请求）' : '自动选择';

    createPlaybackMetrics(nextSong, playbackLabel, playbackUrl);
    replaceSongInState(nextSong);
    state.currentSong = mergeSong(state.currentSong || {}, nextSong);
    if (!options.autoAdvanced) {
      state.autoAdvanceTried = new Set([nextSong.id]);
    }

    els.player.classList.remove('hidden');
    els.playerCover.src = coverOrFallback(nextSong.cover, { placeholderLabel: 'Song', viaProxy: true });
    els.playerCover.onerror = () => { els.playerCover.src = fallbackCoverDataUrl('Song'); };
    els.playerTitle.textContent = nextSong.name || '未知歌曲';
    els.playerArtist.textContent = nextSong.artist || '未知歌手';
    els.playerToggle.textContent = '暂停';
    setPlayerSource(playbackLabel);
    applySongDetail(nextSong);
    renderResults(state.songs, 'songs');

    setAudioSource(playbackUrl);
    const playPromise = els.audio.play();
    setText(els.searchStatus, options.autoAdvanced ? `已自动切换试听：${nextSong.name}` : `正在试听：${nextSong.name}`);
    void showLyrics(nextSong, { deferMs: 1200 });

    void checkPlayback(nextSong).then(probedSong => {
      if (detailToken !== state.detailRequestToken) return;
      const merged = mergeSong(nextSong, probedSong);
      const resolvedSource = merged.playbackCheck?.preferredSource;
      replaceSongInState(merged);
      if (state.currentSong?.id === merged.id) {
        state.currentSong = merged;
        if (resolvedSource === 'share') {
          setPlayerSource('分享页可播');
        } else if (resolvedSource === 'upstream') {
          setPlayerSource('分享页失败，已回退上游');
        } else {
          setPlayerSource('分享页优先（结果未明）');
        }
      }
      renderResults(state.songs, 'songs');
    });

    if (!nextSong.detailLoaded) {
      void enrichSongDetail(nextSong).then(enriched => {
        if (detailToken !== state.detailRequestToken) return;
        const merged = mergeSong(nextSong, enriched);
        replaceSongInState(merged);
        if (state.currentSong?.id === merged.id) {
          state.currentSong = merged;
          els.playerCover.src = coverOrFallback(merged.cover, { placeholderLabel: 'Song', viaProxy: true });
          els.playerCover.onerror = () => { els.playerCover.src = fallbackCoverDataUrl('Song'); };
          els.playerTitle.textContent = merged.name || '未知歌曲';
          els.playerArtist.textContent = merged.artist || '未知歌手';
          applySongDetail(merged);
        }
      });
    }

    await playPromise;
  } catch (error) {
    recordPlaybackMark('play() reject', error?.message || '播放被拒绝');
    setText(els.searchStatus, `试听失败：${error.message}`, true);
  } finally {
    state.isStartingPlayback = false;
  }
}

function togglePlayback() {
  if (!els.audio.src) return;
  if (els.audio.paused) {
    els.audio.play().catch(error => {
      setText(els.searchStatus, `播放失败：${error.message}`, true);
    });
    els.playerToggle.textContent = '暂停';
  } else {
    els.audio.pause();
    els.playerToggle.textContent = '播放';
  }
}

els.searchSongs.addEventListener('click', searchSongs);
els.searchPlaylists.addEventListener('click', searchPlaylists);
els.checkAuth.addEventListener('click', checkClientAuth);
els.playerToggle.addEventListener('click', togglePlayback);
els.audio.addEventListener('loadstart', () => {
  const source = els.audio.currentSrc || els.audio.src || '';
  recordPlaybackMark('loadstart', source ? source.slice(0, 120) : '');
});
els.audio.addEventListener('loadedmetadata', () => {
  const duration = Number.isFinite(els.audio.duration) ? `${els.audio.duration.toFixed(2)}s` : 'duration=NaN';
  recordPlaybackMark('loadedmetadata', duration);
});
els.audio.addEventListener('canplay', () => recordPlaybackMark('canplay'));
els.audio.addEventListener('playing', () => {
  els.playerToggle.textContent = '暂停';
  recordPlaybackMark('playing');
});
els.audio.addEventListener('pause', () => {
  els.playerToggle.textContent = '播放';
});
els.audio.addEventListener('waiting', () => recordPlaybackMark('waiting'));
els.audio.addEventListener('stalled', () => recordPlaybackMark('stalled'));
els.audio.addEventListener('error', async () => {
  recordPlaybackMark('error', els.audio.error?.message || `code=${els.audio.error?.code || 'unknown'}`);
  const failedSongId = state.currentSong?.id || '';
  const advanced = await tryAutoAdvanceFromFailedSong(failedSongId);
  if (advanced) return;
  setPlayerSource('无可用播放源');
  setText(els.searchStatus, '这首歌当前无法试听，换一首通常可以。', true);
  els.playerToggle.textContent = '播放';
});
els.keyword.addEventListener('keydown', event => {
  if (event.key === 'Enter') searchSongs();
});

els.cover.src = coverOrFallback('', { forcePlaceholder: true, placeholderLabel: 'Song' });
els.playerCover.src = coverOrFallback('', { forcePlaceholder: true, placeholderLabel: 'Song' });
renderPlaybackMetrics();
setPlayerSource('未开始');
checkClientAuth();
