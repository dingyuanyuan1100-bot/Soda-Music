export const logger = {
  entries: [],
  render: null,
  setRenderer(renderer) {
    this.render = renderer;
  },
  push(level, message) {
    this.entries.unshift({ level, message, time: new Date().toLocaleTimeString() });
    this.entries = this.entries.slice(0, 100);
    if (this.render) this.render(this.entries);
  },
  info(message) { this.push('ok', message); },
  warn(message) { this.push('warn', message); },
  error(message) { this.push('error', message); },
  clear() {
    this.entries = [];
    if (this.render) this.render(this.entries);
  }
};
