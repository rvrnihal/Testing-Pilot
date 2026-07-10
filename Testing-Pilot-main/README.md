# QA Copilot

QA Copilot is an AI-assisted QA platform for test engineers and QA leads. It helps teams generate test assets, analyze defects, execute website-focused tests, compare live pages with content or design references, and produce release-ready QA reports from one workspace.

## Main Documentation

For full product documentation covering what the tool does, how it works, user flow, architecture, roles, and included functionalities, see [TOOL_DOCUMENTATION.md](docs/TOOL_DOCUMENTATION.md).

## Tech Stack

- Next.js + React + Tailwind CSS frontend
- Express backend API
- PostgreSQL + Prisma
- JWT authentication with admin approval
- AI-powered QA workflows (Hugging Face or OpenAI)
- Playwright-based website execution and visual QA
- Stripe-ready billing flow with local fallback behavior

## Local Run

Use Docker:

```bash
docker compose up --build -d
docker compose exec api sh -lc "npx prisma db push && npm run db:seed"
```

Then open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/health`

Admin login:

- Email: `admin@qacopilot.ai`
- Password: `Admin@123`

## Additional References

- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [USER_TESTING_DOCUMENTATION.md](docs/USER_TESTING_DOCUMENTATION.md)
- [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)

## Deployment Note

This repo is structured as a split deployment:

- Frontend can be hosted on Vercel
- Express API should be hosted separately on a Node-friendly platform such as Railway, Render, or Fly.io
- PostgreSQL should be hosted separately

If you want full Vercel hosting, the Express backend should be refactored into Next.js serverless or API routes first.
