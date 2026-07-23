# StaffHub Deployment

## Test environment (Vercel)

1. Push this repo to GitHub at `https://github.com/Kal-droid1/staffhub`.
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo.
3. In the Vercel project settings → Environment Variables, add:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `NEXTAUTH_SECRET` — a secure random string (generate with `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). **Do not use the placeholder value from .env.example in production.**
   - `NEXTAUTH_URL` — your Vercel deployment URL (e.g. `https://staffhub.vercel.app`)
4. Vercel auto-detects Next.js. No framework override needed — just deploy.
5. Every push to the main branch triggers an automatic deploy.

## Production host (Docker)

1. Spin up a VPS with Docker and Docker Compose installed.
2. Clone the repo: `git clone https://github.com/Kal-droid1/staffhub`
3. Copy env: `cp .env.example .env` and fill in `DATABASE_URL`, `NEXTAUTH_SECRET` (generate a new random value — do not reuse the placeholder), and `NEXTAUTH_URL` (set to your server's public URL, e.g. `https://staffhub.example.com`).
4. Run: `docker compose up -d --build`
5. The app is live at `http://<server-ip>:3000`.

To run behind a reverse proxy (nginx/Caddy), point the proxy at `localhost:3000`.

## Local development

```bash
cp .env.example .env   # edit DATABASE_URL, generate a real NEXTAUTH_SECRET
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
