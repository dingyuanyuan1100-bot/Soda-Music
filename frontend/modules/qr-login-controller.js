import { logger } from './logger.js';

function unwrapPayload(payload) {
  return payload?.data || payload || {};
}

export function createQrLoginController({ userService, auth, ui, scheduler }) {
  return {
    timer: null,
    state: {
      key: '',
      image: '',
      url: '',
      status: -1,
      statusText: '未生成二维码'
    },
    render() {
      ui.renderQrLogin(this.state);
    },
    reset() {
      this.state = {
        key: '',
        image: ui.defaultCover(),
        url: '',
        status: -1,
        statusText: '未生成二维码'
      };
      this.render();
    },
    stop(silent = false) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (!silent) logger.info('二维码轮询已停止');
    },
    async start() {
      this.stop(true);

      const keyPayload = unwrapPayload(await userService.getQrKey());
      const key = keyPayload.qrcode || keyPayload.key || '';
      if (!key) throw new Error('二维码 key 获取失败');

      const qrPayload = unwrapPayload(await userService.createQrCode(key, true));
      this.state = {
        key,
        image: qrPayload.qrcode_img || qrPayload.base64 || ui.defaultCover(),
        url: qrPayload.url || qrPayload.qrurl || '',
        status: 1,
        statusText: '等待扫码'
      };
      this.render();
      logger.info('二维码已生成');

      this.timer = setInterval(async () => {
        try {
          await this.poll();
        } catch (error) {
          logger.error(`二维码轮询失败: ${error.message}`);
          this.stop(true);
        }
      }, 3000);
    },
    async poll() {
      if (!this.state.key) return;
      const payload = unwrapPayload(await userService.checkQrStatus(this.state.key));
      const status = Number(payload.status ?? -1);
      this.state.status = status;
      this.state.statusText = userService.describeQrStatus(status);
      this.render();

      if (status === 4) {
        auth.applyLoginPayload(payload);
        scheduler.start();
        logger.info('二维码登录成功');
        this.stop(true);
        return;
      }

      if (status === 0) {
        logger.warn('二维码已过期，请重新生成');
        this.stop(true);
      }
    }
  };
}
