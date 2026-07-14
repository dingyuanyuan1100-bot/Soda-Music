# Soda Music Third-Party Interface

This document describes the frontend-facing API usage.

## Routing

- Stable search, album, artist, MV, and playback routes use `/api`
- Login, captcha, QR login, lyrics, and cover routes use `/raw-api`
- The frontend stores `token / userid / dfid` locally and builds cookie parameters automatically

## Base URL

```text
http://47.116.42.11/api
```

## Common routes

### Song search

```text
/api/search/songs?q=Jay%20Chou&pageSize=20
```

### Playlist search

```text
/raw-api/search?keywords=Jay%20Chou&type=special&pagesize=20&platform=life
```

### Song play URL

```text
/api/songs/:hash/play-url
```

### Refresh login token

```text
/raw-api/login/token?token=xxx&userid=123&platform=life&timestamp=1691256061923
```

### Register device dfid

```text
/raw-api/register/dev?platform=life&timestamp=1691256061923
```
