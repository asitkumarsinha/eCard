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

## Host on Render

This repo includes `render.yaml` for a one-click Blueprint.

1. Push the project to GitHub (do not commit `.env` or `ecard.db`).
2. In Render, open **New → Blueprint**.
3. Select the GitHub repo.
4. Apply the Blueprint. Render creates:
   - `ecard-api` — Node API with a 1 GB disk for SQLite and uploads
   - `ecard-web` — Angular static site, with `/api` and `/uploads` rewritten to the API
5. In `ecard-api` → **Environment**, set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
6. Open the `ecard-web` URL. Sign in as Admin and change the password.

The Blueprint uses a persistent disk, which requires a paid instance. On the free plan, SQLite data is wiped when the service restarts.

If the API URL is not `https://ecard-api.onrender.com` (for example the name was already taken), edit the rewrite destinations on `ecard-web` to match the real API URL.
