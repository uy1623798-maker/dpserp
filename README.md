# Dhumari Public School

A unified React + Vite website, role-based school ERP demo, and installable PWA for Dhumari Public School.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL shown in the terminal. The development command starts both the website and the local school API. Production authentication uses the assigned school ID/admission number and registered date of birth.

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

## Project structure

```text
api/
  _lib/                 Shared Vercel API implementation
  auth/, files/, records/ Route entry points
public/                 Logos, PWA icons and static assets
server/                 Local development API
src/
  app/                  Public website shell and intro
  components/           Shared interface components
  config/               School-wide options and constants
  features/             Auth, ERP, homework and import features
  services/             Browser API clients
  styles/               Global and feature stylesheets
```

## Architecture notes

- Public pages and ERP share one responsive React/Vite application.
- Production data is stored in PostgreSQL and accessed through authenticated, role-checked Vercel API routes.
- Authentication uses hashed credentials and expiring server-side sessions.
- Service functions under `src/services/` are the only browser-to-API boundary.
- Private ERP routes are excluded from `robots.txt`.
- Generated `dist/` and `dev-dist/` output is not committed.
