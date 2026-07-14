# Soda Music Third-Party Interface

This repository was imported from the live server at `47.116.42.11`.
It currently contains two parts:

- `frontend/`: Soda Music workspace frontend
- `backend/`: API service and upstream wrapper

## Structure

```text
frontend/
backend/
```

## Notes

- Some historical `kugou` names still exist in the codebase.
- This cleanup only standardizes repository-facing names.
- Upstream domains, headers, and backend module names are part of runtime behavior and should not be batch-renamed blindly.

## Run

- Frontend entry: `frontend/index.html`
- Backend service: `backend/`

A safe next step is:

1. Rename docs, scripts, and page entrypoints
2. Evaluate backend internal refactors later
