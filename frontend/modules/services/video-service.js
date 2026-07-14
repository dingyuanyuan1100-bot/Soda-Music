export function createVideoService(apiClient) {
  return {
    async getVideoUrl(hash) {
      const payload = await apiClient.gatewayGet(`/mvs/${encodeURIComponent(hash)}/play-url`);
      return apiClient.unwrapGateway(payload);
    },
    extractPlayableUrl(payload, hash = '') {
      const key = String(hash || '').trim().toLowerCase();
      const bucket = key ? payload?.data?.[key] || payload?.data?.[hash] : payload?.data || payload;
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
          visit(value.downurl);
          visit(value.backupdownurl);
          visit(value.url);
          visit(value.play_url);
          visit(value.data);
          visit(value.raw);
        }
      };
      visit(bucket || payload);
      return candidates[0] || '';
    }
  };
}
