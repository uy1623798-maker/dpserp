# Dhumari Public School

A unified React + Vite website, role-based school ERP demo, and installable PWA for Dhumari Public School.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL shown in the terminal. Use **ERP Login**, choose any role, and sign in with password `demo123`. The development command starts both the website and the school API.

## Production build

```bash
pnpm build
```

The generated `dist/` directory includes the web app manifest and service worker for offline/PWA behavior.

## Install as an app

- Chrome/Edge/Android: use the **Install DPS App** prompt or the browser installation icon.
- iPhone/iPad Safari: tap **Share**, then **Add to Home Screen**.
- Installation requires HTTPS in production; localhost is allowed during development.

The installed app uses the supplied crest, opens in standalone mode, supports home-screen shortcuts, caches the application shell and shows saved content during temporary network loss.

## Architecture notes

- Public pages and ERP live in one responsive codebase.
- Authentication is handled by the Node API using hashed demo passwords and expiring server-side sessions.
- ERP records are persisted in SQLite at runtime and accessed through authenticated, role-checked endpoints.
- Service functions are isolated under `src/services/` and connect the interface to the REST API.
- AI requests use `src/services/ai.js`; no model responses or keys are hardcoded.
- Private ERP routes are excluded from `robots.txt`.

This is a polished front-end foundation with representative ERP workflows. Production rollout still requires the secure Node/Express or Supabase backend, database migrations, file storage, audit logs, notification delivery, and API-enforced permissions described in the product specification.
