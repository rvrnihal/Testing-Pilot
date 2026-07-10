# QA Copilot Testing Guide

This guide is for checking whether the app is running correctly from a user point of view.

## What you are testing

The app has two parts:

- Frontend: Next.js app at `http://localhost:3000`
- Backend API: Express app at `http://localhost:4000`

Main user flows:

- Open landing page
- Register a new user
- Approve that user from the admin console
- Login as the approved user
- Create a project
- Run at least one AI workflow

## Before you start

Make sure these are available:

- Node.js and npm
- PostgreSQL database
- Valid `.env` values

Recommended local env values are already shown in [.env.example](C:\Users\shaya\OneDrive\Desktop\Test Engine\.env.example).

Important:

- If `OPENAI_API_KEY` is empty, AI features will not work.
- If Stripe keys are empty, billing still works in local fallback mode and updates the subscription locally.
- Any real secrets that were pasted into `.env` should be rotated before public use.

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Push the Prisma schema to the database:

```powershell
npm run db:push
```

3. Seed the database:

```powershell
npm run db:seed
```

This creates:

- default admin user: `admin@qacopilot.ai`
- default admin password: `Admin@123`
- starter subscription plans
- demo project data

4. Start the app:

```powershell
npm run dev
```

Expected services:

- web: `http://localhost:3000`
- api health: `http://localhost:4000/api/health`

## Quick smoke test

Use this first if you only want to know whether the app is basically alive.

1. Open `http://localhost:3000`
2. Confirm the landing page loads without a blank screen
3. Open `http://localhost:4000/api/health`
4. Confirm the API returns:

```json
{"status":"ok"}
```

5. Login with:
   `admin@qacopilot.ai` / `Admin@123`
6. Confirm `/admin` opens and shows user stats

If all 6 checks pass, the app is running at a basic level.

## Full user acceptance test

### 1. Landing page

Open `http://localhost:3000`.

Expected:

- Hero section loads
- `Start free trial` button opens `/register`
- `Login` button opens `/login`

### 2. Register a new user

Go to `http://localhost:3000/register`.

Test with an individual account first.

Example:

- Full name: `Test User`
- Email: any unused email
- Password: `TestUser@123`
- Confirm password: `TestUser@123`

Expected:

- Form submits successfully
- You are redirected to `/login?registered=1`
- Message says admin approval is required

### 3. Confirm pending login is blocked

Try logging in with the new user before admin approval.

Expected:

- Login is rejected
- User sees a pending approval message

### 4. Approve the user in admin console

Login as admin at `http://localhost:3000/login`.

Admin credentials:

- Email: `admin@qacopilot.ai`
- Password: `Admin@123`

Open `/admin`.

Expected:

- Admin dashboard loads
- New user appears in user operations
- Pending approval count is visible

Approve the user.

Expected:

- User status changes to approved
- User remains visible in the admin console

Optional extra checks:

- Assign credits to the user
- Verify the updated credit balance appears
- Test `Terminate` on a disposable user only

### 5. Login as approved user

Login with the user you approved.

Expected:

- User is redirected to `/dashboard`
- Dashboard overview loads
- Credits, actions, and recent activity sections are visible

### 6. Create a project

In the dashboard project workspace, create a project.

Example:

- Name: `Sample QA Project`
- Description: `Testing end-to-end app flow`

Expected:

- Project is created successfully
- Project appears in the workspace
- It can be selected for AI actions

### 7. Test one AI workflow

The fastest workflow to validate is usually `Bug Analysis` or `Release Risk`.

Example for `Bug Analysis`:

- Open the `Bug Analysis` section
- Paste:

```text
Login fails for some users after password reset.
Observed behavior: API returns 401 after reset.
Possible clues: token mismatch, stale session, or password hash issue.
```

Expected:

- Request completes without server error
- Result appears in the output panel
- Recent activity updates
- Credits used increases

If `OPENAI_API_KEY` is not valid, this step will fail even if the rest of the app is working.

### 8. Test a file-upload workflow

Use one of these:

- `Generate Test Cases`
- `Generate Test Report`
- `Generate API Tests`
- `Content Match`
- `Design Match`

Expected:

- File upload is accepted
- Request completes
- Structured output is shown
- Export buttons appear when relevant

### 9. Test export actions

After generating content, try the available export buttons such as:

- `Export JSON`
- `Export CSV`
- `Export Excel`
- `Export PDF`

Expected:

- File downloads successfully
- Downloaded file opens and contains generated content

### 10. Test billing fallback

With Stripe keys empty, use a plan upgrade path if exposed in the UI.

Expected:

- App does not crash
- Subscription updates locally instead of redirecting to Stripe

## API checks

Useful endpoints for manual verification:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/admin/overview`

Notes:

- Most routes require auth
- Dashboard, projects, billing, and AI routes require an approved user
- Admin routes require an approved admin user

## Pass criteria

You can consider the app to be working if all of these pass:

- Landing page loads
- API health endpoint returns `ok`
- Registration works
- Pending users cannot login
- Admin can approve users
- Approved users can login
- Dashboard loads
- Project creation works
- At least one AI workflow completes
- At least one export works

## Common failure reasons

### App loads but AI actions fail

Likely causes:

- `OPENAI_API_KEY` missing
- invalid OpenAI key
- model access issue

### Frontend loads but data panels fail

Likely causes:

- `NEXT_PUBLIC_API_URL` is wrong
- backend is not running
- CORS origin does not match frontend URL

### Login fails for admin

Likely causes:

- database was not seeded
- seed ran against a different database

### Registration works but approval or dashboard fails

Likely causes:

- Prisma schema not pushed
- database connection string is wrong
- backend cannot reach PostgreSQL

## Suggested test order for demos

Use this order when showing the app to someone else:

1. `GET /api/health`
2. Landing page
3. Admin login
4. New user registration
5. Admin approval
6. User login
7. Project creation
8. One AI workflow
9. One export

## Related files

- [README.md](C:\Users\shaya\OneDrive\Desktop\Test Engine\README.md)
- [PUBLIC_RUN.md](C:\Users\shaya\OneDrive\Desktop\Test Engine\PUBLIC_RUN.md)
- [.env.example](C:\Users\shaya\OneDrive\Desktop\Test Engine\.env.example)
- [prisma/seed.js](C:\Users\shaya\OneDrive\Desktop\Test Engine\prisma\seed.js)
