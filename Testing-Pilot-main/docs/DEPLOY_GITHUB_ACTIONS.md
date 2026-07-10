# Deploy via GitHub Actions

This repository includes a GitHub Actions workflow at `.github/workflows/publish-and-deploy.yml` that builds Docker images for the frontend and backend, pushes them to GitHub Container Registry (GHCR), and optionally deploys to a remote server via SSH using `docker compose`.

Required secrets (set in your GitHub repo Settings → Secrets → Actions):

- `GITHUB_TOKEN` (provided automatically by GitHub Actions) — used to authenticate to GHCR.
- Optional SSH deploy secrets (only required if you want Actions to SSH to your server):
  - `SSH_HOST` — the server hostname or IP
  - `SSH_USER` — the SSH username
  - `SSH_PRIVATE_KEY` — private key with access to the server
  - `SSH_PORT` — optional (defaults to `22`)
  - `DEPLOY_PATH` — path on the server where `docker compose` files live

How it works:

1. On push to `main` (or `master`) the workflow builds two images using `Dockerfile.api` and `Dockerfile.web` and pushes them to GHCR as `qa-copilot-api:latest` and `qa-copilot-web:latest`.
2. If SSH deploy secrets are present, Actions SSHs to your server, runs `docker compose pull` and `docker compose up -d` in the configured `DEPLOY_PATH`.

To prepare your server for SSH deployment:

1. Ensure Docker & `docker compose` are installed on the server.
2. Create a `docker-compose.yml` (or use `docker-compose.prod.yml` from the repo) at `DEPLOY_PATH` that references the GHCR images. Example `docker-compose.prod.yml` exists at the repo root.
3. Add the deploy user's public key to `~/.ssh/authorized_keys` on the server.

Notes:

- The workflow pushes images to GHCR under your account/org (`ghcr.io/<owner>/...`). The `GITHUB_TOKEN` has permissions for the repository; for organization-level packages you may need to enable permissions or configure a PAT.
- If you prefer to deploy to a managed platform (Render, Railway, Vercel), let me know and I can add workflow steps for those providers instead.
