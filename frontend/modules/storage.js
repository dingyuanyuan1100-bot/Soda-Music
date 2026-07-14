const AUTH_KEY = 'kugou.local.auth.v1';
const SETTINGS_KEY = 'kugou.local.settings.v1';
const FIXED_BASE_URL = '/raw-api';

function getDefaultBaseUrl() {
  return FIXED_BASE_URL;
}

const defaultSettings = {
  baseUrl: getDefaultBaseUrl(),
  platform: 'life',
  autoRefreshEnabled: true,
  refreshMinutes: 30,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) return getDefaultBaseUrl();
  return value.replace(/\/$/, '');
}

function normalizePlatform(platform) {
  const value = String(platform || '').trim();
  return value || 'life';
}

export const storage = {
  getSettings() {
    const settings = { ...defaultSettings, ...read(SETTINGS_KEY, {}) };
    settings.baseUrl = normalizeBaseUrl(settings.baseUrl);
    settings.platform = normalizePlatform(settings.platform);
    return settings;
  },
  setSettings(settings) {
    write(SETTINGS_KEY, {
      ...settings,
      baseUrl: normalizeBaseUrl(settings.baseUrl),
      platform: normalizePlatform(settings.platform)
    });
  },
  getAuth() {
    return read(AUTH_KEY, {
      token: '',
      userid: '',
      dfid: '',
      mid: '',
      tokenid: '',
      token_id: '',
      kg_mid: '',
      musicid: '',
      openid: '',
      unionid: '',
      uuid: '',
      nickname: '',
      username: '',
      avatar: '',
      lastRefreshAt: ''
    });
  },
  setAuth(auth) {
    write(AUTH_KEY, { ...this.getAuth(), ...auth });
  },
  clearAuth() {
    localStorage.removeItem(AUTH_KEY);
  }
};
