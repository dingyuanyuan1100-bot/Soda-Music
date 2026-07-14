import { storage } from './storage.js';
import { logger } from './logger.js';

export function createApiClient(authRef) {
  return {
    isAuthError(payload) {
      const text = JSON.stringify(payload || {});
      return /未登录|登录失效|token|鉴权|认证|需要验证|error_code":152|error_code:152/i.test(text);
    },
    getBaseUrl() {
      const { baseUrl } = storage.getSettings();
      if (!baseUrl) throw new Error('请先配置 API Base URL');
      return baseUrl.replace(/\/$/, '');
    },
    getGatewayBaseUrl() {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/api`;
      }
      return '/api';
    },
    withPlatform(params = {}, options = {}) {
      if (options.skipPlatform) return { ...params };
      const { platform } = storage.getSettings();
      return platform ? { ...params, platform } : { ...params };
    },
    toQuery(params = {}) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
      return search.toString();
    },
    formatErrorDetail(payload, text = '') {
      if (payload === null || payload === undefined) return text;
      if (typeof payload === 'string') return payload || text;
      if (typeof payload !== 'object') return String(payload);

      const candidate = payload.data ?? payload.msg ?? payload.message ?? payload.errmsg ?? payload.error_msg ?? payload;
      if (candidate === null || candidate === undefined) return text;
      if (typeof candidate === 'string') return candidate;

      try {
        return JSON.stringify(candidate);
      } catch {
        return String(candidate);
      }
    },
    async requestJson(finalUrl, logLabel) {
      logger.info(logLabel);
      const res = await fetch(finalUrl, { method: 'GET', credentials: 'include' });
      const text = await res.text();
      let payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = text;
      }
      if (!res.ok) {
        const detail = this.formatErrorDetail(payload, text);
        throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
      }
      return payload;
    },
    async rawGet(path, params = {}, options = {}) {
      const url = `${this.getBaseUrl()}${path}`;
      const query = this.toQuery(this.withPlatform(params, options));
      const finalUrl = query ? `${url}?${query}` : url;
      return await this.requestJson(finalUrl, `GET ${path}`);
    },
    async gatewayGet(path, params = {}) {
      const url = `${this.getGatewayBaseUrl()}${path}`;
      const query = this.toQuery(params);
      const finalUrl = query ? `${url}?${query}` : url;
      return await this.requestJson(finalUrl, `GET gateway ${path}`);
    },
    unwrapGateway(payload) {
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }
      return payload;
    },
    async get(path, params = {}, options = {}) {
      const auth = authRef();
      const requireAuth = options.requireAuth ?? false;
      const injectCookie = options.injectCookie ?? true;
      if (requireAuth && !auth.isLoggedIn()) {
        throw new Error('当前未登录，请先登录');
      }

      const finalParams = { ...params };
      const cookie = auth.buildCookie();
      if (injectCookie && cookie) finalParams.cookie = cookie;

      try {
        const payload = await this.rawGet(path, finalParams, options);
        if (this.isAuthError(payload) && options.retryOnAuth !== false) {
          logger.warn(`${path} 疑似登录态失效，准备刷新 token 后重试`);
          await auth.refreshToken();
          const retryCookie = auth.buildCookie();
          const retryParams = { ...params };
          if (injectCookie && retryCookie) retryParams.cookie = retryCookie;
          return await this.rawGet(path, retryParams, options);
        }
        return payload;
      } catch (error) {
        if (requireAuth && options.retryOnAuth !== false) {
          logger.warn(`${path} 请求失败，尝试刷新 token 后重试`);
          await auth.refreshToken();
          const retryCookie = auth.buildCookie();
          const retryParams = { ...params };
          if (injectCookie && retryCookie) retryParams.cookie = retryCookie;
          return await this.rawGet(path, retryParams, options);
        }
        throw error;
      }
    }
  };
}
