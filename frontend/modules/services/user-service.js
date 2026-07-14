export function createUserService(apiClient) {
  return {
    async sendCode(mobile) {
      return apiClient.get('/captcha/sent', { mobile, timestamp: Date.now() }, { injectCookie: false, retryOnAuth: false });
    },
    async getProfile() {
      const payload = await apiClient.get('/login/token', { timestamp: Date.now() }, { requireAuth: true });
      return payload?.data || payload || {};
    },
    async getQrKey() {
      const payload = await apiClient.rawGet('/login/qr/key', { timestamp: Date.now() }, { injectCookie: false, retryOnAuth: false });
      return payload?.data || payload || {};
    },
    async createQrCode(key, qrimg = true) {
      const payload = await apiClient.rawGet('/login/qr/create', { key, qrimg, timestamp: Date.now() }, { injectCookie: false, retryOnAuth: false });
      return payload?.data || payload || {};
    },
    async checkQrStatus(key) {
      const payload = await apiClient.rawGet('/login/qr/check', { key, timestamp: Date.now() }, { injectCookie: false, retryOnAuth: false });
      return payload?.data || payload || {};
    },
    describeQrStatus(status) {
      const normalized = Number(status ?? -1);
      const map = {
        0: '二维码已过期',
        1: '等待扫码',
        2: '已扫码，等待确认',
        3: '处理中',
        4: '登录成功'
      };
      return map[normalized] || `未知状态 ${normalized}`;
    }
  };
}
