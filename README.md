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
