import { logger } from '../logger.js';

const PLAYLIST_TRACK_PAGE_SIZE = 100;
const PLAYLIST_PAGE_SIZE = 50;

function unwrapPayload(payload) {
  return payload?.data || payload || {};
}

export function createPlaylistService(apiClient, auth) {
  return {
    async getMyPlaylists() {
      const attempts = this.buildMyPlaylistAttempts();
      let lastBusinessError = null;

      for (const attempt of attempts) {
        const payload = await apiClient.get('/user/playlist', attempt.params, {
          requireAuth: true,
          injectCookie: true
        });

        const businessError = this.extractBusinessError(payload);
        if (businessError) {
          lastBusinessError = businessError;
          logger.warn(`歌单列表请求失败，尝试下一组参数: ${businessError.message} | session=${auth.getSessionFieldSummary()}`);
          continue;
        }

        return this.pickList(payload);
      }

      throw this.toPlaylistError(lastBusinessError, '歌单列表加载失败');
    },
    async getPlaylistTracks(id) {
      const attempts = this.buildPlaylistTrackAttempts(id);
      let lastBusinessError = null;

      for (const attempt of attempts) {
        const payload = await apiClient.get('/playlist/track/all', attempt.params, {
          requireAuth: true,
          injectCookie: true
        });

        const businessError = this.extractBusinessError(payload);
        if (businessError) {
          lastBusinessError = businessError;
          logger.warn(`歌单歌曲请求失败，尝试下一组参数: ${businessError.message} | session=${auth.getSessionFieldSummary()}`);
          continue;
        }

        return this.pickList(payload);
      }

      throw this.toPlaylistError(lastBusinessError, '歌单歌曲加载失败');
    },
    buildMyPlaylistAttempts() {
      const state = auth.state || {};
      const userid = String(state.userid || '').trim();
      const mid = String(state.mid || state.musicid || state.kg_mid || '').trim();
      return [
        { params: { pagesize: PLAYLIST_PAGE_SIZE, userid, mid } },
        { params: { pagesize: PLAYLIST_PAGE_SIZE, uid: userid, mid } },
        { params: { pagesize: PLAYLIST_PAGE_SIZE, userid } },
        { params: { pagesize: PLAYLIST_PAGE_SIZE, uid: userid } },
        { params: { pagesize: PLAYLIST_PAGE_SIZE } }
      ];
    },
    buildPlaylistTrackAttempts(id) {
      const state = auth.state || {};
      const userid = String(state.userid || '').trim();
      const mid = String(state.mid || state.musicid || state.kg_mid || '').trim();
      return [
        { params: { id, pagesize: PLAYLIST_TRACK_PAGE_SIZE, userid, mid } },
        { params: { listid: id, pagesize: PLAYLIST_TRACK_PAGE_SIZE, userid, mid } },
        { params: { id, pagesize: PLAYLIST_TRACK_PAGE_SIZE, userid } },
        { params: { listid: id, pagesize: PLAYLIST_TRACK_PAGE_SIZE, userid } },
        { params: { id, pagesize: PLAYLIST_TRACK_PAGE_SIZE } }
      ];
    },
    extractBusinessError(payload) {
      const data = unwrapPayload(payload);
      if (!data || typeof data !== 'object') return null;

      const nested = data.data && typeof data.data === 'object' ? data.data : null;
      const candidate = Number(data.status) === 0 ? data : (nested && Number(nested.status) === 0 ? nested : null);
      if (!candidate) return null;

      const errorCode = Number(candidate.error_code || candidate.code || 0);
      const message = candidate.errmsg || candidate.error_msg || this.describeBusinessError(errorCode);
      return {
        code: errorCode,
        message,
        raw: candidate
      };
    },
    describeBusinessError(code) {
      const numericCode = Number(code || 0);
      const map = {
        20010: '歌单详情接口未返回可用歌曲列表',
        20017: '当前登录态未拿到歌单列表权限，请先刷新 token 或重新登录后重试'
      };
      return map[numericCode] || `歌单接口业务错误 code=${numericCode || 'unknown'}`;
    },
    toPlaylistError(error, fallbackMessage) {
      if (!error) {
        return new Error(fallbackMessage);
      }
      const suffix = error.code ? ` (code=${error.code})` : '';
      return new Error(`${error.message || fallbackMessage}${suffix}`);
    },
    pickList(payload) {
      const list = this.extractList(payload);
      return this.normalizeItems(list);
    },
    extractList(payload) {
      const data = unwrapPayload(payload);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.data?.info)) return data.data.info;
      if (Array.isArray(data?.data?.data)) return data.data.data;
      if (Array.isArray(data?.data?.files)) return data.data.files;
      if (Array.isArray(data?.data?.songs)) return data.data.songs;
      if (Array.isArray(data?.data?.songlist)) return data.data.songlist;
      if (Array.isArray(data?.data?.lists)) return data.data.lists;
      if (Array.isArray(data?.data?.list)) return data.data.list;
      if (Array.isArray(data?.info)) return data.info;
      if (Array.isArray(data?.files)) return data.files;
      if (Array.isArray(data?.songlist)) return data.songlist;
      if (Array.isArray(data?.list)) return data.list;
      if (Array.isArray(data?.lists)) return data.lists;
      if (Array.isArray(data?.songs)) return data.songs;
      return [];
    },
    normalizeItems(items) {
      return (Array.isArray(items) ? items : []).filter((item) => this.isRenderableItem(item));
    },
    isRenderableItem(item) {
      if (!item || typeof item !== 'object') return false;

      const title = item.songname || item.filename || item.name || item.album_name || item.specialname || '';
      const hash = item.hash || item.audio_id || item.album_audio_id || '';
      const playlistId = item.global_collection_id || item.listid || item.id || '';
      const shieldOnly = Number(item.shield || 0) === 1 && !title && !hash && !playlistId;
      const placeholderOnly = !title && !hash && !playlistId;

      if (shieldOnly) return false;
      if (placeholderOnly) return false;
      return true;
    }
  };
}
