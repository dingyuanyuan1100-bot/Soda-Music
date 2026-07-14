# Soda Music Third-Party Interface

A server-exported repository for the Soda Music third-party interface currently running on `47.116.42.11`.

This project contains a browser-facing workspace frontend and a backend API service layer used for search, playback, login flows, and related tooling.

## Overview

The repository is organized into two main parts:

- `frontend/`: the Soda Music workspace UI and static assets
- `backend/`: the API service and upstream integration layer

## Current Status

This codebase was imported from a live server rather than developed from a clean local monorepo.
Because of that, some internal historical naming still references `kugou`.

That naming is not fully cosmetic:

- some backend module names reflect real upstream behavior
- some request headers and domains are runtime-sensitive
- blindly renaming everything would risk breaking working API flows

The current cleanup standardizes public-facing names first while keeping runtime behavior stable.

## Repository Structure

```text
frontend/
  index.html
  app.js
  app.css
  api-docs.html
  docs/
  modules/
  soda-platform.html
  soda-platform.js
  soda-platform.css
  launch-soda-client.ps1

backend/
  app.js
  server.js
  package.json
  module/
  public/
  util/
```

## Features

Frontend-facing capabilities currently present in the imported project include:

- song search
- playlist search
- album and artist lookup
- MV lookup and playback
- lyrics display
- playback URL inspection
- QR login and SMS login flows
- local auth/session storage
- debug and log views

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

Default runtime behavior remains aligned with the imported server project.

### Frontend

You can open the static frontend directly for inspection, or use the helper launcher:

```text
frontend/launch-soda-client.ps1
frontend/启动汽水客户端.cmd
```

The current launcher starts:

- backend health target: `http://127.0.0.1:3000/server/now`
- frontend static page: `http://127.0.0.1:3001/index.html`

## API Routing Notes

The current frontend uses two route groups:

- `/api`: stable search, album, artist, MV, and playback-oriented routes
- `/raw-api`: login, captcha, QR login, lyrics, cover, and lower-level upstream routes

See [frontend/docs/api.md](frontend/docs/api.md) for a compact reference.

## Naming Policy For Future Cleanup

Safe cleanup order:

1. public docs and README files
2. launcher scripts and static entrypoints
3. page-level labels and visible UI copy
4. internal backend module refactors only after verification

Unsafe cleanup pattern:

- bulk-replacing all `kugou` strings across backend request code

## Known Constraints

- This repository was reconstructed from a live deployment.
- Some files previously showed encoding issues during extraction and cleanup.
- Public-facing documentation has been normalized first.
- Internal backend naming is intentionally only partially cleaned.

## Recommended Next Steps

- unify `index.html` and related UI copy with the new Soda naming
- remove or archive legacy `kugou-platform.*` assets if no longer needed
- add a simple top-level runbook for deployment and rollback
- verify frontend entrypoints before doing deeper backend refactors

## Source Context

Imported from the live environment hosted at:

- `http://47.116.42.11/`

Current GitHub repository:

- [dingyuanyuan1100-bot/Soda-Music](https://github.com/dingyuanyuan1100-bot/Soda-Music)
