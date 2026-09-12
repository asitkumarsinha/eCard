# eCard

Angular + Express + SQLite card-customization MVP, based on `../WORKFLOW.md`.

## Run locally

Open two terminals:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd client
npm start
```

Open `http://localhost:4200`.

## Admin development login

Username: `admin`  
Password: `admin123`

The API seeds this account as a bcrypt hash the first time it starts. Change it and set `JWT_SECRET` before production.

## Email

Copy `server/.env.example` to `server/.env` and fill SMTP fields. Until then, the email action clearly reports that email delivery is not configured; download and device-share still work.

## Production deployment (Docker)

1. Install Docker and Docker Compose on the server.
2. Create a root `.env` file using the values in `server/.env.example`. Set a long, random `JWT_SECRET` and valid SMTP details. The SMTP account must be able to send mail to `asitkumarsinha@gmail.com`.
3. Start the production containers:

```powershell
docker compose up --build -d
```

4. Open `http://YOUR_SERVER:8080`. Put an HTTPS reverse proxy (such as Nginx, Caddy, or your hosting provider) in front of port `8080` before making the site public.

The Docker volume `ecard-data` retains the SQLite database and uploaded templates across restarts. Back it up regularly.

### Production checklist

- Change the initial `admin` password using the Admin dashboard.
- Use a strong unique `JWT_SECRET`; never commit `.env`.
- Configure SMTP before enabling password changes and email sharing.
- Publish a Privacy Policy that discloses the admin-only visitor log (IP address, time, browser data, and referrer), its purpose, and retention period.
- Configure HTTPS and keep Docker images/dependencies updated.

## Host on Render (free)

Use **one** free Web Service so the site and API share the same URL.

1. Push the project to GitHub (do not commit `.env`, `ecard.db`, or `node_modules`).
2. In Render, open your Web Service (for example `ecard-x4mp`).
3. Set:

| Field | Value |
|--------|--------|
| Root Directory | *leave empty* (repository root) |
| Build Command | `npm install --prefix server && npm install --prefix client && npm run build --prefix client` |
| Start Command | `npm start --prefix server` |

4. Add environment variable `STATIC_DIR` = `/opt/render/project/src/client/dist/client/browser`
5. Also set `NODE_VERSION=22`, `NODE_ENV=production`, `TRUST_PROXY=true`
6. Save and **Manual Deploy → Deploy latest commit**

Open `https://YOUR-SERVICE.onrender.com/` — the homepage should load.

### Free-plan limits

- The API sleeps after idle time. The first visit after that can take about a minute.
- There is no persistent disk. SQLite data (admin password, uploaded cards, visitor logs) is lost when Render restarts or redeploys the API.
- SMTP is still required for password-change emails; the site works without SMTP for browsing and downloads.
