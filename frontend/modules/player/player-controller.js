import { logger } from '../logger.js';
import { normalizeMediaUrl } from '../utils/media-url.js';

export function createPlayerController(ui, songService) {
  const defaultMeta = {
    title: '当前未选择歌曲',
    sub: '从搜索结果或歌单列表中点击播放。',
    url: '',
    cover: ''
  };

  return {
    state: {
      lyricLines: [],
      activeIndex: -1,
    },
    init() {
      ui.els.audioPlayer.addEventListener('error', () => {
        const mediaError = ui.els.audioPlayer.error;
        const code = mediaError ? mediaError.code : 'unknown';
        logger.error(`音频播放失败，error code: ${code}`);
      });
      ui.els.audioPlayer.addEventListener('playing', () => {
        logger.info('音频开始播放');
      });
      ui.els.audioPlayer.addEventListener('stalled', () => {
        logger.warn('音频缓冲中断，播放可能不稳定');
      });
      ui.els.audioPlayer.addEventListener('timeupdate', () => {
        this.syncLyrics(ui.els.audioPlayer.currentTime);
      });
    },
    reset(meta = defaultMeta) {
      ui.els.audioPlayer.pause();
      ui.els.audioPlayer.removeAttribute('src');
      ui.els.audioPlayer.load();
      ui.renderPlayer(meta);
      this.resetLyrics();
    },
    resetLyrics(message = '歌词会在成功获取后显示。') {
      this.state.lyricLines = [];
      this.state.activeIndex = -1;
      ui.renderLyrics([{ text: message }], 0);
    },
    syncLyrics(currentTime) {
      if (!this.state.lyricLines.length) return;
      let nextIndex = -1;
      for (let i = 0; i < this.state.lyricLines.length; i += 1) {
        if (currentTime >= this.state.lyricLines[i].time) nextIndex = i;
        else break;
      }
      if (nextIndex !== this.state.activeIndex && nextIndex >= 0) {
        this.state.activeIndex = nextIndex;
        ui.setActiveLyric(nextIndex);
      }
    },
    async loadCover(meta) {
      const inlineCover = normalizeMediaUrl(meta.cover || '');
      if (inlineCover) return inlineCover;
      try {
        const payload = await songService.getImages(meta.hash, meta.albumId, meta.albumAudioId);
        const cover = songService.extractCover(payload, '');
        if (cover) logger.info('封面获取成功');
        return cover;
      } catch (error) {
        logger.warn(`封面获取失败: ${error.message}`);
        return '';
      }
    },
    async loadLyrics(meta) {
      try {
        const searchPayload = await songService.searchLyric(meta);
        const lyricMeta = songService.extractLyricMeta(searchPayload);
        if (!lyricMeta.id || !lyricMeta.accesskey) {
          const info = `status=${searchPayload?.status ?? ''}, info=${searchPayload?.info || searchPayload?.errmsg || ''}, keyword=${searchPayload?.keyword || meta.title || ''}`;
          logger.warn(`歌词搜索成功，但没有可用的 id/accesskey: ${info}`);
          this.resetLyrics('没有找到可用歌词。');
          return;
        }

        const lyricPayload = await songService.getLyric(lyricMeta.id, lyricMeta.accesskey);
        const lyricText = songService.extractLyricText(lyricPayload);
        const lines = songService.parseLrc(lyricText);
        if (!lines.length) {
          logger.warn('歌词接口返回成功，但未解析出可滚动的 LRC 内容');
          this.resetLyrics('歌词存在，但未解析出滚动时间轴。');
          return;
        }

        this.state.lyricLines = lines;
        this.state.activeIndex = -1;
        ui.renderLyrics(lines, -1);
        logger.info(`歌词加载成功，共 ${lines.length} 行`);
      } catch (error) {
        logger.warn(`歌词获取失败: ${error.message}`);
        this.resetLyrics('歌词获取失败。');
      }
    },
    async playSong(meta) {
      if (!meta.hash) {
        throw new Error('当前歌曲缺少 hash，无法获取播放链接');
      }

      ui.renderPlayer({
        title: meta.title || '未命名歌曲',
        sub: meta.artist || '',
        url: '',
        cover: normalizeMediaUrl(meta.cover || '')
      });
      this.resetLyrics('正在获取歌词...');

      const [songUrlPayload, cover] = await Promise.all([
        songService.getSongUrl(meta.hash, meta.albumId, meta.albumAudioId, meta.title || '', meta.artist || ''),
        this.loadCover(meta)
      ]);

      const url = songService.extractPlayableUrl(songUrlPayload);
      logger.info(`歌曲 URL 响应: ${JSON.stringify(songUrlPayload).slice(0, 260)}`);

      if (!url) {
        const reason = songService.explainMissingPlayableSource(songUrlPayload) || '未从 /song/url 响应中解析到可播放 URL';
        ui.markSongUnavailable(meta.hash, reason);
        ui.renderPlayer({
          title: meta.title || '未命名歌曲',
          sub: reason,
          url: '',
          cover: normalizeMediaUrl(cover || meta.cover || '')
        });
        this.resetLyrics('当前歌曲没有可用音源。');
        throw new Error(reason);
      }

      ui.els.audioPlayer.src = url;
      ui.renderPlayer({
        title: meta.title || '未命名歌曲',
        sub: meta.artist || '未知歌手',
        url,
        cover: normalizeMediaUrl(cover || meta.cover || '')
      });

      this.loadLyrics(meta).catch((error) => logger.warn(`歌词异步加载失败: ${error.message}`));

      try {
        await ui.els.audioPlayer.play();
      } catch (error) {
        logger.error(`浏览器拒绝自动播放: ${error.message}`);
      }
    }
  };
}
