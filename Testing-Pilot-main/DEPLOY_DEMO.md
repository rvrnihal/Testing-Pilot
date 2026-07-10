# Demo Deployment

This app is easiest to demo with:

- Frontend: Vercel
- Backend API: Koyeb
- Database: Supabase Postgres

## 1. Supabase

Create a new Supabase project and copy the pooled or direct Postgres connection string.

Required backend environment values:

```env
DATABASE_URL=
JWT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=Qwen/Qwen2.5-7B-Instruct
STRIPE_SECRET_KEY=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_SCALE=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
API_PORT=4000
CORS_ORIGIN=
```

After the database is provisioned, run:

```bash
npm run db:push
npm run db:seed
```

Use the hosted database URL for both commands.

## 2. Koyeb API

Deploy from the GitHub repository using:

- Builder: `Dockerfile`
- Dockerfile path: `Dockerfile.api`
- Exposed port: `4000`

Recommended service name:

- `qa-copilot-api`

Set the backend env vars listed above.

Important:

- `NEXT_PUBLIC_APP_URL` should be the Vercel frontend URL
- `NEXT_PUBLIC_API_URL` should be `https://<your-koyeb-domain>/api`
- `CORS_ORIGIN` should be the Vercel frontend URL

## 3. Vercel frontend

Import the GitHub repository into Vercel.

Project settings:

- Framework preset: `Next.js`
- Root directory: `.`
- Install command: `npm install`
- Build command: `npm run build:web`

Frontend environment values:

```env
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>
NEXT_PUBLIC_API_URL=https://<your-koyeb-domain>/api
```

The `vercel.json` file in the repo already sets the build and install commands.

## 4. Final checks

After both services are live:

1. Open the frontend URL.
2. Register or log in with the seeded admin account.
3. Confirm `https://<your-koyeb-domain>/api/health` returns `{"status":"ok"}`.
4. Confirm login, dashboard, and AI actions work.

## Notes

- For demos, use production deploys instead of `next dev`.
- Rotate any exposed OpenAI keys before sharing the demo publicly.
