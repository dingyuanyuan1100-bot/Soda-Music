# Soda Music Third-Party Interface

A repository for the Soda Music third-party interface that connects to the remote service at `http://47.116.42.11/`.

This is not primarily a local standalone app.
It is a code repository organized around a live remote deployment, including the browser-facing frontend assets and the API-facing backend service layer.

## Overview

The repository is organized into two main parts:

- `frontend/`: the Soda Music workspace UI and static assets
- `backend/`: the API service and upstream integration layer

In practice, this repository should be understood as the code companion to the remote site, not as a purely local-first project.

## Current Status

This codebase was imported from a live server rather than developed from a clean local monorepo.
Its main target remains the remote environment at `http://47.116.42.11/`.
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
  start-soda-client.cmd

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
- browser-side auth and session storage for the remote service
- debug and log views

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

Default runtime behavior remains aligned with the imported server project, but the real target environment is the remote host.

### Frontend

You can open the static frontend directly for inspection, or use the helper launcher:

```text
frontend/launch-soda-client.ps1
frontend/start-soda-client.cmd
```

The current launcher starts:

- backend health target: `http://127.0.0.1:3000/server/now`
- frontend static page: `http://127.0.0.1:3001/index.html`

## API Routing Notes

The current frontend uses two route groups:

- `/api`: stable search, album, artist, MV, and playback-oriented routes
- `/raw-api`: login, captcha, QR login, lyrics, cover, and lower-level upstream routes

These routes are intended to work against the deployed remote service at `http://47.116.42.11/`.

See [frontend/docs/api.md](C:/Users/dingy/Documents/Codex/2026-07-15/github-plugin-github-openai-curated/work/github-sync/frontend/docs/api.md) for a compact reference.

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

- unify any remaining visible UI copy with the Soda naming
- add a simple top-level runbook for deployment and rollback
- verify frontend entrypoints before doing deeper backend refactors

## Remote Context

Primary remote environment:

- `http://47.116.42.11/`

This repository should be treated as the code companion to that remote site.

Current GitHub repository:

- [dingyuanyuan1100-bot/Soda-Music](https://github.com/dingyuanyuan1100-bot/Soda-Music)
