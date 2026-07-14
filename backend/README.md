# Soda Music Third-Party Interface Backend

This directory contains the backend service imported from the live server.

## Current state

- Source was exported from the live environment
- Some internal historical `kugou` naming still remains
- Many of those names are tied to real upstream request behavior

## Suggested usage

```bash
npm install
npm run dev
```

Keep the runtime behavior stable first, then rename deeper internal modules only if needed.
