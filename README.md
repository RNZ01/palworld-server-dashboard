[![Publish Docker image](https://github.com/RNZ01/palworld-server-dashboard/actions/workflows/publish-docker-image.yml/badge.svg)](https://github.com/RNZ01/palworld-server-dashboard/actions/workflows/publish-docker-image.yml) 

# Palworld Server Dashboard

A self-hosted web dashboard for operating a Palworld dedicated server through the Palworld REST API.

Use it to monitor server health, view players, manage moderation actions, send announcements, inspect FPS history, and access a live map from a browser.

## Links

- **Live demo:** https://palworld-server-dashboard.vercel.app/
- **Documentation:** https://palworld-server-dashboard.vercel.app/docs
- **Container image:** `ghcr.io/rnz01/palworld-server-dashboard:latest`

## Demo

The live demo uses mock Palworld REST API data, so you can click around without affecting a real server.

## Preview

Sensitive data in the dashboard screenshot below has been blurred.

### Dashboard

![Palworld Server Dashboard screenshot with sensitive data blurred](public/readme/dashboard-preview-redacted.png)

### Login

![Palworld Server Dashboard login screen](public/readme/login-preview.png)

### Live Map

![Palworld Server Dashboard live map screen](public/readme/live-map-preview.png)

## Features

- Server status, uptime, FPS, frame time, player count, and world metrics
- Rolling server-side FPS history
- Online player roster with kick, ban, and unban actions
- Admin announcements and common server-operation controls
- Live map with player positions and optional map markers
- Optional public read-only status page (`/view`) with metrics, live map, and player list
- Admin and limited moderator access tiers
- Docker Compose deployment with FPS sampler sidecar
- Built-in documentation powered by Nextra

## Quick Start

### Docker Compose

```bash
cp .env.example .env
# edit .env

docker compose pull
docker compose up -d
```

Open:

```text
http://localhost:3000
```

### Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Required Configuration

At minimum, configure:

```env
PANEL_INITIAL_ADMIN_PASSWORD=replace-with-a-panel-password
PALWORLD_ADMIN_PASSWORD=replace-with-real-palworld-admin-password
PALWORLD_REST_URL=http://127.0.0.1:8212
```

For Docker, if Palworld runs on the host machine, use:

```env
PALWORLD_REST_URL=http://host.docker.internal:8212
```

See the full configuration guide in the docs:

https://palworld-server-dashboard.vercel.app/docs/configuration/environment-variables

## Scripts

```bash
npm run dev        # start development server
npm run build      # production build + docs search index
npm run start      # start production server
npm run typecheck  # route typegen + TypeScript check
npm run check      # typecheck + build
```

## Public Read-Only View (optional)

`/view` is a view-only status page designed to be safe to share: server metrics, the live map, and online players (name and level only). It is **disabled by default** — enable it with:

```env
PUBLIC_VIEW_ENABLED=true
```

It requires no password and grants none: its only data source is `GET /api/public-view`, which serves an allowlisted snapshot (no player IPs, no Steam/user IDs, no ping, no world GUID, no settings) and never accepts client input. Responses are cached server-side (`PUBLIC_VIEW_CACHE_SECONDS`, default 10s), so public traffic cannot put load on the game server.

Player names and live positions are visible to anyone who can reach the page — enable it only if that is acceptable for your community, or set `PUBLIC_VIEW_ANONYMIZE_NAMES=true` to replace names with stable pseudonyms (`Player-3f2a`) while keeping the map and levels public. The admin panel itself remains protected as before; if you expose only `/view` through your reverse proxy, keep `/`, `/api/palworld`, and the other panel routes restricted.

## Security Notice

This is an admin tool for a game server. Do not expose it publicly without additional protection such as VPN, reverse-proxy authentication, SSO, or IP allowlisting. The optional `/view` page (above) is the only surface designed for public exposure.

The browser logs in with a panel password. The real Palworld REST admin password is kept server-side and injected only by the dashboard proxy.

Read the security guide before production use:

https://palworld-server-dashboard.vercel.app/docs/security

## Documentation

The docs cover installation, configuration, authentication, moderator access, deployment, operations, troubleshooting, and development:

https://palworld-server-dashboard.vercel.app/docs

## License

MIT. See [LICENSE](./LICENSE).
