import { logger } from '../logger.js';

const SEARCH_PAGE_SIZE = 20;
const SUPPORTED_TYPES = new Set(['song', 'special', 'album', 'author', 'mv', 'lyric']);
const NOISE_WORDS = ['伴奏', 'dj', 'dj版', 'live', '铃声', '串烧', '片段', '网友改编', '手鼓版', '现场'];

export function createSearchService(apiClient, playlistService) {
  return {
    async searchSongs(keywords, type = 'song') {
      const normalizedType = this.normalizeType(type);

      if (normalizedType === 'song') {
        return await this.searchPlayableSongs(keywords, playlistService);
      }

      if (normalizedType === 'album') {
        const payload = await apiClient.gatewayGet('/search/albums', {
          q: keywords,
          pageSize: SEARCH_PAGE_SIZE
        });
        return this.normalizeResults(apiClient.unwrapGateway(payload), normalizedType, playlistService);
      }

      if (normalizedType === 'author') {
        const payload = await apiClient.gatewayGet('/search/artists', {
          q: keywords,
          pageSize: SEARCH_PAGE_SIZE
        });
        return this.normalizeResults(apiClient.unwrapGateway(payload), normalizedType, playlistService);
      }

      if (normalizedType === 'mv') {
        const payload = await apiClient.gatewayGet('/search/mvs', {
          q: keywords,
          pageSize: SEARCH_PAGE_SIZE
        });
        return this.normalizeResults(apiClient.unwrapGateway(payload), normalizedType, playlistService);
      }

      const payload = await apiClient.get('/search', {
        keywords,
        type: normalizedType,
        pagesize: SEARCH_PAGE_SIZE
      });

      return this.normalizeResults(payload, normalizedType, playlistService);
    },
    async searchPlayableSongs(keywords, playlistService) {
      try {
        const payload = await apiClient.gatewayGet('/search/songs', {
          q: keywords,
          pageSize: SEARCH_PAGE_SIZE
        });
        const list = this.normalizeSongResults(apiClient.unwrapGateway(payload), playlistService);
        if (list.length) return list;
        logger.warn('单曲搜索返回为空，自动回退到歌词搜索');
      } catch (error) {
        logger.warn(`单曲搜索失败，自动回退到歌词搜索: ${error.message}`);
      }

      const fallbackPayload = await apiClient.get('/search', {
        keywords,
        type: 'lyric',
        pagesize: SEARCH_PAGE_SIZE
      }, { retryOnAuth: false });

      const fallbackList = this.normalizeLyricSongResults(fallbackPayload, keywords);
      if (!fallbackList.length) {
        logger.warn('歌词搜索兜底后仍未返回可播放结果');
      }
      return fallbackList;
    },
    normalizeType(type) {
      return SUPPORTED_TYPES.has(type) ? type : 'song';
    },
    normalizeResults(payload, type, playlistService) {
      if (type === 'song') {
        return this.normalizeSongResults(payload, playlistService);
      }

      const list = this.extractList(payload);
      return list
        .map((item) => this.normalizeTypedItem(item, type))
        .filter(Boolean);
    },
    normalizeSongResults(payload, playlistService) {
      const list = playlistService.pickList(payload);
      return list.map((item) => this.normalizeSongItem(item));
    },
    normalizeLyricSongResults(payload, keywords) {
      const query = this.normalizeKeyword(keywords);
      const list = this.extractList(payload)
        .map((item) => this.normalizeLyricAsSongItem(item, query))
        .filter(Boolean)
        .filter((item) => item.__score > 0)
        .sort((a, b) => b.__score - a.__score)
        .filter((item, index, array) => index === array.findIndex((other) => other.hash === item.hash));

      return list.map(({ __score, ...item }) => item);
    },
    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.info)) return payload.data.info;
      if (Array.isArray(payload?.data?.lists)) return payload.data.lists;
      if (Array.isArray(payload?.data?.list)) return payload.data.list;
      if (Array.isArray(payload?.data?.albums)) return payload.data.albums;
      if (Array.isArray(payload?.data?.authors)) return payload.data.authors;
      if (Array.isArray(payload?.data?.mvdata)) return payload.data.mvdata;
      if (Array.isArray(payload?.data?.candidates)) return payload.data.candidates;
      if (Array.isArray(payload?.data?.songs)) return payload.data.songs;
      if (Array.isArray(payload?.info)) return payload.info;
      if (Array.isArray(payload?.list)) return payload.list;
      if (Array.isArray(payload?.lists)) return payload.lists;
      if (Array.isArray(payload?.albums)) return payload.albums;
      if (Array.isArray(payload?.authors)) return payload.authors;
      if (Array.isArray(payload?.mvdata)) return payload.mvdata;
      if (Array.isArray(payload?.candidates)) return payload.candidates;
      if (Array.isArray(payload?.songs)) return payload.songs;
      return [];
    },
    normalizeKeyword(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[\s\-_.()（）【】\[\]“”'‘’]+/g, ' ')
        .trim();
    },
    includesNoise(text) {
      const source = this.normalizeKeyword(text);
      return NOISE_WORDS.some((word) => source.includes(this.normalizeKeyword(word)));
    },
    scoreLyricSongItem(item, query) {
      const songName = this.normalizeKeyword(item.SongName || item.songname || '');
      const singerName = this.normalizeKeyword(item.SingerName || item.singername || '');
      const fileName = this.normalizeKeyword(item.FileName || '');
      const lyric = this.normalizeKeyword(item.Lyric || '');
      const hasQuery = Boolean(query);
      let score = 0;

      if (!hasQuery) return 1;
      if (songName === query) score += 200;
      else if (songName.startsWith(query)) score += 120;
      else if (songName.includes(query)) score += 80;
      else if (fileName.includes(query)) score += 50;
      else if (lyric.includes(query)) score += 10;
      else return 0;

      if (item.OwnerCount) {
        score += Math.min(40, Math.log10(Number(item.OwnerCount) + 1) * 8);
      }
      if (item.Privilege === 0 || item.Privilege === 8 || item.Privilege === 10) {
        score += 8;
      }
      if (singerName && query.includes(singerName)) score += 16;
      if (this.includesNoise(item.FileName || item.SongName || '')) score -= 35;
      if (songName && songName !== query && !songName.includes(query)) score -= 20;

      return score;
    },
    normalizeSongItem(item) {
      return {
        ...item,
        hash: item.hash || item.FileHash || item.audio_info?.hash || '',
        album_id: item.album_id || item.AlbumID || item.albumid || item.base?.album_id || '',
        album_audio_id: item.album_audio_id || item.MixSongID || item.audio_id || item.base?.album_audio_id || '',
        author_name: item.author_name || item.SingerName || item.singername || item.artist || item.AuthorName || '',
        songname: item.songname || item.SongName || item.title || item.filename || item.FileName || item.name || '',
        img: item.img || item.Image || item.image || item.cover || item.trans_param?.union_cover || '',
        __kind: 'song',
        __playable: true,
        __title: item.songname || item.SongName || item.title || item.filename || item.FileName || item.name || item.album_name || '未命名歌曲',
        __subtitle: item.author_name || item.SingerName || item.singername || item.artist || item.owner_name || item.remark || item.album_name || '未知歌手',
        __meta: `hash: ${item.hash || item.FileHash || item.audio_id || item.album_audio_id || '无'}`
      };
    },
    normalizeLyricAsSongItem(item, query) {
      if (!item || typeof item !== 'object') return null;

      const hash = item.FileHash || item.hash || '';
      if (!hash) return null;

      const title = item.SongName || item.songname || item.FileName || '';
      const artist = item.SingerName || item.singername || item.AuthorName || '';
      const albumId = item.AlbumID || item.albumid || item.album_id || 0;
      const albumAudioId = item.MixSongID || item.album_audio_id || item.audio_id || 0;
      const duration = item.TimeLength || item.duration || item.timelen || 0;
      const cover = item.Image || item.image || item.img || item.cover || item.trans_param?.union_cover || '';
      const score = this.scoreLyricSongItem(item, query);

      return {
        hash,
        songname: title || '未命名歌曲',
        filename: item.FileName || `${artist || '未知歌手'} - ${title || '未命名歌曲'}`,
        author_name: artist || '未知歌手',
        album_id: albumId,
        album_audio_id: albumAudioId,
        duration,
        img: cover,
        __kind: 'song',
        __playable: true,
        __title: title || '未命名歌曲',
        __subtitle: artist || '未知歌手',
        __meta: `hash: ${hash}`,
        __score: score
      };
    },
    buildAction(action, payload = {}) {
      return { action, payload };
    },
    normalizeTypedItem(item, type) {
      if (!item || typeof item !== 'object') return null;

      const handlers = {
        special: () => ({
          ...item,
          __kind: 'special',
          __playable: false,
          __title: item.specialname || item.name || '未命名歌单',
          __subtitle: item.nickname || item.owner_name || item.intro || '歌单搜索结果',
          __meta: `歌曲数: ${item.songcount || item.song_count || item.count || 0}`,
          __actions: [
            this.buildAction('playlist-tracks', {
              id: item.gid || item.global_collection_id || item.listid || item.id || '',
              label: '查看歌曲'
            })
          ]
        }),
        album: () => ({
          ...item,
          __kind: 'album',
          __playable: false,
          __title: item.albumname || item.album_name || item.title || item.name || '未命名专辑',
          __subtitle: item.singername || item.singer || item.author_name || item.artist || item.artist_name || '专辑搜索结果',
          __meta: `专辑ID: ${item.albumid || item.album_id || item.albumId || '无'} / 歌曲数: ${item.songcount || item.song_count || item.songCount || item.count || 0}`,
          __actions: [
            this.buildAction('album-tracks', {
              id: item.albumid || item.album_id || item.albumId || item.id || '',
              label: '查看歌曲'
            })
          ]
        }),
        author: () => ({
          ...item,
          __kind: 'author',
          __playable: false,
          __title: item.AuthorName || item.authorname || item.singername || item.name || '未命名歌手',
          __subtitle: `专辑 ${item.AlbumCount || item.albumCount || 0} / 单曲 ${item.AudioCount || item.songCount || 0} / MV ${item.VideoCount || item.mvCount || 0}`,
          __meta: `歌手ID: ${item.AuthorId || item.authorid || item.singerid || item.author_id || item.artistId || '无'}`,
          __actions: [
            this.buildAction('author-tracks', {
              id: item.AuthorId || item.authorid || item.singerid || item.author_id || item.artistId || '',
              label: '查看歌曲'
            })
          ]
        }),
        mv: () => ({
          ...item,
          __kind: 'mv',
          __playable: false,
          __title: item.MvName || item.mvname || item.songname || item.filename || item.name || item.title || '未命名 MV',
          __subtitle: item.SingerName || item.singername || item.author_name || item.artist || item.remark || 'MV 搜索结果',
          __meta: `MV hash: ${item.MvHash || item.mvhash || item.mvHash || item.hash || '无'}`,
          __actions: [
            this.buildAction('mv-url', {
              id: item.MvHash || item.mvhash || item.mvHash || item.hash || '',
              label: '取 MV URL'
            }),
            this.buildAction('play-mv', {
              id: item.MvHash || item.mvhash || item.mvHash || item.hash || '',
              label: '播放 MV',
              title: item.MvName || item.mvname || item.songname || item.filename || item.title || '未命名 MV',
              artist: item.SingerName || item.singername || item.author_name || item.artist || '未知歌手',
              cover: item.Pic ? `http://imge.kugou.com/mvhdpic/480/${item.Pic}` : (item.cover || '')
            })
          ]
        }),
        lyric: () => ({
          ...item,
          __kind: 'lyric',
          __playable: false,
          __title: item.SongName || item.song || item.songname || item.filename || '歌词结果',
          __subtitle: item.SingerName || item.singer || item.singername || item.author_name || '歌词搜索结果',
          __meta: `歌词ID: ${item.LyricID || item.id || item.lyricid || '无'}`
        })
      };

      const normalize = handlers[type];
      return normalize ? normalize() : null;
    }
  };
}
