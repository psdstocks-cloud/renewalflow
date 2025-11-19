<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

---

## RenewalFlow Backend API (`server/`)

A production-ready Node.js + TypeScript API that powers the RenewalFlow frontend. It secures integrations, stores data in PostgreSQL via Prisma, and exposes routes for subscribers, settings, WooCommerce sync, reminders, AI-generated emails, and cron automation.

### Environment variables

Create `server/.env` with:

```
PORT=4000
DATABASE_URL=postgres://...
ADMIN_API_KEY=change-me
CRON_API_KEY=optional-different-key
GEMINI_API_KEY=your-gemini-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass
SMTP_FROM_EMAIL=team@example.com
SMTP_FROM_NAME=RenewalFlow
FRONTEND_ORIGIN=https://your-frontend.app
```

WooCommerce credentials, reminder timing, email templates, and WhatsApp config are persisted via the API itself and stored in the `AppSettings` table.

### Install & run

```
cd server
npm install
npx prisma migrate dev
npm run dev
```

### Available scripts

- `npm run dev` – ts-node-dev watcher
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run compiled build
- `npm run prisma:migrate` / `npm run prisma:generate`

### API surface

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/health` | Public health check |
| CRUD | `/api/subscribers` | List, view, create, update, cancel, bulk import, and stats |
| GET/PUT | `/api/settings` | Load or update reminder/email/Woo/admin settings |
| POST | `/api/woo/sync` | Server-side WooCommerce order sync |
| GET/POST | `/api/reminders/*` | Task computation, send single/batch reminders, WhatsApp summary |
| POST | `/api/cron/daily` | Cron-protected endpoint to run Woo sync + reminders |

All `/api/*` routes require the `x-admin-api-key` header unless otherwise noted. `/api/cron/daily` accepts `x-cron-key` (or falls back to the admin key).
