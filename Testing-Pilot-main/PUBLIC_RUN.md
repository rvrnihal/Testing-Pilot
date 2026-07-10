# Run Publicly

This app is already split in the right way for a public deployment:

- frontend: Next.js
- backend: Express API
- database: PostgreSQL

## Fastest production setup

Use:

- Vercel for the frontend
- Render or Koyeb for the API
- Supabase Postgres for the database

Detailed provider-specific steps already exist here:

- `DEPLOY_DEMO.md`
- `AZURE_DEPLOYMENT.md`

## Required production environment values

Frontend:

```env
NEXT_PUBLIC_APP_URL=https://<your-frontend-domain>
NEXT_PUBLIC_API_URL=https://<your-api-domain>/api
```

Backend:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<long-random-secret>
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=https://<your-frontend-domain>
NEXT_PUBLIC_API_URL=https://<your-api-domain>/api
API_HOST=0.0.0.0
API_PORT=4000
CORS_ORIGIN=https://<your-frontend-domain>
```

`CORS_ORIGIN` can now also accept a comma-separated list, for example:

```env
CORS_ORIGIN=https://your-app.vercel.app,https://www.yourdomain.com,http://localhost:3000
```

## Temporary public sharing from your own machine

If you only want a quick public demo from your laptop:

1. Run the app locally.
2. Expose port `3000` and port `4000` with a tunnel service such as Cloudflare Tunnel or ngrok.
3. Update:

```env
NEXT_PUBLIC_APP_URL=https://<public-web-url>
NEXT_PUBLIC_API_URL=https://<public-api-url>/api
CORS_ORIGIN=https://<public-web-url>
```

Then restart the app so the new URLs are picked up.

## Important security note

Before making the app public, rotate any API keys that were ever stored in `.env` or committed to the repo, and replace the default JWT secret with a strong random value.
