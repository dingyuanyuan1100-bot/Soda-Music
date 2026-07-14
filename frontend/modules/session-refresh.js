import { storage } from './storage.js';
import { logger } from './logger.js';

export function createSessionRefresh(auth) {
  return {
    timer: null,
    start() {
      this.stop();
      const settings = storage.getSettings();
      if (!settings.autoRefreshEnabled) {
        logger.warn('自动刷新已关闭');
        return;
      }
      const ms = Math.max(5, Number(settings.refreshMinutes) || 30) * 60 * 1000;
      this.timer = setInterval(async () => {
        if (!auth.isLoggedIn()) return;
        try {
          await auth.refreshToken();
        } catch (error) {
          logger.error(`定时刷新失败: ${error.message}`);
        }
      }, ms);
      logger.info(`自动刷新已启动，间隔 ${Math.round(ms / 60000)} 分钟`);
    },
    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  };
}
