This repository includes a GitHub Actions workflow that builds and publishes Docker images.

To trigger the CI/CD pipeline, push to the `main` branch (or merge a PR into `main`).

Example:

```bash
git checkout -b ci/test-deploy
git add .github/workflows/publish-and-deploy.yml
git commit -m "ci: add publish-and-deploy workflow"
git push -u origin ci/test-deploy
# Open a PR or merge to main to trigger the workflow
```

Make sure the following repository secrets are set before merging to `main`:

- `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH` (for SSH deploy)
- `GHCR_PAT` (if images are private)
