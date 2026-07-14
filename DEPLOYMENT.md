# Deployment Guide

This project is deployed around the remote host `47.116.42.11`.
It is not a purely local-first application.

## Server Summary

- Host: `47.116.42.11`
- SSH port: `22`
- Web entry: `http://47.116.42.11/`
- GitHub repository: `https://github.com/dingyuanyuan1100-bot/Soda-Music.git`

## Live Directories

The current live server layout is:

```text
/www/wwwroot/kugou-client
/www/wwwroot/kugou-upstream
```

Meaning:

- `/www/wwwroot/kugou-client`: frontend static files
- `/www/wwwroot/kugou-upstream`: backend API service

Historical directory names still contain `kugou`, but the external-facing project is now treated as Soda Music.

## Runtime Ports

Current live routing observed on the server:

- `80`: public website entry via Nginx
- `3000`: backend upstream Node service
- `3010`: additional Node service used by `/api/`
- `1234`: remote API base referenced by the frontend page

## Nginx Mapping

The public site for `47.116.42.11` is routed by Nginx.

Observed behavior:

- public root `http://47.116.42.11/` serves the frontend site
- `/api/` is proxied to an internal Node service
- `/raw-api/` is proxied to another internal Node service

Before changing deployment behavior, confirm the current Nginx vhost file on the server.

## Typical Update Flow

### 1. Update code locally

Work in the repository:

```text
C:\Users\dingy\Documents\Codex\2026-07-15\github-plugin-github-openai-curated\work\github-sync
```

### 2. Commit and push

If `git` is not in PATH on Windows PowerShell, use:

```powershell
& 'C:\Users\dingy\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe' -C 'C:\Users\dingy\Documents\Codex\2026-07-15\github-plugin-github-openai-curated\work\github-sync' push
```

### 3. Pull or copy changes to the server

Choose one method:

- `git pull` on the server if the live directories are managed as Git worktrees
- upload changed files manually
- archive and extract updated frontend/backend files

### 4. Restart affected services

After backend changes, restart the relevant Node process.
After frontend static file changes, Nginx usually does not need a restart unless config changed.

## Suggested Deployment Split

### Frontend-only change

Use for:

- `frontend/index.html`
- `frontend/app.js`
- `frontend/app.css`
- `frontend/api-docs.html`
- `frontend/soda-platform.*`
- `frontend/modules/*`

Deploy target:

```text
/www/wwwroot/kugou-client
```

### Backend-only change

Use for:

- `backend/app.js`
- `backend/server.js`
- `backend/module/*`
- `backend/util/*`
- `backend/public/*`
- `backend/package.json`

Deploy target:

```text
/www/wwwroot/kugou-upstream
```

After backend deployment, restart the Node service.

## Verification Checklist

After deployment, verify:

- `http://47.116.42.11/` opens normally
- search still works
- playlist search still works
- lyrics still load
- playback still starts
- `http://47.116.42.11:1234` API endpoints are reachable if expected
- any Nginx reverse-proxy routes still return valid responses

## Rollback Strategy

Keep rollback simple:

- keep a copy of the previous frontend directory
- keep a copy of the previous backend directory
- do not overwrite Nginx config unless required
- if a release fails, restore the previous files and restart only the affected service

## Important Notes

- Do not blindly rename backend internal `kugou` strings. Some are tied to working upstream integrations.
- Treat the repository as the code companion for the remote service, not as proof that every workflow runs locally end-to-end.
- Prefer changing public-facing naming first, then deeper internals only after verification.

## Current Known Repository Mapping

Repository directories:

```text
frontend/  -> /www/wwwroot/kugou-client
backend/   -> /www/wwwroot/kugou-upstream
```

That mapping should remain the default unless the live server structure is explicitly changed later.
