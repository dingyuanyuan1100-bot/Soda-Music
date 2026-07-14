export function createAlbumService(apiClient) {
  return {
    async getAlbumSongs(id) {
      const payload = await apiClient.gatewayGet(`/albums/${encodeURIComponent(id)}/tracks`, {
        pageSize: 200
      });
      return this.pickSongs(apiClient.unwrapGateway(payload));
    },
    pickSongs(payload) {
      const list = this.extractList(payload);
      return list
        .map((item) => this.normalizeSongItem(item))
        .filter(Boolean);
    },
    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data?.songs)) return payload.data.songs;
      if (Array.isArray(payload?.data?.info)) return payload.data.info;
      if (Array.isArray(payload?.data?.list)) return payload.data.list;
      if (Array.isArray(payload?.songs)) return payload.songs;
      if (Array.isArray(payload?.info)) return payload.info;
      if (Array.isArray(payload?.list)) return payload.list;
      return [];
    },
    normalizeSongItem(item) {
      if (!item || typeof item !== 'object') return null;

      const hash = item.hash || '';
      const title = item.songname || item.title || item.filename || item.name || '';
      const artist = item.author_name || item.artist || item.singername || '';
      const albumId = item.album_id || item.albumId || item.albumid || 0;
      const albumAudioId = item.album_audio_id || item.albumAudioId || item.audio_id || 0;
      const duration = item.duration || item.timelen || 0;
      const cover = item.img || item.cover || item.image || '';

      if (!hash || !title) return null;

      return {
        hash,
        songname: title,
        filename: `${artist || '未知歌手'} - ${title}`,
        author_name: artist || '未知歌手',
        album_id: albumId,
        album_audio_id: albumAudioId,
        duration,
        img: cover,
        album_name: item.album_name || item.albumName || '',
        __kind: 'song',
        __playable: true,
        __title: title,
        __subtitle: artist || '未知歌手',
        __meta: `hash: ${hash}`
      };
    }
  };
}
