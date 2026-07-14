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

## Security Notice

This is an admin tool for a game server. Do not expose it publicly without additional protection such as VPN, reverse-proxy authentication, SSO, or IP allowlisting.

The browser logs in with a panel password. The real Palworld REST admin password is kept server-side and injected only by the dashboard proxy.

Read the security guide before production use:

https://palworld-server-dashboard.vercel.app/docs/security

## Documentation

The docs cover installation, configuration, authentication, moderator access, deployment, operations, troubleshooting, and development:

https://palworld-server-dashboard.vercel.app/docs

## Contributors

<a href="https://github.com/SSCBryce" title="SSCBryce">
  <img src="https://github.com/SSCBryce.png?size=80" width="80" height="80" alt="SSCBryce" />
</a>

## License

MIT. See [LICENSE](./LICENSE).
