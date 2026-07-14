import { logger } from '../logger.js';
import { pickFirstMediaUrl } from '../utils/media-url.js';
import { buildLyricSearchPlans, cleanSongTitle } from './lyric-query.js';

export function createSongService(apiClient, auth) {
  return {
    async getSongUrl(hash, albumId = 0, albumAudioId = 0, title = '', artist = '') {
      await auth.ensureDfid();

      const attempts = this.buildSongUrlAttempts(hash, albumId, albumAudioId);
      for (const attempt of attempts) {
        try {
          const payload = await apiClient.get(attempt.path, attempt.params, {
            injectCookie: true,
            retryOnAuth: true,
            skipPlatform: true
          });

          if (this.extractPlayableUrl(payload)) return payload;
          if (!this.isMissingPlayableSource(payload)) return payload;
        } catch (error) {
          logger.warn(`Direct play-url request failed for ${attempt.path}: ${error.message}`);
        }
      }

      const payload = await apiClient.gatewayGet(`/songs/${encodeURIComponent(hash)}/play-url`, {
        albumId,
        albumAudioId,
        title,
        artist
      });
      return apiClient.unwrapGateway(payload);
    },
    buildSongUrlAttempts(hash, albumId = 0, albumAudioId = 0) {
      const baseParams = {
        hash,
        album_id: albumId || 0,
        album_audio_id: albumAudioId || 0,
        quality: 128,
        free_part: 1
      };

      return [
        { path: '/song/url', params: { ...baseParams, platform: 'life' } },
        { path: '/song/url', params: { ...baseParams, platform: 'lite' } },
        { path: '/song/url/new', params: { ...baseParams, platform: 'life' } },
        { path: '/song/url/new', params: { ...baseParams, platform: 'lite' } }
      ];
    },
    async searchLyric(meta) {
      const plans = buildLyricSearchPlans(meta);
      let lastPayload = {};

      for (const plan of plans) {
        lastPayload = await apiClient.get('/search/lyric', plan.params, {
          injectCookie: true,
          retryOnAuth: false
        });

        const lyricMeta = this.extractLyricMeta(lastPayload);
        if (lyricMeta.id && lyricMeta.accesskey) return lastPayload;
        logger.warn(`Lyric search has no usable id/accesskey yet, continue with ${plan.label}`);
      }

      return lastPayload;
    },
    async getLyric(id, accesskey) {
      return await apiClient.get('/lyric', {
        id,
        accesskey,
        fmt: 'lrc',
        decode: true
      }, { injectCookie: true, retryOnAuth: false });
    },
    async getImages(hash, albumId = 0, albumAudioId = 0) {
      return await apiClient.get('/images', {
        hash,
        album_id: albumId,
        album_audio_id: albumAudioId,
        count: 1
      }, { injectCookie: true, retryOnAuth: false });
    },
    extractPlayableUrl(payload) {
      const candidates = [];
      const visit = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
          if (/^https?:\/\//i.test(value)) candidates.push(value);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (typeof value === 'object') {
          visit(value.url);
          visit(value.play_url);
          visit(value.file);
          visit(value.src);
          visit(value.audio_url);
          visit(value.backup_url);
          visit(value.data);
        }
      };
      visit(payload);
      return candidates[0] || '';
    },
    isMissingPlayableSource(payload) {
      if (!payload || typeof payload !== 'object') return false;
      const url = this.extractPlayableUrl(payload);
      if (url) return false;

      const status = Number(payload.status ?? 0);
      const privStatus = Number(payload.priv_status ?? 0);
      const code = Number(payload.code ?? 0);
      return code === 4404 || status === 3 || privStatus === 0 || (code === 0 && payload.url === null);
    },
    explainMissingPlayableSource(payload) {
      if (!this.isMissingPlayableSource(payload)) return '';
      const status = Number(payload?.status ?? 0);
      const privStatus = Number(payload?.priv_status ?? 0);
      const code = Number(payload?.code ?? 0);
      return `Current song has no playable source and was skipped (code=${code}, status=${status}, priv_status=${privStatus})`;
    },
    extractCover(payload, fallback = '') {
      const candidates = [];
      const visit = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
          candidates.push(value);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (typeof value === 'object') {
          visit(value.image);
          visit(value.img);
          visit(value.cover);
          visit(value.author_image);
          visit(value.album_image);
          visit(value.avatar);
          visit(value.sizable_cover);
          visit(value.sizable_avatar);
          visit(value.sizable_portrait);
          visit(value.union_cover);
          visit(value.pic);
          visit(value.data);
        }
      };
      visit(payload);
      return pickFirstMediaUrl(candidates) || fallback;
    },
    extractLyricMeta(payload) {
      const candidates = [
        ...(Array.isArray(payload?.candidates) ? payload.candidates : []),
        ...(Array.isArray(payload?.data?.candidates) ? payload.data.candidates : []),
        ...(Array.isArray(payload?.data) ? payload.data : [])
      ];

      if (candidates.length) {
        const first = candidates[0] || {};
        return {
          id: first.id || first.lyricid || first.candidate_id || '',
          accesskey: first.accesskey || first.AccessKey || '',
          text: first.content || first.lyrics || ''
        };
      }

      const data = payload?.data || payload || {};
      return {
        id: data.id || '',
        accesskey: data.accesskey || '',
        text: data.content || ''
      };
    },
    extractLyricText(payload) {
      const data = payload?.data || payload || {};
      return data.decodeContent || data.content || payload?.decodeContent || '';
    },
    parseLrc(text) {
      if (!text) return [];
      const rows = [];
      const lines = String(text).split(/\r?\n/);
      for (const rawLine of lines) {
        const tags = [...rawLine.matchAll(/\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]/g)];
        const lyricText = rawLine.replace(/\[[^\]]+\]/g, '').trim();
        if (!tags.length || !lyricText) continue;
        for (const tag of tags) {
          const minute = Number(tag[1] || 0);
          const second = Number(tag[2] || 0);
          rows.push({ time: minute * 60 + second, text: lyricText });
        }
      }
      return rows.sort((a, b) => a.time - b.time);
    },
    cleanSongTitle(title) {
      return cleanSongTitle(title);
    }
  };
}
