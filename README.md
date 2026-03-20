# Palworld Server Dashboard

Palworld Server Dashboard is a browser-based admin panel for managing a Palworld dedicated server through its REST API.

It gives you one place to handle the jobs you do most often:

- checking whether the server is healthy
- watching live player activity
- sending announcements
- kicking, banning, and unbanning players
- viewing live map positions
- monitoring FPS, uptime, and other server metrics

Built with Next.js, designed for self-hosting, and meant to feel much friendlier than working with raw API calls.

## Live Demo 🌐

[Open the live demo](https://palworld-server-dashboard.vercel.app/)

## Preview 🖼️

Sensitive data in the dashboard screenshot below has been blurred.

### Dashboard

![Palworld Server Dashboard screenshot with sensitive data blurred](public/readme/dashboard-preview-redacted.png)

### Login Screen

![Palworld Server Dashboard login screen](public/readme/login-preview.png)

### Live Map

![Palworld Server Dashboard live map screen](public/readme/live-map-preview.png)

## Table of Contents

- [Live Demo](#live-demo-)
- [Overview](#overview-)
- [Features](#features-)
- [How It Works](#how-it-works-)
- [Requirements](#requirements-)
- [Quick Start](#quick-start-)
- [First Connection Walkthrough](#first-connection-walkthrough-)
- [Available Scripts](#available-scripts-)
- [Development Notes](#development-notes-)
- [Production and Deployment](#production-and-deployment-)
- [Security Notes](#security-notes-)
- [Project Structure](#project-structure-)
- [UI Library and Styling](#ui-library-and-styling-)
- [Troubleshooting](#troubleshooting-)
- [Contributing](#contributing-)
- [Tech Stack](#tech-stack-)
- [License](#license-)

## Overview 🎮

Running a game server usually means doing a lot of repetitive operational work:

- checking if the server is online
- seeing who is connected
- warning players before maintenance
- saving the world before a restart
- watching performance when the server is under load

This dashboard brings those tasks together into a single control surface with a more approachable UI.

## Features ✨

### Dashboard Overview

The main dashboard gives you a quick read on the current state of the server, including:

- connection status
- online player count
- uptime
- server information
- world settings
- recent in-app console activity

### Player Management

You can manage players directly from the UI:

- view online players
- search by name or user ID
- kick players
- ban players
- unban players

### Server Operations

The control cards let you handle common admin actions:

- send custom announcements
- use quick preset messages
- save the world
- schedule restart warnings
- shut down the server
- force stop the server

### Metrics and Monitoring

The metrics panel helps you keep an eye on performance:

- live FPS
- FPS history graph
- frame time
- uptime
- player capacity
- world day

### Live Map

The map view shows:

- player positions
- optional fast travel markers
- optional boss tower markers
- zoom and pan controls
- grouped player markers when players are close together

### Visual Customization

The dashboard includes multiple built-in visual themes, so server admins can choose the look they prefer without changing the code.

## How It Works 🔌

The browser never talks to the Palworld REST API directly.

Instead, the frontend sends requests to a local Next.js API route, and that route forwards the request to your Palworld server. This gives the project a few practical benefits:

- the admin password is not placed in URL query strings
- browser code stays simpler
- requests can be normalized before forwarding them

The app also stores some state in the browser, such as recent server data and optional saved connection details.

## Requirements 📋

You will need:

- Node.js `20.9.0` or newer
- npm `10` or newer
- a Palworld server with the REST API enabled
- the admin password for that server

Before starting, make sure you know:

- `Server IP or URL`
- `REST API port`
- `Game port`
- `Admin password`

Typical defaults used by the UI are:

- `REST API port`: `8212`
- `Game port`: `8211`

The exact server-side setup depends on how your Palworld server is hosted. If you are using a hosted panel, Docker image, or custom server setup, check that provider's instructions for enabling the REST API.

## Quick Start 🚀

Clone the project, install dependencies, and start the development server:

```bash
git clone <your-fork-or-repo-url>
cd palworld-server-dashboard
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

If you are developing from another device on your local network, the dev server also exposes a network URL when started.

## First Connection Walkthrough 🧭

When you open the app, you will see the login/connect screen.

Fill in the fields like this:

### Server IP or URL

This is the host where your Palworld server can be reached.

Examples:

- `192.168.1.50`
- `play.example.com`
- `http://192.168.1.50`

### REST API Port

This is the Palworld REST API port, not the public gameplay port.

Default:

```text
8212
```

### Game Port

This is the gameplay port your server uses.

Default:

```text
8211
```

The dashboard stores this as part of the server profile so the UI can show the full server connection details.

### Admin Password

This is the password used to authenticate against the Palworld REST API.

### Remember Me

If enabled, the app stores the connection details in browser local storage on that machine so you do not need to re-enter them every time.

## Available Scripts 🛠️

### `npm run dev`

Starts the Next.js development server.

### `npm run typecheck`

Generates Next.js route types and runs the TypeScript checker.

### `npm run build`

Creates a production build.

### `npm run start`

Starts the production server from a built app.

### `npm run check`

Runs the full local verification flow:

- typecheck
- production build

## Development Notes 💻

### Local Network Access

This project is configured to allow development access from the machine's active local IPv4 addresses. That helps when you want to open the app from a LAN address instead of only `localhost`.

### Type Generation

The typecheck script clears `.next` before regenerating route types. This avoids stale generated files causing false TypeScript errors after route changes.

## Production and Deployment 🌐

To create a production build:

```bash
npm run build
npm run start
```

The project uses Next.js standalone output, which makes self-hosting easier and is a good starting point for:

- VPS deployments
- internal dashboards
- containerized deployments
- reverse-proxy setups

This app is best treated as an internal admin tool, not a public-facing website.

Recommended deployment patterns:

- private home lab or LAN
- VPN-only access
- reverse proxy with authentication
- internal server management network

## Security Notes 🔐

This project handles server admin access, so a few things are important.

### Good News

- the admin password is proxied through Next.js API routes
- the password is not sent in URL query strings
- the app does not require a separate database

### Important Tradeoff

If `Remember me` is enabled, the server IP, ports, and admin password are stored in browser local storage on that machine.

That means:

- it is convenient for trusted personal devices
- it is a bad idea on shared or public machines

### Recommended Practice

If you plan to deploy this for regular use:

- put it behind authentication
- keep it on a trusted network
- use HTTPS if exposed beyond your LAN
- avoid sharing browser profiles that have saved credentials

## Project Structure 🗂️

This is a quick guide to the main folders:

```text
app/          Next.js app routes, layout, providers, API routes
components/   UI components and dashboard panels
lib/          shared helpers, state, types, and Palworld request utilities
public/       static assets such as icons and map images
```

Some especially useful files:

- `app/api/palworld/[...path]/route.ts` - proxy route to the Palworld REST API
- `lib/server-context.tsx` - app-wide server/session state
- `lib/palworld.ts` - Palworld API helpers and payload normalization
- `components/dashboard.tsx` - main dashboard shell
- `components/live-map.tsx` - live map view

## UI Library and Styling 🎨

This project does not use a large all-in-one UI framework like MUI, Ant Design, or Chakra UI.

Instead, the UI is built with a lighter custom stack:

- Tailwind CSS for styling and layout
- Radix UI primitives for accessible low-level UI behavior
- custom reusable components inside `components/` and `components/ui/`
- a visual style and component direction influenced by `thegridcn`
- Sonner for toast notifications

In practice, that means the visual design is mostly custom and shaped by the `thegridcn` aesthetic, while accessibility and interaction behavior for dialogs, dropdowns, tabs, switches, and sheets are powered by Radix UI primitives.

## Troubleshooting 🧯

### The app opens, but it cannot connect to my server

Check:

- server IP or hostname
- REST API port
- admin password
- firewall rules
- whether the REST API is actually enabled on the server

### The gameplay server works, but the dashboard cannot connect

That usually means the game port is reachable but the REST API is not. Double-check the REST API port and its authentication settings.

### The page loads, but development hot reload is not working

Restart the dev server with:

```bash
npm run dev
```

If you are using a LAN URL, make sure you are opening the same machine's active network address and not an outdated one.

### TypeScript complains about generated route files

Run:

```bash
npm run typecheck
```

The script already resets and regenerates the route types for you.

## Contributing 🤝

Contributions are welcome.

Good ways to contribute:

- fix bugs
- improve the UI
- improve server compatibility
- improve the documentation
- add tests
- suggest deployment improvements

If you open an issue or pull request, it helps to include:

- what you expected
- what actually happened
- steps to reproduce the problem
- screenshots or logs when relevant

## Tech Stack 🧰

- Next.js
- React
- TypeScript
- Tailwind CSS
- Radix UI primitives
- Sonner

## License 📄

MIT. See [LICENSE](./LICENSE).
