# StaffHub Deployment

## Test environment (Vercel)

1. Push this repo to GitHub at `https://github.com/Kal-droid1/staffhub`.
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo.
3. In the Vercel project settings → Environment Variables, add:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `NEXTAUTH_SECRET` — a secure random string. **Do not use the placeholder from .env.example in production.**
   - `NEXTAUTH_URL` — your Vercel deployment URL (e.g. `https://staffhub.vercel.app`)
   - `CRON_SECRET` — a secure random string for authenticating the daily auto-absent cron job. Must match the secret set in Vercel Cron Jobs for `/api/cron/check-attendance`.
4. Vercel auto-detects Next.js. No framework override needed — just deploy.
5. Every push to the main branch triggers an automatic deploy.

## Production host (Docker)

1. Spin up a VPS with Docker and Docker Compose installed.
2. Clone the repo: `git clone https://github.com/Kal-droid1/staffhub`
3. Copy env: `cp .env.example .env` and fill in all values (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET).
4. Run: `docker compose up -d --build`
5. The app is live at `http://<server-ip>:3000`.

To run behind a reverse proxy (nginx/Caddy), point the proxy at `localhost:3000`.

## Local development

```bash
cp .env.example .env   # fill in all values
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Or with Docker:
```bash
docker compose up -d
npx prisma migrate dev
npm run dev
```
