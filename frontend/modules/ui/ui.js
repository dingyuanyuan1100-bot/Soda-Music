export function createUi() {
  const els = {
    baseUrl: document.getElementById('base-url'),
    platform: document.getElementById('platform'),
    refreshMinutes: document.getElementById('refresh-minutes'),
    autoRefresh: document.getElementById('auto-refresh'),
    sessionPill: document.getElementById('session-pill'),
    tokenView: document.getElementById('token-view'),
    useridView: document.getElementById('userid-view'),
    dfidView: document.getElementById('dfid-view'),
    refreshView: document.getElementById('refresh-view'),
    profileNameView: document.getElementById('profile-name-view'),
    profileAvatar: document.getElementById('profile-avatar'),
    profileMetaView: document.getElementById('profile-meta-view'),
    mobile: document.getElementById('mobile'),
    smsCode: document.getElementById('sms-code'),
    manualAuth: document.getElementById('manual-auth'),
    qrImage: document.getElementById('qr-image'),
    qrStatus: document.getElementById('qr-status'),
    qrMeta: document.getElementById('qr-meta'),
    searchKeywords: document.getElementById('search-keywords'),
    searchType: document.getElementById('search-type'),
    searchResults: document.getElementById('search-results'),
    searchEmpty: document.getElementById('search-empty'),
    playlistResults: document.getElementById('playlist-results'),
    playlistEmpty: document.getElementById('playlist-empty'),
    logs: document.getElementById('logs'),
    logsEmpty: document.getElementById('logs-empty'),
    playerTitle: document.getElementById('player-title'),
    playerSub: document.getElementById('player-sub'),
    playerUrl: document.getElementById('player-url'),
    playerCover: document.getElementById('player-cover'),
    audioPlayer: document.getElementById('audio-player'),
    lyricsPanel: document.getElementById('lyrics-panel'),
    videoTitle: document.getElementById('video-title'),
    videoSub: document.getElementById('video-sub'),
    videoUrl: document.getElementById('video-url'),
    videoPlayer: document.getElementById('video-player'),
    videoPoster: document.getElementById('video-poster')
  };

  const escapeHtml = (text) => String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const defaultCover = () => 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#58d8ff" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#9b7cff" stop-opacity="0.45"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" rx="28" fill="url(#g)"/>
      <circle cx="200" cy="200" r="110" fill="rgba(255,255,255,0.65)"/>
      <circle cx="200" cy="200" r="28" fill="#101825"/>
    </svg>
  `);

  return {
    els,
    renderSettings(settings) {
      els.baseUrl.value = settings.baseUrl || '';
      els.platform.value = settings.platform || '';
      els.refreshMinutes.value = settings.refreshMinutes || 30;
      els.autoRefresh.value = String(settings.autoRefreshEnabled !== false);
    },
    renderAuth(auth) {
      const loggedIn = Boolean(auth.token && auth.userid);
      els.sessionPill.textContent = loggedIn ? '已登录' : '未登录';
      els.sessionPill.className = loggedIn ? 'pill' : 'pill warn';
      els.tokenView.textContent = auth.token ? `${auth.token.slice(0, 10)}...${auth.token.slice(-4)}` : '未保存';
      els.useridView.textContent = auth.userid || '未保存';
      els.dfidView.textContent = auth.dfid || '未保存';
      els.refreshView.textContent = auth.lastRefreshAt ? new Date(auth.lastRefreshAt).toLocaleString() : '尚未刷新';
      if (els.profileNameView) {
        els.profileNameView.textContent = auth.nickname || auth.username || auth.userid || '未获取';
      }
      if (els.profileMetaView) {
        els.profileMetaView.textContent = auth.nickname && auth.username && auth.nickname !== auth.username
          ? auth.username
          : (auth.userid || '');
      }
      if (els.profileAvatar) {
        els.profileAvatar.src = auth.avatar || defaultCover();
      }
    },
    renderQrLogin(state = {}) {
      if (els.qrImage) els.qrImage.src = state.image || defaultCover();
      if (els.qrStatus) els.qrStatus.textContent = state.statusText || '未生成二维码';
      if (els.qrMeta) {
        const parts = [];
        if (state.key) parts.push(`key: ${state.key}`);
        if (state.url) parts.push(state.url);
        els.qrMeta.textContent = parts.join(' | ');
      }
    },
    renderSearchResults(items) {
      els.searchResults.innerHTML = '';
      const list = Array.isArray(items) ? items : [];
      els.searchEmpty.style.display = list.length ? 'none' : 'block';

      for (const item of list) {
        const title = item.__title || item.songname || item.filename || item.name || item.album_name || '未命名结果';
        const subtitle = item.__subtitle || item.author_name || item.singername || item.owner_name || item.remark || item.album_name || '无附加信息';
        const meta = item.__meta || `hash: ${item.hash || item.audio_id || item.album_audio_id || '无'}`;
        const kind = item.__kind || 'song';
        const playable = item.__playable !== false;
        const hash = item.hash || item.audio_id || item.album_audio_id || '';
        const statusText = item.__statusText || '';
        const albumId = item.album_id || item.albumid || 0;
        const albumAudioId = item.album_audio_id || item.audio_id || 0;
        const duration = item.duration || item.timelen || 0;
        const cover = item.img || item.image || item.cover || item.album_img || item.singerimg || '';
        const actions = item.__actions || (item.__action ? [item.__action] : []);

        const node = document.createElement('div');
        node.className = 'item';
        if (hash) node.dataset.songHash = String(hash).toUpperCase();

        const actionHtml = playable
          ? `
                <button class="secondary" data-action="song-url" data-hash="${escapeHtml(hash)}" data-album-id="${escapeHtml(albumId)}" data-album-audio-id="${escapeHtml(albumAudioId)}">取 URL</button>
                <button data-action="play-song"
                  data-title="${escapeHtml(title)}"
                  data-artist="${escapeHtml(subtitle)}"
                  data-hash="${escapeHtml(hash)}"
                  data-album-id="${escapeHtml(albumId)}"
                  data-album-audio-id="${escapeHtml(albumAudioId)}"
                  data-duration="${escapeHtml(duration)}"
                  data-cover="${escapeHtml(cover)}">播放</button>
            `
          : actions.length
            ? actions.map((action) => `
                <button class="secondary"
                  data-action="${escapeHtml(action.action || '')}"
                  data-id="${escapeHtml(action.payload?.id || '')}"
                  data-title="${escapeHtml(action.payload?.title || '')}"
                  data-artist="${escapeHtml(action.payload?.artist || '')}"
                  data-cover="${escapeHtml(action.payload?.cover || '')}">${escapeHtml(action.payload?.label || '查看详情')}</button>
              `).join('')
            : `<button class="secondary" disabled>${escapeHtml(this.describeSearchKind(kind))}</button>`;

        node.innerHTML = `
          <div class="item-row">
            <div>
              <div class="item-title">${escapeHtml(title)}</div>
              <div class="item-sub">${escapeHtml(subtitle)}</div>
              <div class="item-sub mono">${escapeHtml(meta)}</div>
              ${statusText ? `<div class="item-sub status-note">${escapeHtml(statusText)}</div>` : ''}
            </div>
            <div class="actions" style="margin-top: 0;">
              ${actionHtml}
            </div>
          </div>
        `;
        els.searchResults.appendChild(node);
      }
    },
    describeSearchKind(kind) {
      const labels = {
        song: '可播放',
        special: '歌单结果',
        album: '专辑结果',
        author: '歌手结果',
        mv: 'MV 结果',
        lyric: '歌词结果'
      };
      return labels[kind] || '搜索结果';
    },
    markSongUnavailable(hash, reason = '当前歌曲没有可用音源') {
      const normalizedHash = String(hash || '').trim().toUpperCase();
      if (!normalizedHash) return;
      const rows = [...els.searchResults.querySelectorAll('.item[data-song-hash]')]
        .filter((node) => node.dataset.songHash === normalizedHash);
      for (const row of rows) {
        const playButton = row.querySelector('button[data-action="play-song"]');
        const urlButton = row.querySelector('button[data-action="song-url"]');
        if (playButton) {
          playButton.disabled = true;
          playButton.textContent = '无音源';
        }
        if (urlButton) urlButton.disabled = true;
        let note = row.querySelector('.status-note');
        if (!note) {
          note = document.createElement('div');
          note.className = 'item-sub status-note';
          const container = row.querySelector('.item-row > div');
          if (container) container.appendChild(note);
        }
        if (note) note.textContent = reason;
      }
    },
    renderPlaylists(items) {
      els.playlistResults.innerHTML = '';
      const list = Array.isArray(items) ? items : [];
      els.playlistEmpty.style.display = list.length ? 'none' : 'block';
      for (const item of list) {
        const id = item.global_collection_id || item.listid || item.id || '';
        const title = item.name || item.specialname || '未命名歌单';
        const count = item.count || item.song_count || item.musiccount || 0;
        const node = document.createElement('div');
        node.className = 'item';
        node.innerHTML = `
          <div class="item-row">
            <div>
              <div class="item-title">${escapeHtml(title)}</div>
              <div class="item-sub">歌曲数: ${escapeHtml(String(count))}</div>
              <div class="item-sub mono">id: ${escapeHtml(id || '无')}</div>
            </div>
            <div class="actions" style="margin-top: 0;">
              <button class="secondary" data-action="playlist-tracks" data-id="${escapeHtml(id)}">查看歌曲</button>
            </div>
          </div>
        `;
        els.playlistResults.appendChild(node);
      }
    },
    renderLogs(entries) {
      els.logs.innerHTML = '';
      els.logsEmpty.style.display = entries.length ? 'none' : 'block';
      for (const entry of entries) {
        const node = document.createElement('div');
        node.className = `log-entry ${entry.level}`;
        node.innerHTML = `<strong>${escapeHtml(entry.time)}</strong><br>${escapeHtml(entry.message)}`;
        els.logs.appendChild(node);
      }
    },
    renderPlayer(meta) {
      els.playerTitle.textContent = meta.title || '当前未选择歌曲';
      els.playerSub.textContent = meta.sub || '从搜索结果或歌单列表中点击播放。';
      els.playerUrl.textContent = meta.url ? `url: ${meta.url}` : '';
      els.playerCover.src = meta.cover || defaultCover();
    },
    renderVideoPlayer(meta = {}) {
      if (!els.videoPlayer) return;
      els.videoTitle.textContent = meta.title || '当前未选择 MV';
      els.videoSub.textContent = meta.sub || '从 MV 搜索结果中点击播放 MV。';
      els.videoUrl.textContent = meta.url ? `url: ${meta.url}` : '';
      els.videoPoster.src = meta.cover || defaultCover();
      if (meta.url) {
        els.videoPlayer.src = meta.url;
      } else {
        els.videoPlayer.pause();
        els.videoPlayer.removeAttribute('src');
        els.videoPlayer.load();
      }
      if (meta.cover) els.videoPlayer.poster = meta.cover;
      else els.videoPlayer.removeAttribute('poster');
    },
    renderLyrics(lines, activeIndex = -1) {
      if (!lines.length) {
        els.lyricsPanel.innerHTML = '<div class="lyric-line active">暂无歌词。</div>';
        return;
      }
      els.lyricsPanel.innerHTML = lines.map((line, index) => {
        const active = index === activeIndex ? ' active' : '';
        return `<div class="lyric-line${active}" data-index="${index}">${escapeHtml(line.text || '...')}</div>`;
      }).join('');
    },
    setActiveLyric(index) {
      const nodes = [...els.lyricsPanel.querySelectorAll('.lyric-line')];
      nodes.forEach((node, i) => node.classList.toggle('active', i === index));
      const active = nodes[index];
      if (active) {
        const top = active.offsetTop - els.lyricsPanel.clientHeight / 2 + active.clientHeight / 2;
        els.lyricsPanel.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    },
    defaultCover,
  };
}
