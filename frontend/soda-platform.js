import { storage } from '/modules/storage.js';
import { logger } from '/modules/logger.js';
import { createUi } from '/modules/ui/ui.js';
import { createApiClient } from '/modules/api-client.js';
import { createAuth } from '/modules/auth.js';
import { createSessionRefresh } from '/modules/session-refresh.js';
import { createQrLoginController } from '/modules/qr-login-controller.js';
import { createPlaylistService } from '/modules/services/playlist-service.js';
import { createSearchService } from '/modules/services/search-service.js';
import { createSongService } from '/modules/services/song-service.js';
import { createUserService } from '/modules/services/user-service.js';
import { createAlbumService } from '/modules/services/album-service.js';
import { createArtistService } from '/modules/services/artist-service.js';
import { createVideoService } from '/modules/services/video-service.js';
import { createPlayerController } from '/modules/player/player-controller.js';

const ui = createUi();
logger.setRenderer(entries => ui.renderLogs(entries));

let auth;
let activeDrawerId = '';
const apiClient = createApiClient(() => auth);

auth = createAuth(apiClient, state => {
  ui.renderAuth(state);
});

const scheduler = createSessionRefresh(auth);
const userService = createUserService(apiClient);
const playlistService = createPlaylistService(apiClient, auth);
const searchService = createSearchService(apiClient, playlistService);
const songService = createSongService(apiClient, auth);
const albumService = createAlbumService(apiClient);
const artistService = createArtistService(apiClient);
const videoService = createVideoService(apiClient);
const player = createPlayerController(ui, songService);
const qrLogin = createQrLoginController({ userService, auth, ui, scheduler });

function byId(id) {
  return document.getElementById(id);
}

function openDrawer(id) {
  const next = byId(id);
  const backdrop = byId('drawer-backdrop');
  if (!next || !backdrop) return;

  closeDrawers();
  next.classList.remove('hidden');
  next.setAttribute('aria-hidden', 'false');
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  activeDrawerId = id;
}

function closeDrawers() {
  const backdrop = byId('drawer-backdrop');
  document.querySelectorAll('.kp-drawer').forEach(node => {
    node.classList.add('hidden');
    node.setAttribute('aria-hidden', 'true');
  });
  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
  activeDrawerId = '';
}

async function copyPlayerUrl() {
  const text = (byId('player-url')?.textContent || '').trim();
  if (!text) throw new Error('No playback URL available to copy');
  await navigator.clipboard.writeText(text);
  logger.info('Playback URL copied');
}

function saveSettings() {
  storage.setSettings({
    ...storage.getSettings(),
    baseUrl: ui.els.baseUrl.value.trim(),
    platform: ui.els.platform.value.trim(),
    refreshMinutes: Number(ui.els.refreshMinutes.value) || 30,
    autoRefreshEnabled: String(ui.els.autoRefresh.value) !== 'false',
  });
  ui.renderSettings(storage.getSettings());
  scheduler.start();
  logger.info('Settings saved');
}

async function sendCode() {
  const mobile = ui.els.mobile.value.trim();
  if (!mobile) throw new Error('Please enter a mobile number');
  await userService.sendCode(mobile);
  logger.info(`Verification code sent to ${mobile}`);
}

async function loginByCode() {
  const mobile = ui.els.mobile.value.trim();
  const code = ui.els.smsCode.value.trim();
  if (!mobile || !code) throw new Error('Please enter mobile number and code');
  await auth.loginByCode(mobile, code);
  ui.renderAuth(auth.state);
  scheduler.start();
  logger.info('SMS login succeeded');
}

async function refreshToken() {
  await auth.refreshToken(true);
  ui.renderAuth(auth.state);
  logger.info('Token refreshed');
}

async function loadMyPlaylists() {
  const items = await playlistService.getMyPlaylists();
  ui.renderPlaylists(items);
  openDrawer('playlists-drawer');
  logger.info(`Loaded ${items.length} playlists`);
}

async function syncProfile() {
  await auth.syncProfile(userService);
  ui.renderAuth(auth.state);
  logger.info('Profile synced');
}

function logout() {
  auth.clear();
  ui.renderAuth(auth.state);
  scheduler.stop();
  qrLogin.stop(true);
  logger.info('Logged out');
}

function importAuth() {
  const text = ui.els.manualAuth.value.trim();
  if (!text) throw new Error('Please enter JSON');
  auth.importManual(text);
  ui.renderAuth(auth.state);
  scheduler.start();
  logger.info('Manual auth imported');
}

async function searchSubmit() {
  const keywords = ui.els.searchKeywords.value.trim();
  const type = ui.els.searchType.value;
  if (!keywords) throw new Error('Please enter search keywords');
  const items = await searchService.searchSongs(keywords, type);
  ui.renderSearchResults(items);
  logger.info(`Search complete: ${type} / ${items.length} items`);
}

async function loadPlaylistTracks(id) {
  if (!id) throw new Error('Missing playlist ID');
  const items = await playlistService.getPlaylistTracks(id);
  ui.renderSearchResults(items);
  closeDrawers();
  logger.info(`Loaded ${items.length} playlist tracks`);
}

async function loadAlbumTracks(id) {
  if (!id) throw new Error('Missing album ID');
  const items = await albumService.getAlbumSongs(id);
  ui.renderSearchResults(items);
  logger.info(`Loaded ${items.length} album tracks`);
}

async function loadArtistTracks(id) {
  if (!id) throw new Error('Missing artist ID');
  const items = await artistService.getArtistSongs(id);
  ui.renderSearchResults(items);
  logger.info(`Loaded ${items.length} artist tracks`);
}

async function showSongUrl(button) {
  const hash = button.dataset.hash || '';
  const albumId = Number(button.dataset.albumId || 0);
  const albumAudioId = Number(button.dataset.albumAudioId || 0);
  const payload = await songService.getSongUrl(hash, albumId, albumAudioId);
  const url = songService.extractPlayableUrl(payload);
  if (!url) throw new Error(songService.explainMissingPlayableSource(payload) || 'No playback URL returned');
  logger.info(`Song URL: ${url}`);
}

async function playSong(button) {
  await player.playSong({
    hash: button.dataset.hash || '',
    albumId: Number(button.dataset.albumId || 0),
    albumAudioId: Number(button.dataset.albumAudioId || 0),
    title: button.dataset.title || '',
    artist: button.dataset.artist || '',
    duration: Number(button.dataset.duration || 0),
    cover: button.dataset.cover || '',
  });
}

async function showMvUrl(id) {
  const payload = await videoService.getVideoUrl(id);
  const url = videoService.extractPlayableUrl(payload, id);
  if (!url) throw new Error('No MV URL returned');
  logger.info(`MV URL: ${url}`);
}

async function playMv(button) {
  const id = button.dataset.id || '';
  const payload = await videoService.getVideoUrl(id);
  const url = videoService.extractPlayableUrl(payload, id);
  if (!url) throw new Error('No MV URL returned');
  ui.renderVideoPlayer({
    title: button.dataset.title || 'Untitled MV',
    sub: button.dataset.artist || 'Unknown artist',
    url,
    cover: button.dataset.cover || '',
  });
  try {
    await ui.els.videoPlayer.play();
  } catch {
  }
  logger.info('MV playback started');
}

function bind(id, handler) {
  byId(id)?.addEventListener('click', async () => {
    try {
      await handler();
    } catch (error) {
      logger.error(error?.message || String(error));
    }
  });
}

function delegateAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action || '';
  const id = button.dataset.id || '';
  Promise.resolve()
    .then(async () => {
      switch (action) {
        case 'song-url':
          return showSongUrl(button);
        case 'play-song':
          return playSong(button);
        case 'playlist-tracks':
          return loadPlaylistTracks(id);
        case 'album-tracks':
          return loadAlbumTracks(id);
        case 'author-tracks':
          return loadArtistTracks(id);
        case 'mv-url':
          return showMvUrl(id);
        case 'play-mv':
          return playMv(button);
        default:
          logger.warn(`Unhandled action: ${action}`);
      }
    })
    .catch(error => logger.error(error?.message || String(error)));
}

function bindDrawerTriggers() {
  bind('open-playlists-drawer', async () => openDrawer('playlists-drawer'));
  bind('open-auth-drawer', async () => openDrawer('auth-drawer'));
  bind('open-logs-drawer', async () => openDrawer('logs-drawer'));
  bind('copy-player-url', copyPlayerUrl);

  byId('drawer-backdrop')?.addEventListener('click', closeDrawers);
  document.querySelectorAll('[data-close-drawer]').forEach(node => {
    node.addEventListener('click', closeDrawers);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeDrawerId) closeDrawers();
  });
}

function bootstrap() {
  ui.renderSettings(storage.getSettings());
  ui.renderAuth(auth.state);
  ui.renderQrLogin({ image: ui.defaultCover(), statusText: 'QR code not generated' });
  ui.renderPlayer({
    title: 'No song selected',
    sub: 'Choose a search result or playlist item to play.',
    url: '',
    cover: ui.defaultCover(),
  });
  ui.renderVideoPlayer({
    title: 'No MV selected',
    sub: 'Choose an MV result to play.',
    url: '',
    cover: ui.defaultCover(),
  });
  ui.renderLyrics([], -1);
  player.init();
  closeDrawers();
  if (auth.isLoggedIn()) scheduler.start();

  bind('save-settings', saveSettings);
  bind('send-code', sendCode);
  bind('login-by-code', loginByCode);
  bind('refresh-token', refreshToken);
  bind('load-my-playlists', loadMyPlaylists);
  bind('sync-profile', syncProfile);
  bind('logout', async () => logout());
  bind('import-auth', async () => importAuth());
  bind('generate-qr', async () => qrLogin.start());
  bind('search-submit', searchSubmit);
  bind('clear-logs', async () => logger.clear());
  bindDrawerTriggers();

  ui.els.searchKeywords?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchSubmit().catch(error => logger.error(error?.message || String(error)));
    }
  });

  document.addEventListener('click', delegateAction);
  logger.info('Soda Music third-party platform loaded');
}

bootstrap();
