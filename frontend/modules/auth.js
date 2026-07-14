import { storage } from './storage.js';
import { logger } from './logger.js';

const COOKIE_KEYS = [
  'token',
  'userid',
  'dfid',
  'mid',
  'tokenid',
  'token_id',
  'kg_mid',
  'musicid',
  'openid',
  'unionid',
  'uuid'
];

function summarizeSession(state = {}) {
  return COOKIE_KEYS.filter((key) => String(state[key] || '').trim()).join(', ') || 'none';
}

function unwrapPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return payload.data?.data || payload.data || payload;
}

function pickString(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
}

export function createAuth(apiClient, onAuthChange) {
  return {
    refreshLock: null,
    get state() {
      return storage.getAuth();
    },
    save(partial) {
      storage.setAuth(partial);
      onAuthChange(storage.getAuth());
    },
    clear() {
      storage.clearAuth();
      onAuthChange(storage.getAuth());
    },
    isLoggedIn() {
      const s = this.state;
      return Boolean(s.token && s.userid);
    },
    buildCookie() {
      const state = this.state;
      return COOKIE_KEYS
        .map((key) => {
          const value = String(state[key] || '').trim();
          return value ? `${key}=${value}` : '';
        })
        .filter(Boolean)
        .join(';');
    },
    normalizeLoginPayload(payload) {
      const direct = unwrapPayload(payload);
      const current = this.state;
      return {
        token: pickString(direct, ['token', 'user_token', 'login_token'], current.token || ''),
        userid: pickString(direct, ['userid', 'user_id', 'uid'], current.userid || ''),
        dfid: pickString(direct, ['dfid', 'device_id', 'dfid_str'], current.dfid || ''),
        mid: pickString(direct, ['mid'], current.mid || ''),
        tokenid: pickString(direct, ['tokenid'], current.tokenid || ''),
        token_id: pickString(direct, ['token_id'], current.token_id || ''),
        kg_mid: pickString(direct, ['kg_mid'], current.kg_mid || ''),
        musicid: pickString(direct, ['musicid', 'music_id'], current.musicid || ''),
        openid: pickString(direct, ['openid', 'open_id'], current.openid || ''),
        unionid: pickString(direct, ['unionid', 'union_id'], current.unionid || ''),
        uuid: pickString(direct, ['uuid'], current.uuid || ''),
        nickname: pickString(direct, ['nickname', 'nick_name'], current.nickname || ''),
        username: pickString(direct, ['username', 'user_name'], current.username || ''),
        avatar: pickString(direct, ['pic', 'avatar', 'headimgurl'], current.avatar || '')
      };
    },
    async ensureDfid() {
      const current = this.state;
      if (current.dfid) return current.dfid;
      const res = await apiClient.rawGet('/register/dev', { timestamp: Date.now() });
      const data = unwrapPayload(res);
      const dfid = pickString(data, ['dfid', 'device_id', 'dfid_str']);
      if (!dfid) throw new Error('未能从 /register/dev 响应中解析出 dfid');
      this.save({ dfid });
      logger.info('已获取 dfid');
      return dfid;
    },
    async refreshToken(force = false) {
      if (this.refreshLock && !force) return this.refreshLock;
      this.refreshLock = (async () => {
        const s = this.state;
        if (!s.token || !s.userid) {
          throw new Error('当前没有可刷新的 token / userid');
        }
        logger.info('开始刷新 token');
        const res = await apiClient.rawGet('/login/token', { token: s.token, userid: s.userid, timestamp: Date.now() });
        const payload = this.normalizeLoginPayload(res);
        const next = {
          ...payload,
          token: payload.token || s.token,
          userid: payload.userid || s.userid,
          dfid: payload.dfid || s.dfid,
          lastRefreshAt: new Date().toISOString()
        };
        this.save(next);
        logger.info('token 刷新成功');
        return next;
      })();
      try {
        return await this.refreshLock;
      } finally {
        this.refreshLock = null;
      }
    },
    async loginByCode(mobile, code) {
      await this.ensureDfid().catch(() => null);
      const res = await apiClient.rawGet('/login/cellphone', { mobile, code, timestamp: Date.now() });
      const payload = this.normalizeLoginPayload(res);
      if (!payload.token || !payload.userid) {
        throw new Error('登录成功响应中未找到 token 或 userid，请检查接口返回');
      }
      this.save({
        ...payload,
        token: payload.token,
        userid: payload.userid,
        dfid: payload.dfid || this.state.dfid || '',
        lastRefreshAt: new Date().toISOString()
      });
      logger.info('短信登录成功');
    },
    applyLoginPayload(payload) {
      const normalized = this.normalizeLoginPayload(payload);
      if (!normalized.token || !normalized.userid) {
        throw new Error('登录态数据不完整，缺少 token 或 userid');
      }
      this.save({
        ...normalized,
        token: normalized.token,
        userid: normalized.userid,
        dfid: normalized.dfid || this.state.dfid || '',
        lastRefreshAt: new Date().toISOString()
      });
      logger.info('登录态已写入本地');
    },
    async syncProfile(userService) {
      if (!this.isLoggedIn()) return this.state;
      const profile = await userService.getProfile();
      const next = {
        nickname: pickString(profile, ['nickname', 'nick_name'], this.state.nickname || ''),
        username: pickString(profile, ['username', 'user_name'], this.state.username || ''),
        avatar: pickString(profile, ['pic', 'avatar', 'headimgurl'], this.state.avatar || '')
      };
      this.save(next);
      return { ...this.state, ...next };
    },
    importManual(input) {
      const parsed = JSON.parse(input);
      if (!parsed.token || !parsed.userid) {
        throw new Error('导入失败，至少需要 token 和 userid');
      }
      this.save({
        ...this.state,
        ...parsed,
        token: String(parsed.token),
        userid: String(parsed.userid),
        dfid: String(parsed.dfid || this.state.dfid || ''),
        mid: String(parsed.mid || this.state.mid || ''),
        tokenid: String(parsed.tokenid || this.state.tokenid || ''),
        token_id: String(parsed.token_id || this.state.token_id || ''),
        kg_mid: String(parsed.kg_mid || this.state.kg_mid || ''),
        musicid: String(parsed.musicid || this.state.musicid || ''),
        openid: String(parsed.openid || this.state.openid || ''),
        unionid: String(parsed.unionid || this.state.unionid || ''),
        uuid: String(parsed.uuid || this.state.uuid || ''),
        nickname: String(parsed.nickname || this.state.nickname || ''),
        username: String(parsed.username || this.state.username || ''),
        avatar: String(parsed.avatar || this.state.avatar || ''),
        lastRefreshAt: parsed.lastRefreshAt || ''
      });
      logger.info('已导入本地凭证');
    },
    getSessionFieldSummary() {
      return summarizeSession(this.state);
    }
  };
}
